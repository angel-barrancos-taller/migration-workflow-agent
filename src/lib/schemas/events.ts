import { z } from "zod";
import { MigrationResponseSchema, MigrationPlanSchema } from "./migration";

export const SseJobEventSchema = z.object({
  type: z.literal("job"),
  jobId: z.string(),
});

export const SsePhaseEventSchema = z.object({
  type: z.literal("phase"),
  phase: z.enum(["analyzing", "planning", "executing", "verifying"]),
  status: z.enum(["started", "completed", "failed", "retrying"]),
  retryCount: z.number(),
});

export const SsePlanEventSchema = z.object({
  type: z.literal("plan"),
  plan: MigrationPlanSchema,
});

export const SseStepEventSchema = z.object({
  type: z.literal("step"),
  stepId: z.string(),
  index: z.number(),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
});

export const SseResultEventSchema = z.object({
  type: z.literal("result"),
  ...MigrationResponseSchema.shape,
});

export const SseErrorEventSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
  retryable: z.boolean(),
  failedPhase: z
    .enum(["analyzing", "planning", "executing", "verifying"])
    .nullable(),
});

export const SseEventSchema = z.discriminatedUnion("type", [
  SseJobEventSchema,
  SsePhaseEventSchema,
  SsePlanEventSchema,
  SseStepEventSchema,
  SseResultEventSchema,
  SseErrorEventSchema,
]);

export type SseEvent = z.infer<typeof SseEventSchema>;
export type SseJobEvent = z.infer<typeof SseJobEventSchema>;
export type SsePhaseEvent = z.infer<typeof SsePhaseEventSchema>;
export type SsePlanEvent = z.infer<typeof SsePlanEventSchema>;
export type SseStepEvent = z.infer<typeof SseStepEventSchema>;
export type SseResultEvent = z.infer<typeof SseResultEventSchema>;
export type SseErrorEvent = z.infer<typeof SseErrorEventSchema>;
