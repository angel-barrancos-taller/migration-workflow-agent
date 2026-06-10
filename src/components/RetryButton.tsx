import { NeuButton } from './ui/NeuButton';

interface RetryButtonProps {
  retryable: boolean;
  onRetry: () => void;
  loading?: boolean;
}

export function RetryButton({ retryable, onRetry, loading = false }: RetryButtonProps) {
  if (!retryable) return null;

  return (
    <NeuButton variant="primary" onClick={onRetry} disabled={loading}>
      {loading ? 'Retrying…' : 'Retry'}
    </NeuButton>
  );
}
