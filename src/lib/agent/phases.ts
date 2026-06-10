import { z } from "zod";
import type { LlmClient } from "@/lib/llm/client";
import {
  AnalysisResultSchema,
  PlanStepLlmSchema,
  StepExecutionResultSchema,
  VerificationResultSchema,
  type MigrationRequest,
  type AnalysisResult,
  type MigrationPlan,
  type PlanStep,
  type StepExecutionResult,
  type MigratedFile,
} from "@/lib/schemas/migration";
import {
  buildAnalysisPrompt,
  buildPlanningPrompt,
  buildExecutionPrompt,
  buildVerificationPrompt,
} from "@/lib/llm/prompts";

// LLM plan schema without status — we add it after parsing
const PlanLlmSchema = z.object({
  strategy: z.string(),
  steps: z.array(PlanStepLlmSchema),
});

export async function runAnalysis(
  client: LlmClient,
  request: MigrationRequest,
): Promise<AnalysisResult> {
  const { system, user } = buildAnalysisPrompt(request);
  return client.completeJson({
    schemaName: "AnalysisResult",
    schema: AnalysisResultSchema,
    system,
    user,
  });
}

export async function runPlanning(
  client: LlmClient,
  request: MigrationRequest,
  analysis: AnalysisResult,
): Promise<MigrationPlan> {
  const { system, user } = buildPlanningPrompt(request, analysis);
  const llmPlan = await client.completeJson({
    schemaName: "MigrationPlan",
    schema: PlanLlmSchema,
    system,
    user,
  });

  // Attach 'pending' status to each step — model never decides step state
  return {
    strategy: llmPlan.strategy,
    steps: llmPlan.steps.map((step) => ({
      ...step,
      status: "pending" as const,
    })),
  };
}

export async function runStep(
  client: LlmClient,
  request: MigrationRequest,
  analysis: AnalysisResult,
  plan: MigrationPlan,
  step: PlanStep,
  priorResults: StepExecutionResult[],
): Promise<StepExecutionResult> {
  const { system, user } = buildExecutionPrompt(
    request,
    analysis,
    plan,
    step,
    priorResults,
  );
  return client.completeJson({
    schemaName: "StepExecutionResult",
    schema: StepExecutionResultSchema,
    system,
    user,
  });
}

export async function runVerification(
  client: LlmClient,
  request: MigrationRequest,
  plan: MigrationPlan,
  migratedFiles: MigratedFile[],
): Promise<import("@/lib/schemas/migration").VerificationResult> {
  const { system, user } = buildVerificationPrompt(
    request,
    plan,
    migratedFiles,
  );
  return client.completeJson({
    schemaName: "VerificationResult",
    schema: VerificationResultSchema,
    system,
    user,
  });
}
