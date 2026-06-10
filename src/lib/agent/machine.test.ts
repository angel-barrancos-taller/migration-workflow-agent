import { createActor, fromPromise, toPromise } from "xstate";
import { createMigrationMachine } from "./machine";
import type {
  MigrationRequest,
  AnalysisResult,
  MigrationPlan,
  VerificationResult,
  StepExecutionResult,
} from "@/lib/schemas/migration";

const request: MigrationRequest = {
  files: [
    { name: "App.tsx", content: "function App() { return <div/> }" },
    { name: "utils.ts", content: "export const x = 1" },
  ],
  source: "react",
  target: "vue",
};

const fixtureAnalysis: AnalysisResult = {
  summary: "Simple React app",
  components: [{ name: "App", file: "App.tsx", role: "root" }],
  patterns: ["JSX"],
  risks: [],
};

const fixturePlan: MigrationPlan = {
  strategy: "component by component",
  steps: [
    {
      id: "step-1",
      description: "Migrate App",
      files: ["App.tsx"],
      dependencies: [],
      complexity: "low",
      status: "pending",
    },
    {
      id: "step-2",
      description: "Migrate utils",
      files: ["utils.ts"],
      dependencies: ["step-1"],
      complexity: "low",
      status: "pending",
    },
  ],
};

const fixtureVerification: VerificationResult = {
  passed: true,
  issues: [],
  summary: "All checks passed",
};

function makeStepResult(stepId: string): StepExecutionResult {
  return { stepId, files: [{ name: `${stepId}.vue`, content: "<template/>" }] };
}

function makeHappyPathMachine() {
  const machine = createMigrationMachine();
  return machine.provide({
    actors: {
      analyze: fromPromise(async () => fixtureAnalysis),
      plan: fromPromise(async () => fixturePlan),
      executeStep: fromPromise(async ({ input }) =>
        makeStepResult((input as { step: { id: string } }).step.id),
      ),
      verify: fromPromise(async () => fixtureVerification),
    },
  });
}

describe("happy path", () => {
  it("transitions through all phases and reaches done", async () => {
    const actor = createActor(makeHappyPathMachine(), {
      input: { request, maxRetries: 3 },
    });
    const states: string[] = [];
    actor.subscribe((snap) => states.push(String(snap.value)));
    actor.start();
    await toPromise(actor);

    expect(states).toContain("analyzing");
    expect(states).toContain("planning");
    expect(states).toContain("executing");
    expect(states).toContain("verifying");
    expect(states[states.length - 1]).toBe("done");
  });

  it("output contains success:true and migrated files", async () => {
    const actor = createActor(makeHappyPathMachine(), {
      input: { request, maxRetries: 3 },
    });
    actor.start();
    const output = await toPromise(actor);
    expect(output.success).toBe(true);
    expect(output.migratedFiles.length).toBeGreaterThan(0);
    expect(output.verification?.passed).toBe(true);
  });

  it("executes one step per plan step", async () => {
    const executeStep = jest
      .fn()
      .mockImplementation(async ({ input }) =>
        makeStepResult((input as { step: { id: string } }).step.id),
      );
    const machine = createMigrationMachine().provide({
      actors: {
        analyze: fromPromise(async () => fixtureAnalysis),
        plan: fromPromise(async () => fixturePlan),
        executeStep: fromPromise(executeStep),
        verify: fromPromise(async () => fixtureVerification),
      },
    });
    const actor = createActor(machine, { input: { request, maxRetries: 3 } });
    actor.start();
    await toPromise(actor);
    expect(executeStep).toHaveBeenCalledTimes(fixturePlan.steps.length);
  });

  it("passes prior step results to subsequent steps", async () => {
    const stepInputs: Array<{
      step: { id: string };
      priorResults: StepExecutionResult[];
    }> = [];
    const executeStep = jest.fn().mockImplementation(async ({ input }) => {
      stepInputs.push(
        input as { step: { id: string }; priorResults: StepExecutionResult[] },
      );
      return makeStepResult((input as { step: { id: string } }).step.id);
    });
    const machine = createMigrationMachine().provide({
      actors: {
        analyze: fromPromise(async () => fixtureAnalysis),
        plan: fromPromise(async () => fixturePlan),
        executeStep: fromPromise(executeStep),
        verify: fromPromise(async () => fixtureVerification),
      },
    });
    const actor = createActor(machine, { input: { request, maxRetries: 3 } });
    actor.start();
    await toPromise(actor);

    expect(stepInputs[0].priorResults).toHaveLength(0);
    expect(stepInputs[1].priorResults).toHaveLength(1);
    expect(stepInputs[1].priorResults[0].stepId).toBe("step-1");
  });
});

describe("step status lifecycle", () => {
  it("marks steps completed after execution", async () => {
    const actor = createActor(makeHappyPathMachine(), {
      input: { request, maxRetries: 3 },
    });
    actor.start();
    const output = await toPromise(actor);
    for (const step of output.plan.steps) {
      expect(step.status).toBe("completed");
    }
  });
});

