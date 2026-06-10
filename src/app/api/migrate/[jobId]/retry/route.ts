export const runtime = "nodejs";

import { getJob } from "@/lib/agent/jobs";
import { diffSnapshots } from "@/lib/agent/sse";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await params;
  const actor = getJob(jobId);

  if (!actor) {
    return Response.json(
      { error: "Job not found or expired" },
      { status: 404 },
    );
  }

  const enc = new TextEncoder();

  function sseChunk(event: string, data: unknown): Uint8Array {
    return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    start(controller) {
      let prev: ReturnType<typeof actor.getSnapshot> | null =
        actor.getSnapshot();

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

      // Send RETRY after subscribing so we don't miss events
      actor.send({ type: "RETRY" });

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
