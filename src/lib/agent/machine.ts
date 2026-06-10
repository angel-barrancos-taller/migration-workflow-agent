// No server-only imports — this file is also imported by MachineViz for graph derivation
import { setup, assign, fromPromise } from "xstate";
import type {
  MigrationRequest,
  AnalysisResult,
  MigrationPlan,
  PlanStep,
  StepExecutionResult,
  VerificationResult,
  MigratedFile,
  MigrationResponse,
} from "@/lib/schemas/migration";

export type Phase = "analyzing" | "planning" | "executing" | "verifying";

interface MachineContext {
  request: MigrationRequest;
  analysis: AnalysisResult | null;
  plan: MigrationPlan | null;
  currentStepIndex: number;
  stepResults: StepExecutionResult[];
  verification: VerificationResult | null;
  retryCount: number;
  maxRetries: number;
  failedPhase: Phase | null;
  errors: string[];
}

interface MachineInput {
  request: MigrationRequest;
  maxRetries?: number;
}

type MachineEvent = { type: "RETRY" };

// Actor input/output types
interface AnalyzeInput {
  request: MigrationRequest;
}
interface PlanInput {
  request: MigrationRequest;
  analysis: AnalysisResult;
}
interface ExecuteStepInput {
  request: MigrationRequest;
  analysis: AnalysisResult;
  plan: MigrationPlan;
  step: PlanStep;
  priorResults: StepExecutionResult[];
}
interface VerifyInput {
  request: MigrationRequest;
  plan: MigrationPlan;
  migratedFiles: MigratedFile[];
}

function collectMigratedFiles(
  stepResults: StepExecutionResult[],
): MigratedFile[] {
  return stepResults.flatMap((r) => r.files);
}

function buildOutput(context: MachineContext): MigrationResponse {
  const migratedFiles = collectMigratedFiles(context.stepResults);
  return {
    success: context.failedPhase === null,
    jobId: "",
    migratedFiles,
    plan: context.plan!,
    verification: context.verification,
    errors: context.errors,
  };
}