describe("retry behavior", () => {
  it("auto-retries analysis up to maxRetries times then lands in failed", async () => {
    const machine = createMigrationMachine().provide({
      actors: {
        analyze: fromPromise(async () => {
          throw new Error("LLM error");
        }),
        plan: fromPromise(async () => fixturePlan),
        executeStep: fromPromise(async ({ input }) =>
          makeStepResult((input as { step: { id: string } }).step.id),
        ),
        verify: fromPromise(async () => fixtureVerification),
      },
    });
    const actor = createActor(machine, { input: { request, maxRetries: 3 } });
    actor.start();

    await new Promise<void>((resolve) => {
      actor.subscribe((snap) => {
        if (snap.value === "failed") resolve();
      });
    });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("failed");
    expect(snap.context.failedPhase).toBe("analyzing");
    expect(snap.context.retryCount).toBe(3);
  });

  it("recovers when analysis fails then succeeds", async () => {
    let attempts = 0;
    const machine = createMigrationMachine().provide({
      actors: {
        analyze: fromPromise(async () => {
          attempts++;
          if (attempts < 3) throw new Error("transient");
          return fixtureAnalysis;
        }),
        plan: fromPromise(async () => fixturePlan),
        executeStep: fromPromise(async ({ input }) =>
          makeStepResult((input as { step: { id: string } }).step.id),
        ),
        verify: fromPromise(async () => fixtureVerification),
      },
    });
    const actor = createActor(machine, { input: { request, maxRetries: 3 } });
    actor.start();
    const output = await toPromise(actor);
    expect(output.success).toBe(true);
  });

  it("records errors in context on each retry", async () => {
    let calls = 0;
    const machine = createMigrationMachine().provide({
      actors: {
        analyze: fromPromise(async () => {
          calls++;
          throw new Error(`failure #${calls}`);
        }),
        plan: fromPromise(async () => fixturePlan),
        executeStep: fromPromise(async ({ input }) =>
          makeStepResult((input as { step: { id: string } }).step.id),
        ),
        verify: fromPromise(async () => fixtureVerification),
      },
    });
    const actor = createActor(machine, { input: { request, maxRetries: 2 } });
    actor.start();
    await new Promise<void>((resolve) => {
      actor.subscribe((snap) => {
        if (snap.value === "failed") resolve();
      });
    });
    expect(actor.getSnapshot().context.errors.length).toBeGreaterThan(0);
  });
});

describe("RETRY event (manual retry from failed state)", () => {
  it("resumes from analyzing when analysis failed", async () => {
    let analyzeCount = 0;
    const machine = createMigrationMachine().provide({
      actors: {
        analyze: fromPromise(async () => {
          analyzeCount++;
          // maxRetries=3 means 4 attempts total before failed; fail all 4, succeed on 5th (post-RETRY)
          if (analyzeCount <= 4) throw new Error("fail");
          return fixtureAnalysis;
        }),
        plan: fromPromise(async () => fixturePlan),
        executeStep: fromPromise(async ({ input }) =>
          makeStepResult((input as { step: { id: string } }).step.id),
        ),
        verify: fromPromise(async () => fixtureVerification),
      },
    });
    const actor = createActor(machine, { input: { request, maxRetries: 3 } });
    actor.start();

    // Wait for failed state
    await new Promise<void>((resolve) => {
      actor.subscribe((snap) => {
        if (snap.value === "failed") resolve();
      });
    });

    expect(actor.getSnapshot().value).toBe("failed");

    // Now provide a path to success and send RETRY
    const output = await new Promise<
      ReturnType<typeof actor.getSnapshot>["output"]
    >((resolve, reject) => {
      actor.subscribe((snap) => {
        if (snap.status === "done") resolve(snap.output);
        if (snap.status === "error") reject(snap.error);
      });
      actor.send({ type: "RETRY" });
    });

    expect(output?.success).toBe(true);
  });

  it("resets retryCount on RETRY", async () => {
    let analyzeCount = 0;
    const machine = createMigrationMachine().provide({
      actors: {
        analyze: fromPromise(async () => {
          analyzeCount++;
          if (analyzeCount <= 4) throw new Error("fail");
          return fixtureAnalysis;
        }),
        plan: fromPromise(async () => fixturePlan),
        executeStep: fromPromise(async ({ input }) =>
          makeStepResult((input as { step: { id: string } }).step.id),
        ),
        verify: fromPromise(async () => fixtureVerification),
      },
    });
    const actor = createActor(machine, { input: { request, maxRetries: 3 } });
    actor.start();

    await new Promise<void>((resolve) => {
      actor.subscribe((snap) => {
        if (snap.value === "failed") resolve();
      });
    });

    await new Promise<void>((resolve) => {
      actor.subscribe((snap) => {
        if (snap.status === "done") resolve();
      });
      actor.send({ type: "RETRY" });
    });

    expect(actor.getSnapshot().context.retryCount).toBe(0);
  });

  it("preserves completed phase context (analysis) when resuming from later phase", async () => {
    let planCount = 0;
    const machine = createMigrationMachine().provide({
      actors: {
        analyze: fromPromise(async () => fixtureAnalysis),
        plan: fromPromise(async () => {
          planCount++;
          // maxRetries=3 → 4 attempts before failed; fail all 4, succeed on 5th (post-RETRY)
          if (planCount <= 4) throw new Error("plan fail");
          return fixturePlan;
        }),
        executeStep: fromPromise(async ({ input }) =>
          makeStepResult((input as { step: { id: string } }).step.id),
        ),
        verify: fromPromise(async () => fixtureVerification),
      },
    });
    const actor = createActor(machine, { input: { request, maxRetries: 3 } });
    actor.start();

    await new Promise<void>((resolve) => {
      actor.subscribe((snap) => {
        if (snap.value === "failed") resolve();
      });
    });

    // Analysis should have succeeded and be stored in context
    expect(actor.getSnapshot().context.analysis?.summary).toBe(
      "Simple React app",
    );

    await new Promise<void>((resolve) => {
      actor.subscribe((snap) => {
        if (snap.status === "done") resolve();
      });
      actor.send({ type: "RETRY" });
    });

    expect(actor.getSnapshot().output?.success).toBe(true);
  });
});
