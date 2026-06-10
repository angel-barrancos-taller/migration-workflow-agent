import {
  buildAnalysisPrompt,
  buildPlanningPrompt,
  buildExecutionPrompt,
  buildVerificationPrompt,
} from "./index";
import type {
  MigrationRequest,
  AnalysisResult,
  MigrationPlan,
  MigratedFile,
} from "@/lib/schemas/migration";

const request: MigrationRequest = {
  files: [
    { name: "App.tsx", content: "function App() { return <div>Hello</div>; }" },
  ],
  source: "react",
  target: "vue",
};

const analysis: AnalysisResult = {
  summary: "Simple React app with one component",
  components: [{ name: "App", file: "App.tsx", role: "root" }],
  patterns: ["JSX"],
  risks: [],
};

const plan: MigrationPlan = {
  strategy: "component by component",
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

describe("buildAnalysisPrompt", () => {
  it("includes source and target frameworks", () => {
    const { system, user } = buildAnalysisPrompt(request);
    expect(system).toContain("react");
    expect(system).toContain("vue");
  });

  it("includes all source file names in user prompt", () => {
    const { user } = buildAnalysisPrompt(request);
    expect(user).toContain("App.tsx");
  });

  it("includes file content in user prompt", () => {
    const { user } = buildAnalysisPrompt(request);
    expect(user).toContain("function App()");
  });

  it("includes JSON schema instruction in system prompt", () => {
    const { system } = buildAnalysisPrompt(request);
    expect(system).toMatch(/JSON/i);
  });

  it("includes framework-specific guidance", () => {
    const { system } = buildAnalysisPrompt(request);
    expect(system).toContain("useState");
  });
});

describe("buildPlanningPrompt", () => {
  it("includes analysis summary", () => {
    const { user } = buildPlanningPrompt(request, analysis);
    expect(user).toContain("Simple React app");
  });

  it("includes source and target frameworks", () => {
    const { system } = buildPlanningPrompt(request, analysis);
    expect(system).toContain("react");
    expect(system).toContain("vue");
  });

  it("includes file names", () => {
    const { user } = buildPlanningPrompt(request, analysis);
    expect(user).toContain("App.tsx");
  });

  it("instructs to output JSON", () => {
    const { system } = buildPlanningPrompt(request, analysis);
    expect(system).toMatch(/JSON/i);
  });
});

describe("buildExecutionPrompt", () => {
  const step = plan.steps[0];

  it("includes the step description", () => {
    const { user } = buildExecutionPrompt(request, analysis, plan, step, []);
    expect(user).toContain("Migrate App component");
  });

  it("includes the source file content for files referenced in the step", () => {
    const { user } = buildExecutionPrompt(request, analysis, plan, step, []);
    expect(user).toContain("function App()");
  });

  it("includes target framework name", () => {
    const { system } = buildExecutionPrompt(request, analysis, plan, step, []);
    expect(system).toContain("vue");
  });

  it("includes prior results when present", () => {
    const priorResults = [
      { stepId: "step-0", files: [{ name: "utils.ts", content: "export {}" }] },
    ];
    const { user } = buildExecutionPrompt(
      request,
      analysis,
      plan,
      step,
      priorResults,
    );
    expect(user).toContain("step-0");
  });

  it("instructs to output JSON", () => {
    const { system } = buildExecutionPrompt(request, analysis, plan, step, []);
    expect(system).toMatch(/JSON/i);
  });
});

describe("buildVerificationPrompt", () => {
  const migratedFiles: MigratedFile[] = [
    {
      name: "App.vue",
      content: "<template><div>Hello</div></template>",
      sourceFile: "App.tsx",
    },
  ];

  it("includes migrated file names", () => {
    const { user } = buildVerificationPrompt(request, plan, migratedFiles);
    expect(user).toContain("App.vue");
  });

  it("includes verification checklist items", () => {
    const { system } = buildVerificationPrompt(request, plan, migratedFiles);
    expect(system).toContain("defineProps");
  });

  it("includes target framework", () => {
    const { system } = buildVerificationPrompt(request, plan, migratedFiles);
    expect(system).toContain("vue");
  });

  it("instructs to output JSON", () => {
    const { system } = buildVerificationPrompt(request, plan, migratedFiles);
    expect(system).toMatch(/JSON/i);
  });
});
