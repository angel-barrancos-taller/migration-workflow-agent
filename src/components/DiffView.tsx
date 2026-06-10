'use client';

import { diffLines } from 'diff';

interface DiffViewProps {
  original: string;
  migrated: string;
}

export function DiffView({ original, migrated }: DiffViewProps) {
  if (!original) {
    return (
      <pre className="overflow-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed text-gray-300">
        {migrated}
      </pre>
    );
  }

  const parts = diffLines(original, migrated);
  const hasChanges = parts.some((p) => p.added || p.removed);

  if (!hasChanges) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">No changes detected.</p>
    );
  }

  return (
    <pre className="overflow-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed">
      {parts.map((part, i) => {
        const raw = part.value.split('\n');
        const lines = raw[raw.length - 1] === '' ? raw.slice(0, -1) : raw;
        return lines.map((line, j) => (
          <div
            key={`${i}-${j}`}
            className={
              part.added
                ? 'bg-green-900/40 text-green-300'
                : part.removed
                  ? 'bg-red-900/40 text-red-300'
                  : 'text-gray-400'
            }
          >
            <span className="select-none mr-2 opacity-60">
              {part.added ? '+ ' : part.removed ? '- ' : '  '}
            </span>
            {line}
          </div>
        ));
      })}
    </pre>
  );
}
