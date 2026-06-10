import { z } from "zod";
import {
  AnalysisResultSchema,
  MigrationPlanSchema,
  StepExecutionResultSchema,
  VerificationResultSchema,
  type MigrationRequest,
  type AnalysisResult,
  type MigrationPlan,
  type PlanStep,
  type StepExecutionResult,
  type MigratedFile,
} from "@/lib/schemas/migration";
import { getFrameworkPair } from "@/lib/agent/frameworks";

interface Prompt {
  system: string;
  user: string;
}

function jsonSchemaInstruction(schema: z.ZodType): string {
  const jsonSchema = z.toJSONSchema(schema);
  return `Respond with ONLY a JSON object matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
}

function formatFiles(files: { name: string; content: string }[]): string {
  return files
    .map((f) => `### ${f.name}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");
}

export function buildAnalysisPrompt(request: MigrationRequest): Prompt {
  const pair = getFrameworkPair(request.source, request.target);

  const system = `You are an expert code migration assistant specializing in migrating ${request.source} code to ${request.target}.

Your task is to analyze source code files and produce a structured analysis.

Migration guidance:
${pair?.guidance ?? ""}

${jsonSchemaInstruction(AnalysisResultSchema)}`;

  const user = `Analyze the following ${request.source} source files for migration to ${request.target}.

${formatFiles(request.files)}

Identify all components, patterns, and potential migration risks.`;

  return { system, user };
}

export function buildPlanningPrompt(
  request: MigrationRequest,
  analysis: AnalysisResult,
): Prompt {
  const pair = getFrameworkPair(request.source, request.target);

  // PlanStepLlm schema — no status field exposed to the LLM
  const planLlmSchema = z.object({
    strategy: z.string(),
    steps: z.array(
      z.object({
        id: z.string(),
        description: z.string(),
        files: z.array(z.string()),
        dependencies: z.array(z.string()),
        complexity: z.enum(["low", "medium", "high"]),
      }),
    ),
  });

  const system = `You are an expert code migration assistant creating a migration plan from ${request.source} to ${request.target}.

Migration guidance:
${pair?.guidance ?? ""}

${jsonSchemaInstruction(planLlmSchema)}`;

  const user = `Create a step-by-step migration plan based on this analysis.

## Analysis
${analysis.summary}

Components: ${analysis.components.map((c) => `${c.name} (${c.file})`).join(", ")}
Patterns detected: ${analysis.patterns.join(", ")}
Risks: ${analysis.risks.join(", ") || "none"}

## Source files
${request.files.map((f) => `- ${f.name}`).join("\n")}

Each step should target specific files and have clear dependencies on prior steps.`;

  return { system, user };
}

export function buildExecutionPrompt(
  request: MigrationRequest,
  analysis: AnalysisResult,
  plan: MigrationPlan,
  step: PlanStep,
  priorResults: StepExecutionResult[],
): Prompt {
  const pair = getFrameworkPair(request.source, request.target);

  // Only include source files referenced in this step
  const relevantFiles = request.files.filter((f) =>
    step.files.includes(f.name),
  );
  const allFiles = relevantFiles.length > 0 ? relevantFiles : request.files;

  const system = `You are an expert code migration assistant. Execute this migration step, converting ${request.source} code to ${request.target}.

Migration guidance:
${pair?.guidance ?? ""}

${jsonSchemaInstruction(StepExecutionResultSchema)}`;

  const priorResultsSection =
    priorResults.length > 0
      ? `\n## Previously migrated files\n${priorResults
          .map(
            (r) =>
              `Step ${r.stepId}:\n${r.files.map((f) => `- ${f.name}`).join("\n")}`,
          )
          .join("\n")}\n`
      : "";

  const user = `Execute migration step: **${step.description}**

Step ID: ${step.id}
Complexity: ${step.complexity}
Files to migrate: ${step.files.join(", ")}
Dependencies: ${step.dependencies.join(", ") || "none"}

## Migration context
Source: ${request.source} → Target: ${request.target}
Strategy: ${plan.strategy}
${priorResultsSection}
## Source files for this step
${formatFiles(allFiles)}

Generate the complete migrated file contents for each file in this step.`;

  return { system, user };
}

export function buildVerificationPrompt(
  request: MigrationRequest,
  plan: MigrationPlan,
  migratedFiles: MigratedFile[],
): Prompt {
  const pair = getFrameworkPair(request.source, request.target);

  const checklist = pair?.verificationChecklist ?? [];

  const system = `You are an expert code reviewer verifying a migration from ${request.source} to ${request.target}.

Verification checklist:
${checklist.map((item, i) => `${i + 1}. ${item}`).join("\n")}

${jsonSchemaInstruction(VerificationResultSchema)}`;

  const user = `Verify the following migrated ${request.target} files are correct.

## Migration plan
Strategy: ${plan.strategy}
Steps completed: ${plan.steps.length}

## Migrated files
${formatFiles(migratedFiles.map((f) => ({ name: f.name, content: f.content })))}

Check each file against the verification checklist. Report any errors or warnings.`;

  return { system, user };
}
