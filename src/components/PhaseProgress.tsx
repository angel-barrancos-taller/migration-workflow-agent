type PhaseStatus = 'pending' | 'started' | 'completed' | 'failed' | 'retrying';

const PHASES = [
  { id: 'analyzing', label: 'Analyzing' },
  { id: 'planning', label: 'Planning' },
  { id: 'executing', label: 'Executing' },
  { id: 'verifying', label: 'Verifying' },
] as const;

interface PhaseProgressProps {
  currentPhase: string | null;
  phaseStatuses: Record<string, string>;
  retryCount?: number;
}

function pillClasses(status: PhaseStatus | undefined): string {
  switch (status) {
    case 'started':
      return 'active bg-blue-100 text-blue-700 shadow-neu-inset';
    case 'completed':
      return 'completed bg-green-100 text-green-700';
    case 'failed':
      return 'failed bg-red-100 text-red-700';
    case 'retrying':
      return 'active retrying bg-amber-100 text-amber-700 shadow-neu-inset';
    default:
      return 'bg-neu-base text-gray-400 shadow-neu';
  }
}

export function PhaseProgress({ currentPhase, phaseStatuses, retryCount }: PhaseProgressProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {PHASES.map((phase, i) => {
        const status = phaseStatuses[phase.id] as PhaseStatus | undefined;
        const isActive = currentPhase === phase.id;

        return (
          <div key={phase.id} className="flex items-center gap-2">
            {i > 0 && <span className="text-gray-300">→</span>}
            <div
              data-testid={`phase-${phase.id}`}
              className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${pillClasses(status)}`}
            >
              {status === 'completed' && <span>✓</span>}
              {status === 'failed' && <span>✗</span>}
              {phase.label}
              {isActive && status === 'retrying' && retryCount !== undefined && retryCount > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
                  {retryCount}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
