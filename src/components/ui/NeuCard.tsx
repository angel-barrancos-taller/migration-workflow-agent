import type { ReactNode } from 'react';

interface NeuCardProps {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}

export function NeuCard({ children, className = '', inset = false }: NeuCardProps) {
  return (
    <div
      className={`rounded-2xl bg-neu-base p-6 ${inset ? 'shadow-neu-inset' : 'shadow-neu'} ${className}`}
    >
      {children}
    </div>
  );
}
