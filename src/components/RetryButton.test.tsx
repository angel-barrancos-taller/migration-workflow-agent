import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RetryButton } from './RetryButton';

describe('RetryButton', () => {
  it('renders nothing when retryable is false', () => {
    const { container } = render(
      <RetryButton retryable={false} onRetry={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders button when retryable is true', () => {
    render(<RetryButton retryable={true} onRetry={jest.fn()} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry when clicked', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    render(<RetryButton retryable={true} onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables button while loading', () => {
    render(<RetryButton retryable={true} onRetry={jest.fn()} loading={true} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeDisabled();
  });
});
