import type { MigrationPlan } from '@/lib/schemas/migration';

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface PlanViewerProps {
  plan: MigrationPlan | null;
  stepStatuses: Record<string, string>;
}

function statusIcon(status: StepStatus): string {
  switch (status) {
    case 'completed': return '✓';
    case 'in_progress': return '⟳';
    case 'failed': return '✗';
    default: return '○';
  }
}

function statusColor(status: StepStatus): string {
  switch (status) {
    case 'completed': return 'text-green-600';
    case 'in_progress': return 'text-blue-600';
    case 'failed': return 'text-red-500';
    default: return 'text-gray-400';
  }
}

function complexityColor(c: string): string {
  switch (c) {
    case 'high': return 'bg-red-100 text-red-700';
    case 'medium': return 'bg-amber-100 text-amber-700';
    default: return 'bg-green-100 text-green-700';
  }
}

export function PlanViewer({ plan, stepStatuses }: PlanViewerProps) {
  if (!plan) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 italic">{plan.strategy}</p>
      <div className="space-y-2">
        {plan.steps.map((step, i) => {
          const status = (stepStatuses[step.id] ?? step.status) as StepStatus;
          return (
            <div
              key={step.id}
              className="flex items-start gap-3 rounded-xl bg-neu-base p-4 shadow-neu-sm"
            >
              <span className={`mt-0.5 text-lg font-bold ${statusColor(status)}`}>
                {statusIcon(status)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 font-mono">{i + 1}.</span>
                  <p className="text-sm font-medium text-gray-700">{step.description}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${complexityColor(step.complexity)}`}>
                    {step.complexity}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {step.files.map((f) => (
                    <span key={f} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 font-mono">
                      {f}
                    </span>
                  ))}
                </div>
                {step.dependencies.length > 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    Depends on: {step.dependencies.join(', ')}
                  </p>
                )}
              </div>
              <span
                data-testid={`step-status-${step.id}`}
                className={`text-xs shrink-0 ${statusColor(status)}`}
              >
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
