'use client';

import { useState } from 'react';
import { DiffView } from './DiffView';
import type { MigratedFile } from '@/lib/schemas/migration';

interface SourceFile {
  name: string;
  content: string;
}

interface OutputPanelProps {
  migratedFiles: MigratedFile[];
  sourceFiles: SourceFile[];
}

function downloadFile(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function OutputPanel({ migratedFiles, sourceFiles }: OutputPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);

  if (migratedFiles.length === 0) return null;

  const active = migratedFiles[activeIndex];
  const source = sourceFiles.find((f) => f.name === active?.sourceFile) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1 flex-1">
          {migratedFiles.map((file, i) => (
            <button
              key={file.name}
              role="tab"
              aria-selected={i === activeIndex}
              onClick={() => setActiveIndex(i)}
              className={`rounded-lg px-3 py-1.5 text-xs font-mono transition-all ${
                i === activeIndex
                  ? 'bg-blue-100 text-blue-700 shadow-neu-inset'
                  : 'bg-neu-base text-gray-500 shadow-neu hover:text-gray-700'
              }`}
            >
              {file.name}
            </button>
          ))}
        </div>
        {source && (
          <button
            role="button"
            aria-pressed={showDiff}
            onClick={() => setShowDiff((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              showDiff
                ? 'bg-purple-100 text-purple-700 shadow-neu-inset'
                : 'bg-neu-base text-gray-500 shadow-neu'
            }`}
          >
            Diff
          </button>
        )}
        {active && (
          <button
            type="button"
            onClick={() => downloadFile(active.name, active.content)}
            className="rounded-lg bg-neu-base px-3 py-1.5 text-xs font-medium text-gray-500 shadow-neu transition-all hover:text-gray-700"
          >
            Download
          </button>
        )}
        {migratedFiles.length > 1 && (
          <button
            type="button"
            onClick={() => migratedFiles.forEach((f) => downloadFile(f.name, f.content))}
            className="rounded-lg bg-neu-base px-3 py-1.5 text-xs font-medium text-gray-500 shadow-neu transition-all hover:text-gray-700"
          >
            Download All
          </button>
        )}
      </div>

      {/* Content */}
      {active && (
        <div>
          {showDiff && source ? (
            <DiffView original={source.content} migrated={active.content} />
          ) : (
            <pre className="overflow-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed text-gray-300">
              {active.content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
