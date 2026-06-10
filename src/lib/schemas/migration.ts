import { z } from "zod";

export const FrameworkSchema = z.enum([
  "react",
  "vue",
  "express",
  "fastify",
  "jquery",
]);
export type Framework = z.infer<typeof FrameworkSchema>;

export const SUPPORTED_PAIRS: { source: Framework; target: Framework }[] = [
  { source: "react", target: "vue" },
  { source: "vue", target: "react" },
  { source: "express", target: "fastify" },
  { source: "jquery", target: "react" },
];

export const SourceFileSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
});
export type SourceFile = z.infer<typeof SourceFileSchema>;

export const MigrationRequestSchema = z
  .object({
    files: z.array(SourceFileSchema).min(1),
    source: FrameworkSchema,
    target: FrameworkSchema,
  })
  .refine(
    (r) =>
      SUPPORTED_PAIRS.some(
        (p) => p.source === r.source && p.target === r.target,
      ),
    { message: "Unsupported migration pair" },
  );
export type MigrationRequest = z.infer<typeof MigrationRequestSchema>;

// LLM-output schema — no status; model never decides step state
export const PlanStepLlmSchema = z.object({
  id: z.string(),
  description: z.string(),
  files: z.array(z.string()),
  dependencies: z.array(z.string()),
  complexity: z.enum(["low", "medium", "high"]),
});
export type PlanStepLlm = z.infer<typeof PlanStepLlmSchema>;

// Runtime schema — extends with tracked status
export const PlanStepSchema = PlanStepLlmSchema.extend({
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const MigrationPlanSchema = z.object({
  strategy: z.string(),
  steps: z.array(PlanStepSchema).min(1),
});
export type MigrationPlan = z.infer<typeof MigrationPlanSchema>;

export const MigratedFileSchema = z.object({
  name: z.string(),
  content: z.string(),
  sourceFile: z.string().optional(),
});
export type MigratedFile = z.infer<typeof MigratedFileSchema>;

export const StepExecutionResultSchema = z.object({
  stepId: z.string(),
  files: z.array(MigratedFileSchema),
  notes: z.string().optional(),
});
export type StepExecutionResult = z.infer<typeof StepExecutionResultSchema>;

export const AnalysisResultSchema = z.object({
  summary: z.string(),
  components: z.array(
    z.object({
      name: z.string(),
      file: z.string(),
      role: z.string(),
    }),
  ),
  patterns: z.array(z.string()),
  risks: z.array(z.string()),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const VerificationResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(
    z.object({
      severity: z.enum(["error", "warning"]),
      file: z.string(),
      message: z.string(),
    }),
  ),
  summary: z.string(),
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export const MigrationResponseSchema = z.object({
  success: z.boolean(),
  jobId: z.string(),
  migratedFiles: z.array(MigratedFileSchema),
  plan: MigrationPlanSchema,
  verification: VerificationResultSchema.nullable(),
  errors: z.array(z.string()),
});
export type MigrationResponse = z.infer<typeof MigrationResponseSchema>;