export const migrationMachine = setup({
  types: {
    context: {} as MachineContext,
    input: {} as MachineInput,
    events: {} as MachineEvent,
    output: {} as MigrationResponse,
  },
  actors: {
    analyze: fromPromise<AnalysisResult, AnalyzeInput>(async () => {
      throw new Error("analyze actor not provided");
    }),
    plan: fromPromise<MigrationPlan, PlanInput>(async () => {
      throw new Error("plan actor not provided");
    }),
    executeStep: fromPromise<StepExecutionResult, ExecuteStepInput>(
      async () => {
        throw new Error("executeStep actor not provided");
      },
    ),
    verify: fromPromise<VerificationResult, VerifyInput>(async () => {
      throw new Error("verify actor not provided");
    }),
  },
  guards: {
    canRetry: ({ context }) => context.retryCount < context.maxRetries,
    // Guard fires before markStepCompleted increments the index, so check +1
    hasMoreSteps: ({ context }) =>
      context.plan !== null &&
      context.currentStepIndex + 1 < context.plan.steps.length,
    failedAtAnalyzing: ({ context }) => context.failedPhase === "analyzing",
    failedAtPlanning: ({ context }) => context.failedPhase === "planning",
    failedAtExecuting: ({ context }) => context.failedPhase === "executing",
    failedAtVerifying: ({ context }) => context.failedPhase === "verifying",
  },
  actions: {
    recordRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
      errors: ({ context, event }) => {
        const err = (event as { error?: unknown }).error;
        return [
          ...context.errors,
          err instanceof Error ? err.message : String(err),
        ];
      },
    }),
    recordFailure: assign({
      failedPhase: (_, params: { phase: Phase }) => params.phase,
      errors: ({ context, event }) => {
        const err = (event as { error?: unknown }).error;
        return [
          ...context.errors,
          err instanceof Error ? err.message : String(err),
        ];
      },
    }),
    resetRetry: assign({
      retryCount: 0,
      failedPhase: null,
    }),
    markStepInProgress: assign({
      plan: ({ context }) => {
        if (!context.plan) return context.plan;
        const steps = context.plan.steps.map((s, i) =>
          i === context.currentStepIndex
            ? { ...s, status: "in_progress" as const }
            : s,
        );
        return { ...context.plan, steps };
      },
    }),
    markStepCompleted: assign({
      plan: ({ context }) => {
        if (!context.plan) return context.plan;
        const steps = context.plan.steps.map((s, i) =>
          i === context.currentStepIndex
            ? { ...s, status: "completed" as const }
            : s,
        );
        return { ...context.plan, steps };
      },
      stepResults: ({ context, event }) => {
        const result = (event as unknown as { output: StepExecutionResult })
          .output;
        return [...context.stepResults, result];
      },
      currentStepIndex: ({ context }) => context.currentStepIndex + 1,
      retryCount: 0,
    }),
    markStepFailed: assign({
      plan: ({ context }) => {
        if (!context.plan) return context.plan;
        const steps = context.plan.steps.map((s, i) =>
          i === context.currentStepIndex
            ? { ...s, status: "failed" as const }
            : s,
        );
        return { ...context.plan, steps };
      },
    }),
  },
}).createMachine({
  id: "migration",
  initial: "analyzing",
  context: ({ input }) => ({
    request: input.request,
    analysis: null,
    plan: null,
    currentStepIndex: 0,
    stepResults: [],
    verification: null,
    retryCount: 0,
    maxRetries: input.maxRetries ?? 3,
    failedPhase: null,
    errors: [],
  }),
  output: ({ context }) => buildOutput(context),
  states: {
    analyzing: {
      invoke: {
        src: "analyze",
        input: ({ context }): AnalyzeInput => ({ request: context.request }),
        onDone: {
          target: "planning",
          actions: assign({
            analysis: ({ event }) => event.output,
            retryCount: 0,
          }),
        },
        onError: [
          {
            guard: "canRetry",
            target: "analyzing",
            reenter: true,
            actions: { type: "recordRetry" },
          },
          {
            target: "failed",
            actions: { type: "recordFailure", params: { phase: "analyzing" } },
          },
        ],
      },
    },

    planning: {
      invoke: {
        src: "plan",
        input: ({ context }): PlanInput => ({
          request: context.request,
          analysis: context.analysis!,
        }),
        onDone: {
          target: "executing",
          actions: assign({
            plan: ({ event }) => event.output,
            currentStepIndex: 0,
            retryCount: 0,
          }),
        },
        onError: [
          {
            guard: "canRetry",
            target: "planning",
            reenter: true,
            actions: { type: "recordRetry" },
          },
          {
            target: "failed",
            actions: { type: "recordFailure", params: { phase: "planning" } },
          },
        ],
      },
    },

    executing: {
      entry: { type: "markStepInProgress" },
      invoke: {
        src: "executeStep",
        input: ({ context }): ExecuteStepInput => ({
          request: context.request,
          analysis: context.analysis!,
          plan: context.plan!,
          step: context.plan!.steps[context.currentStepIndex],
          priorResults: context.stepResults,
        }),
        onDone: [
          {
            guard: "hasMoreSteps",
            target: "executing",
            reenter: true,
            actions: { type: "markStepCompleted" },
          },
          {
            target: "verifying",
            actions: assign({
              plan: ({ context, event }) => {
                if (!context.plan) return context.plan;
                const steps = context.plan.steps.map((s, i) =>
                  i === context.currentStepIndex
                    ? { ...s, status: "completed" as const }
                    : s,
                );
                return { ...context.plan, steps };
              },
              stepResults: ({ context, event }) => [
                ...context.stepResults,
                event.output,
              ],
              retryCount: 0,
            }),
          },
        ],
        onError: [
          {
            guard: "canRetry",
            target: "executing",
            reenter: true,
            actions: [{ type: "recordRetry" }, { type: "markStepFailed" }],
          },
          {
            target: "failed",
            actions: [
              { type: "recordFailure", params: { phase: "executing" } },
              { type: "markStepFailed" },
            ],
          },
        ],
      },
    },

    verifying: {
      invoke: {
        src: "verify",
        input: ({ context }): VerifyInput => ({
          request: context.request,
          plan: context.plan!,
          migratedFiles: collectMigratedFiles(context.stepResults),
        }),
        onDone: {
          target: "done",
          actions: assign({
            verification: ({ event }) => event.output,
            retryCount: 0,
          }),
        },
        onError: [
          {
            guard: "canRetry",
            target: "verifying",
            reenter: true,
            actions: { type: "recordRetry" },
          },
          {
            target: "failed",
            actions: { type: "recordFailure", params: { phase: "verifying" } },
          },
        ],
      },
    },

    failed: {
      on: {
        RETRY: [
          {
            guard: "failedAtAnalyzing",
            target: "analyzing",
            reenter: true,
            actions: { type: "resetRetry" },
          },
          {
            guard: "failedAtPlanning",
            target: "planning",
            reenter: true,
            actions: { type: "resetRetry" },
          },
          {
            guard: "failedAtExecuting",
            target: "executing",
            reenter: true,
            actions: assign({
              retryCount: 0,
              failedPhase: null,
              plan: ({ context }) => {
                if (!context.plan) return context.plan;
                const steps = context.plan.steps.map((s, i) =>
                  i === context.currentStepIndex
                    ? { ...s, status: "pending" as const }
                    : s,
                );
                return { ...context.plan, steps };
              },
            }),
          },
          {
            guard: "failedAtVerifying",
            target: "verifying",
            reenter: true,
            actions: { type: "resetRetry" },
          },
        ],
      },
    },

    done: {
      type: "final",
    },
  },
});

export function createMigrationMachine() {
  return migrationMachine;
}
