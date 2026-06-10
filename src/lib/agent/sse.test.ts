import { createActor, fromPromise } from "xstate";
import { diffSnapshots } from "./sse";
import { createMigrationMachine } from "./machine";
import type {
  MigrationRequest,
  AnalysisResult,
  MigrationPlan,
  VerificationResult,
} from "@/lib/schemas/migration";

const request: MigrationRequest = {
  files: [{ name: "App.tsx", content: "fn()" }],
  source: "react",
  target: "vue",
};

const fixtureAnalysis: AnalysisResult = {
  summary: "test",
  components: [],
  patterns: [],
  risks: [],
};

const fixturePlan: MigrationPlan = {
  strategy: "s",
  steps: [
    {
      id: "step-1",
      description: "d",
      files: ["App.tsx"],
      dependencies: [],
      complexity: "low",
      status: "pending",
    },
  ],
};

const fixtureVerification: VerificationResult = {
  passed: true,
  issues: [],
  summary: "ok",
};

function makeActor() {
  const machine = createMigrationMachine().provide({
    actors: {
      analyze: fromPromise(async () => fixtureAnalysis),
      plan: fromPromise(async () => fixturePlan),
      executeStep: fromPromise(async () => ({
        stepId: "step-1",
        files: [{ name: "App.vue", content: "<t/>" }],
      })),
      verify: fromPromise(async () => fixtureVerification),
    },
  });
  return createActor(machine, { input: { request, maxRetries: 3 } });
}

async function collectEvents(actor: ReturnType<typeof makeActor>) {
  const events: ReturnType<typeof diffSnapshots> = [];
  // null prev so the first subscription emission emits phase:started for the initial state
  let prev: Parameters<typeof diffSnapshots>[0] = null;
  actor.subscribe((snap) => {
    const newEvents = diffSnapshots(prev, snap);
    events.push(...newEvents);
    prev = snap;
  });
  actor.start();
  await new Promise<void>((resolve) => {
    const sub = actor.subscribe((snap) => {
      // also stop on 'failed' — it is not a final XState state (status stays 'active')
      if (
        snap.status === "done" ||
        snap.status === "error" ||
        snap.value === "failed"
      ) {
        sub.unsubscribe();
        resolve();
      }
    });
  });
  return events;
}

describe("diffSnapshots", () => {
  it("emits phase:started when entering analyzing", async () => {
    const actor = makeActor();
    const events = await collectEvents(actor);
    const phaseStarted = events.filter(
      (e) =>
        e.type === "phase" && e.phase === "analyzing" && e.status === "started",
    );
    expect(phaseStarted.length).toBeGreaterThan(0);
  });

  it("emits phase:started for all 4 phases", async () => {
    const actor = makeActor();
    const events = await collectEvents(actor);
    for (const phase of [
      "analyzing",
      "planning",
      "executing",
      "verifying",
    ] as const) {
      const started = events.filter(
        (e) =>
          e.type === "phase" && e.phase === phase && e.status === "started",
      );
      expect(started.length).toBeGreaterThan(0);
    }
  });

  it("emits phase:completed when leaving a phase successfully", async () => {
    const actor = makeActor();
    const events = await collectEvents(actor);
    const completed = events.filter(
      (e) => e.type === "phase" && e.status === "completed",
    );
    expect(completed.length).toBeGreaterThan(0);
  });

  it("emits plan event when planning completes", async () => {
    const actor = makeActor();
    const events = await collectEvents(actor);
    const planEvent = events.find((e) => e.type === "plan");
    expect(planEvent).toBeDefined();
    expect(
      (planEvent as { type: "plan"; plan: MigrationPlan }).plan.strategy,
    ).toBe("s");
  });

  it("emits step events during execution", async () => {
    const actor = makeActor();
    const events = await collectEvents(actor);
    const stepEvents = events.filter((e) => e.type === "step");
    expect(stepEvents.length).toBeGreaterThan(0);
  });

  it("emits error event with retryable:true when failing", async () => {
    const machine = createMigrationMachine().provide({
      actors: {
        analyze: fromPromise(async () => {
          throw new Error("fail");
        }),
        plan: fromPromise(async () => fixturePlan),
        executeStep: fromPromise(async () => ({ stepId: "step-1", files: [] })),
        verify: fromPromise(async () => fixtureVerification),
      },
    });
    const actor = createActor(machine, { input: { request, maxRetries: 0 } });
    const events = await collectEvents(actor);

    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(
      (errorEvent as { type: "error"; retryable: boolean }).retryable,
    ).toBe(true);
  });

  it("emits retrying phase event on auto-retry", async () => {
    let calls = 0;
    const machine = createMigrationMachine().provide({
      actors: {
        analyze: fromPromise(async () => {
          calls++;
          if (calls <= 1) throw new Error("transient");
          return fixtureAnalysis;
        }),
        plan: fromPromise(async () => fixturePlan),
        executeStep: fromPromise(async () => ({ stepId: "step-1", files: [] })),
        verify: fromPromise(async () => fixtureVerification),
      },
    });
    const actor = createActor(machine, { input: { request, maxRetries: 3 } });
    const events = await collectEvents(actor);
    const retrying = events.filter(
      (e) => e.type === "phase" && e.status === "retrying",
    );
    expect(retrying.length).toBeGreaterThan(0);
  });

  it("returns empty array when snapshot has not changed", () => {
    const actor = makeActor();
    const snap = actor.getSnapshot();
    const events = diffSnapshots(snap, snap);
    expect(events).toHaveLength(0);
  });
});
