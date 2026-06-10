export const runtime = "nodejs";

import { createActor, fromPromise } from "xstate";
import { MigrationRequestSchema } from "@/lib/schemas/migration";
import { createMigrationMachine } from "@/lib/agent/machine";
import { setJob } from "@/lib/agent/jobs";
import { diffSnapshots } from "@/lib/agent/sse";
import {
  runAnalysis,
  runPlanning,
  runStep,
  runVerification,
} from "@/lib/agent/phases";
import { createOpenRouterClient } from "@/lib/llm/openrouter";
import type { LlmClient } from "@/lib/llm/client";
import type {
  MigrationRequest,
  AnalysisResult,
  MigrationPlan,
  PlanStep,
  StepExecutionResult,
} from "@/lib/schemas/migration";

function createActors(client: LlmClient) {
  return {
    analyze: fromPromise(
      async ({ input }: { input: { request: MigrationRequest } }) =>
        runAnalysis(client, input.request),
    ),
    plan: fromPromise(
      async ({
        input,
      }: {
        input: { request: MigrationRequest; analysis: AnalysisResult };
      }) => runPlanning(client, input.request, input.analysis),
    ),
    executeStep: fromPromise(
      async ({
        input,
      }: {
        input: {
          request: MigrationRequest;
          analysis: AnalysisResult;
          plan: MigrationPlan;
          step: PlanStep;
          priorResults: StepExecutionResult[];
        };
      }) =>
        runStep(
          client,
          input.request,
          input.analysis,
          input.plan,
          input.step,
          input.priorResults,
        ),
    ),
    verify: fromPromise(
      async ({
        input,
      }: {
        input: {
          request: MigrationRequest;
          plan: MigrationPlan;
          migratedFiles: {
            name: string;
            content: string;
            sourceFile?: string;
          }[];
        };
      }) =>
        runVerification(client, input.request, input.plan, input.migratedFiles),
    ),
  };
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = MigrationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ errors: parsed.error.issues }, { status: 400 });
  }

  const request = parsed.data;
  const jobId = crypto.randomUUID();

  const client = createOpenRouterClient();
  const machine = createMigrationMachine().provide({
    actors: createActors(client),
  });
  const actor = createActor(machine, { input: { request, maxRetries: 3 } });

  setJob(jobId, actor);

  const enc = new TextEncoder();

  function sseChunk(event: string, data: unknown): Uint8Array {
    return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    start(controller) {
      // Emit job id immediately
      controller.enqueue(sseChunk("job", { jobId }));

      let prev: ReturnType<typeof actor.getSnapshot> | null = null;

      const subscription = actor.subscribe({
        next(snap) {
          const events = diffSnapshots(prev, snap);
          for (const e of events) {
            controller.enqueue(sseChunk(e.type, e));
          }
          prev = snap;
        },
        complete() {
          const snap = actor.getSnapshot();
          const output = snap.output ?? {
            success: false,
            jobId,
            migratedFiles: [],
            plan: snap.context.plan ?? { strategy: "", steps: [] },
            verification: null,
            errors: snap.context.errors ?? [],
          };
          controller.enqueue(sseChunk("result", { ...output, jobId }));
          controller.close();
        },
        error(err) {
          controller.enqueue(
            sseChunk("error", {
              message: String(err),
              retryable: false,
              failedPhase: null,
            }),
          );
          controller.close();
        },
      });

      actor.start();

      return () => subscription.unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
