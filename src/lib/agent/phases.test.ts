import { runAnalysis, runPlanning, runStep, runVerification } from "./phases";
import type { LlmClient } from "@/lib/llm/client";
import type {
  MigrationRequest,
  AnalysisResult,
  MigrationPlan,
  VerificationResult,
  StepExecutionResult,
} from "@/lib/schemas/migration";

const request: MigrationRequest = {
  files: [{ name: "App.tsx", content: "function App() { return <div/> }" }],
  source: "react",
  target: "vue",
};

const fixtureAnalysis: AnalysisResult = {
  summary: "A simple React app",
  components: [{ name: "App", file: "App.tsx", role: "root" }],
  patterns: ["JSX", "function component"],
  risks: [],
};

const fixturePlan: MigrationPlan = {
  strategy: "Migrate component by component",
  steps: [
    {
      id: "step-1",
      description: "Migrate App component",
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
  summary: "All checks passed",
};

function makeFakeClient(returnValue: unknown): LlmClient {
  return {
    completeJson: jest.fn().mockResolvedValue(returnValue),
  };
}

describe("runAnalysis", () => {
  it("returns parsed AnalysisResult", async () => {
    const client = makeFakeClient(fixtureAnalysis);
    const result = await runAnalysis(client, request);
    expect(result.summary).toBe("A simple React app");
    expect(result.components).toHaveLength(1);
  });

  it("calls completeJson once", async () => {
    const client = makeFakeClient(fixtureAnalysis);
    await runAnalysis(client, request);
    expect(client.completeJson).toHaveBeenCalledTimes(1);
  });

  it("passes schemaName to completeJson", async () => {
    const client = makeFakeClient(fixtureAnalysis);
    await runAnalysis(client, request);
    expect(client.completeJson).toHaveBeenCalledWith(
      expect.objectContaining({ schemaName: expect.any(String) }),
    );
  });
});

describe("runPlanning", () => {
  it("returns plan with steps having pending status", async () => {
    // LLM returns steps without status; runPlanning adds it
    const llmPlan = {
      strategy: "Migrate component by component",
      steps: [
        {
          id: "step-1",
          description: "Migrate App",
          files: ["App.tsx"],
          dependencies: [],
          complexity: "low",
        },
      ],
    };
    const client = makeFakeClient(llmPlan);
    const result = await runPlanning(client, request, fixtureAnalysis);
    expect(result.steps[0].status).toBe("pending");
  });

  it("preserves strategy and step descriptions", async () => {
    const llmPlan = {
      strategy: "one by one",
      steps: [
        {
          id: "s1",
          description: "do thing",
          files: [],
          dependencies: [],
          complexity: "high",
        },
      ],
    };
    const client = makeFakeClient(llmPlan);
    const result = await runPlanning(client, request, fixtureAnalysis);
    expect(result.strategy).toBe("one by one");
    expect(result.steps[0].description).toBe("do thing");
  });
});

describe("runStep", () => {
  it("returns StepExecutionResult with correct stepId", async () => {
    const fixtureResult: StepExecutionResult = {
      stepId: "step-1",
      files: [{ name: "App.vue", content: "<template/>" }],
    };
    const client = makeFakeClient(fixtureResult);
    const step = fixturePlan.steps[0];
    const result = await runStep(
      client,
      request,
      fixtureAnalysis,
      fixturePlan,
      step,
      [],
    );
    expect(result.stepId).toBe("step-1");
    expect(result.files).toHaveLength(1);
  });

  it("passes prior results to prompt builder", async () => {
    const fixtureResult: StepExecutionResult = { stepId: "step-1", files: [] };
    const client = makeFakeClient(fixtureResult);
    const priorResults: StepExecutionResult[] = [
      { stepId: "step-0", files: [{ name: "util.ts", content: "export {}" }] },
    ];
    await runStep(
      client,
      request,
      fixtureAnalysis,
      fixturePlan,
      fixturePlan.steps[0],
      priorResults,
    );
    const callArg = (client.completeJson as jest.Mock).mock.calls[0][0];
    expect(callArg.user).toContain("step-0");
  });
});

describe("runVerification", () => {
  it("returns VerificationResult", async () => {
    const client = makeFakeClient(fixtureVerification);
    const migratedFiles = [{ name: "App.vue", content: "<template/>" }];
    const result = await runVerification(
      client,
      request,
      fixturePlan,
      migratedFiles,
    );
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
