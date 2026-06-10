"use client";

import { useState } from "react";
import { NeuCard } from "@/components/ui/NeuCard";
import { MigrationForm } from "@/components/MigrationForm";
import { PhaseProgress } from "@/components/PhaseProgress";
import { PlanViewer } from "@/components/PlanViewer";
import { OutputPanel } from "@/components/OutputPanel";
import { RetryButton } from "@/components/RetryButton";
import { MachineViz } from "@/components/MachineViz";
import { useMigration } from "@/hooks/useMigration";
import type { MigrationRequest } from "@/lib/schemas/migration";
import type { Phase } from "@/lib/agent/machine";

export default function Home() {
  const { state, migrate, retry } = useMigration();
  const [lastRequest, setLastRequest] = useState<MigrationRequest | null>(null);

  const isActive =
    state.phase !== null && state.result === null && state.error === null;
  const sourceFiles = lastRequest?.files ?? [];
  const activePhase = state.phase as Phase | null;

  function handleSubmit(request: MigrationRequest) {
    setLastRequest(request);
    migrate(request);
  }

  function handleRetry() {
    if (state.jobId) retry(state.jobId);
  }

  return (
    <main className="min-h-screen bg-neu-base px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-700 tracking-tight">
            Migration Workflow Agent
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-powered code migration · Analysis → Planning → Execution →
            Verification
          </p>
        </div>

        {/* Main grid: form left, machine viz right on large screens */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left column */}
          <div className="space-y-6">
            {/* Form */}
            <NeuCard>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
                Source Code
              </h2>
              <MigrationForm onSubmit={handleSubmit} loading={isActive} />
            </NeuCard>

            {/* Phase progress + retry */}
            {state.phase !== null && (
              <NeuCard>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
                    Progress
                  </h2>
                  <RetryButton
                    retryable={state.retryable}
                    onRetry={handleRetry}
                    loading={isActive}
                  />
                </div>
                <PhaseProgress
                  currentPhase={state.phase}
                  phaseStatuses={state.phaseStatuses}
                />
              </NeuCard>
            )}

            {/* Error banner */}
            {state.error && (
              <NeuCard inset>
                <p className="text-sm text-red-500">{state.error}</p>
              </NeuCard>
            )}

            {/* Plan */}
            {state.plan && (
              <NeuCard>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
                  Migration Plan
                </h2>
                <PlanViewer
                  plan={state.plan}
                  stepStatuses={state.stepStatuses}
                />
              </NeuCard>
            )}

            {/* Output */}
            {state.result && state.result.migratedFiles.length > 0 && (
              <NeuCard>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
                    Migrated Files
                  </h2>
                  {state.result.verification && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        state.result.verification.passed
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {state.result.verification.passed
                        ? "Verified ✓"
                        : "Issues found"}
                    </span>
                  )}
                </div>
                <OutputPanel
                  migratedFiles={state.result.migratedFiles}
                  sourceFiles={sourceFiles}
                />
              </NeuCard>
            )}
          </div>

          {/* Right column: machine visualization */}
          <div className="space-y-6">
            <NeuCard className="sticky top-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
                State Machine
              </h2>
              <MachineViz activePhase={activePhase} />

              {/* Verification summary */}
              {state.result?.verification && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs text-gray-500">
                    {state.result.verification.summary}
                  </p>
                  {state.result.verification.issues.map((issue, i) => (
                    <p key={i} className="text-xs text-red-400">
                      · [{issue.severity}] {issue.file}: {issue.message}
                    </p>
                  ))}
                </div>
              )}
            </NeuCard>
          </div>
        </div>
      </div>
    </main>
  );
}
