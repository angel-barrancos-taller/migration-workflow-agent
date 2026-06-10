import {
  FrameworkSchema,
  MigrationRequestSchema,
  AnalysisResultSchema,
  PlanStepSchema,
  PlanStepLlmSchema,
  MigrationPlanSchema,
  MigratedFileSchema,
  StepExecutionResultSchema,
  VerificationResultSchema,
  MigrationResponseSchema,
  SUPPORTED_PAIRS,
} from "./migration";

describe("FrameworkSchema", () => {
  it("accepts valid frameworks", () => {
    expect(FrameworkSchema.parse("react")).toBe("react");
    expect(FrameworkSchema.parse("vue")).toBe("vue");
    expect(FrameworkSchema.parse("express")).toBe("express");
    expect(FrameworkSchema.parse("fastify")).toBe("fastify");
    expect(FrameworkSchema.parse("jquery")).toBe("jquery");
  });

  it("rejects unknown frameworks", () => {
    expect(() => FrameworkSchema.parse("angular")).toThrow();
  });
});

describe("MigrationRequestSchema", () => {
  const validRequest = {
    files: [{ name: "App.tsx", content: "const x = 1" }],
    source: "react",
    target: "vue",
  };

  it("accepts valid requests for supported pairs", () => {
    expect(() => MigrationRequestSchema.parse(validRequest)).not.toThrow();
  });

  it("rejects empty files array", () => {
    expect(() =>
      MigrationRequestSchema.parse({ ...validRequest, files: [] }),
    ).toThrow();
  });

  it("rejects files with empty name", () => {
    expect(() =>
      MigrationRequestSchema.parse({
        ...validRequest,
        files: [{ name: "", content: "x" }],
      }),
    ).toThrow();
  });

  it("rejects files with empty content", () => {
    expect(() =>
      MigrationRequestSchema.parse({
        ...validRequest,
        files: [{ name: "x.ts", content: "" }],
      }),
    ).toThrow();
  });

  it.each([
    ["react", "vue"],
    ["vue", "react"],
    ["express", "fastify"],
    ["jquery", "react"],
  ])("accepts supported pair %s -> %s", (source, target) => {
    expect(() =>
      MigrationRequestSchema.parse({ ...validRequest, source, target }),
    ).not.toThrow();
  });

  it("rejects unsupported pair", () => {
    expect(() =>
      MigrationRequestSchema.parse({
        ...validRequest,
        source: "react",
        target: "fastify",
      }),
    ).toThrow();
  });

  it("rejects same source and target", () => {
    expect(() =>
      MigrationRequestSchema.parse({
        ...validRequest,
        source: "react",
        target: "react",
      }),
    ).toThrow();
  });
});

describe("SUPPORTED_PAIRS", () => {
  it("contains all 4 expected pairs", () => {
    expect(SUPPORTED_PAIRS).toContainEqual({ source: "react", target: "vue" });
    expect(SUPPORTED_PAIRS).toContainEqual({ source: "vue", target: "react" });
    expect(SUPPORTED_PAIRS).toContainEqual({
      source: "express",
      target: "fastify",
    });
    expect(SUPPORTED_PAIRS).toContainEqual({
      source: "jquery",
      target: "react",
    });
  });
});

describe("PlanStepLlmSchema", () => {
  it("does not include status field", () => {
    const step = {
      id: "step-1",
      description: "Migrate component",
      files: ["App.tsx"],
      dependencies: [],
      complexity: "low",
    };
    const parsed = PlanStepLlmSchema.parse(step);
    expect(parsed).not.toHaveProperty("status");
  });

  it("rejects invalid complexity", () => {
    expect(() =>
      PlanStepLlmSchema.parse({
        id: "s1",
        description: "d",
        files: [],
        dependencies: [],
        complexity: "extreme",
      }),
    ).toThrow();
  });
});

describe("PlanStepSchema", () => {
  it("includes status field", () => {
    const step = {
      id: "step-1",
      description: "Migrate component",
      files: ["App.tsx"],
      dependencies: [],
      complexity: "low",
      status: "pending",
    };
    expect(PlanStepSchema.parse(step).status).toBe("pending");
  });

  it("accepts all valid statuses", () => {
    const base = {
      id: "s1",
      description: "d",
      files: [],
      dependencies: [],
      complexity: "low",
    };
    for (const status of ["pending", "in_progress", "completed", "failed"]) {
      expect(PlanStepSchema.parse({ ...base, status }).status).toBe(status);
    }
  });
});

describe("AnalysisResultSchema", () => {
  it("parses a valid analysis result", () => {
    const result = {
      summary: "A React app with hooks",
      components: [{ name: "App", file: "App.tsx", role: "root" }],
      patterns: ["useState", "useEffect"],
      risks: ["complex state management"],
    };
    expect(() => AnalysisResultSchema.parse(result)).not.toThrow();
  });
});

describe("VerificationResultSchema", () => {
  it("parses a passing verification", () => {
    const result = { passed: true, issues: [], summary: "All good" };
    expect(VerificationResultSchema.parse(result).passed).toBe(true);
  });

  it("parses a failing verification with issues", () => {
    const result = {
      passed: false,
      issues: [
        {
          severity: "error",
          file: "App.vue",
          message: "Missing template root",
        },
      ],
      summary: "Found 1 error",
    };
    expect(VerificationResultSchema.parse(result).issues).toHaveLength(1);
  });

  it("rejects invalid severity", () => {
    const result = {
      passed: false,
      issues: [{ severity: "critical", file: "App.vue", message: "msg" }],
      summary: "fail",
    };
    expect(() => VerificationResultSchema.parse(result)).toThrow();
  });
});

describe("MigrationResponseSchema", () => {
  it("parses a complete response", () => {
    const response = {
      success: true,
      jobId: "abc-123",
      migratedFiles: [{ name: "App.vue", content: "<template/>" }],
      plan: {
        strategy: "component by component",
        steps: [
          {
            id: "s1",
            description: "Migrate App",
            files: ["App.tsx"],
            dependencies: [],
            complexity: "low",
            status: "completed",
          },
        ],
      },
      verification: { passed: true, issues: [], summary: "OK" },
      errors: [],
    };
    expect(() => MigrationResponseSchema.parse(response)).not.toThrow();
  });

  it("accepts null verification", () => {
    const response = {
      success: false,
      jobId: "abc-123",
      migratedFiles: [],
      plan: {
        strategy: "s",
        steps: [
          {
            id: "s1",
            description: "d",
            files: [],
            dependencies: [],
            complexity: "low",
            status: "failed",
          },
        ],
      },
      verification: null,
      errors: ["LLM failed"],
    };
    expect(MigrationResponseSchema.parse(response).verification).toBeNull();
  });
});
