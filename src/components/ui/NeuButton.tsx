import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface NeuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'danger';
}

export function NeuButton({ children, variant = 'default', className = '', ...props }: NeuButtonProps) {
  const variantClass =
    variant === 'primary'
      ? 'text-blue-600 font-semibold'
      : variant === 'danger'
        ? 'text-red-500 font-semibold'
        : 'text-gray-600';

  return (
    <button
      className={`rounded-xl bg-neu-base px-4 py-2 shadow-neu transition-all active:shadow-neu-inset disabled:opacity-40 disabled:cursor-not-allowed ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
