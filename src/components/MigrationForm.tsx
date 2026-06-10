'use client';

import { useState } from 'react';
import { NeuButton } from './ui/NeuButton';
import type { MigrationRequest, Framework } from '@/lib/schemas/migration';
import { SUPPORTED_PAIRS } from '@/lib/schemas/migration';

interface FileEntry {
  name: string;
  content: string;
}

interface MigrationFormProps {
  onSubmit: (request: MigrationRequest) => void;
  loading: boolean;
}

const FRAMEWORK_OPTIONS: Framework[] = ['react', 'vue', 'express', 'fastify', 'jquery'];

const SAMPLE_PRESETS: Record<string, { source: Framework; target: Framework; files: FileEntry[] }> = {
  'react-to-vue': {
    source: 'react',
    target: 'vue',
    files: [
      {
        name: 'Counter.tsx',
        content: `import { useState } from 'react';

interface CounterProps {
  initialCount?: number;
}

export function Counter({ initialCount = 0 }: CounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="counter">
      <h2>Count: {count}</h2>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <button onClick={() => setCount(c => c - 1)}>Decrement</button>
    </div>
  );
}`,
      },
    ],
  },
};

function getTargetsForSource(source: Framework): Framework[] {
  return SUPPORTED_PAIRS.filter((p) => p.source === source).map((p) => p.target);
}

export function MigrationForm({ onSubmit, loading }: MigrationFormProps) {
  const [files, setFiles] = useState<FileEntry[]>([{ name: '', content: '' }]);
  const [source, setSource] = useState<Framework>('react');
  const [target, setTarget] = useState<Framework>('vue');

  const availableTargets = getTargetsForSource(source);
  const hasValidFile = files.some((f) => f.name.trim() && f.content.trim());

  function handleSourceChange(newSource: Framework) {
    setSource(newSource);
    const targets = getTargetsForSource(newSource);
    if (!targets.includes(target)) {
      setTarget(targets[0]);
    }
  }

  function addFile() {
    setFiles((prev) => [...prev, { name: '', content: '' }]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFile(index: number, field: keyof FileEntry, value: string) {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  }

  function loadSample() {
    const key = `${source}-to-${target}`;
    const preset = SAMPLE_PRESETS[key] ?? SAMPLE_PRESETS['react-to-vue'];
    setSource(preset.source);
    setTarget(preset.target);
    setFiles(preset.files);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validFiles = files.filter((f) => f.name.trim() && f.content.trim());
    if (validFiles.length === 0) return;
    onSubmit({ files: validFiles, source, target });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Framework selects */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="source-framework" className="text-sm font-medium text-gray-600">
            Source Framework
          </label>
          <select
            id="source-framework"
            value={source}
            onChange={(e) => handleSourceChange(e.target.value as Framework)}
            className="rounded-xl bg-neu-base px-3 py-2 shadow-neu-inset text-sm text-gray-700 outline-none"
          >
            {FRAMEWORK_OPTIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="target-framework" className="text-sm font-medium text-gray-600">
            Target Framework
          </label>
          <select
            id="target-framework"
            value={target}
            onChange={(e) => setTarget(e.target.value as Framework)}
            className="rounded-xl bg-neu-base px-3 py-2 shadow-neu-inset text-sm text-gray-700 outline-none"
          >
            {availableTargets.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Files */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Source Files</span>
          <NeuButton type="button" onClick={loadSample} className="text-xs">
            Load Sample
          </NeuButton>
        </div>
        {files.map((file, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl bg-neu-base p-4 shadow-neu-sm">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filename (e.g. App.tsx)"
                value={file.name}
                onChange={(e) => updateFile(i, 'name', e.target.value)}
                className="flex-1 rounded-lg bg-white/50 px-3 py-1.5 text-sm shadow-neu-inset outline-none placeholder:text-gray-300"
              />
              {files.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove file"
                  onClick={() => removeFile(i)}
                  className="rounded-lg px-2 py-1 text-xs text-red-400 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
            <textarea
              placeholder="Paste your code here…"
              value={file.content}
              onChange={(e) => updateFile(i, 'content', e.target.value)}
              rows={8}
              className="w-full resize-y rounded-lg bg-white/50 px-3 py-2 font-mono text-xs shadow-neu-inset outline-none placeholder:text-gray-300"
            />
          </div>
        ))}
        <NeuButton type="button" onClick={addFile} className="self-start text-sm">
          + Add File
        </NeuButton>
      </div>

      {/* Submit */}
      <NeuButton type="submit" variant="primary" disabled={loading || !hasValidFile} className="w-full py-3 text-base">
        {loading ? 'Migrating…' : 'Migrate →'}
      </NeuButton>
    </form>
  );
}
