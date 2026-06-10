import type { MachineSnapshot } from "xstate";
import type { SseEvent } from "@/lib/schemas/events";
import type { MigrationPlan } from "@/lib/schemas/migration";

// We work with the snapshot shape directly to avoid importing the full machine type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySnapshot = MachineSnapshot<any, any, any, any, any, any, any, any>;

type Phase = "analyzing" | "planning" | "executing" | "verifying";
const PHASES: Phase[] = ["analyzing", "planning", "executing", "verifying"];

function stateValue(snap: AnySnapshot): string {
  return typeof snap.value === "string"
    ? snap.value
    : JSON.stringify(snap.value);
}

function getPhase(snap: AnySnapshot): Phase | null {
  const v = stateValue(snap);
  return PHASES.includes(v as Phase) ? (v as Phase) : null;
}

export function diffSnapshots(
  prev: AnySnapshot | null,
  next: AnySnapshot,
): SseEvent[] {
  if (prev === next) return [];

  const events: SseEvent[] = [];
  // null prev means "machine just started" — treat as transitioning from empty state
  const prevValue = prev ? stateValue(prev) : "";
  const nextValue = stateValue(next);

  const prevPhase = prev ? getPhase(prev) : null;
  const nextPhase = getPhase(next);

  // Retry: same phase re-entered with incremented retryCount
  // Must be checked before the same-value early exit below
  if (
    prevPhase &&
    prevPhase === nextPhase &&
    prev &&
    next.context.retryCount > prev.context.retryCount
  ) {
    events.push({
      type: "phase",
      phase: nextPhase,
      status: "retrying",
      retryCount: next.context.retryCount,
    });
  }

  // Nothing else changed (but retrying may have been pushed already)
  if (prevValue === nextValue) return events;

  // Phase completed (leaving a phase for another phase or done)
  if (prevPhase && prevPhase !== nextPhase) {
    if (nextPhase || nextValue === "done") {
      events.push({
        type: "phase",
        phase: prevPhase,
        status: "completed",
        retryCount: prev?.context.retryCount ?? 0,
      });
    }
    if (nextValue === "failed") {
      events.push({
        type: "phase",
        phase: prevPhase,
        status: "failed",
        retryCount: next.context.retryCount ?? 0,
      });
    }
  }

  // Phase started (entering a new phase)
  if (nextPhase && nextPhase !== prevPhase) {
    events.push({
      type: "phase",
      phase: nextPhase,
      status: "started",
      retryCount: next.context.retryCount ?? 0,
    });
  }

  // Plan available (just arrived in executing from planning)
  if (
    prevValue === "planning" &&
    nextPhase === "executing" &&
    next.context.plan
  ) {
    events.push({
      type: "plan",
      plan: next.context.plan as MigrationPlan,
    });
  }

  // Step status changes
  const prevSteps: Array<{ id: string; status: string }> =
    prev?.context.plan?.steps ?? [];
  const nextSteps: Array<{ id: string; status: string }> =
    next.context.plan?.steps ?? [];
  nextSteps.forEach((nextStep, i) => {
    const prevStep = prevSteps[i];
    if (!prevStep || prevStep.status !== nextStep.status) {
      events.push({
        type: "step",
        stepId: nextStep.id,
        index: i,
        status: nextStep.status as
          | "pending"
          | "in_progress"
          | "completed"
          | "failed",
      });
    }
  });

  // Error event when entering failed state
  if (nextValue === "failed" && prevValue !== "failed") {
    const lastError =
      next.context.errors?.[next.context.errors.length - 1] ?? "Unknown error";
    events.push({
      type: "error",
      message: lastError,
      retryable: true,
      failedPhase: next.context.failedPhase ?? null,
    });
  }

  return events;
}
