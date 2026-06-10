import { render, screen } from '@testing-library/react';
import { PhaseProgress } from './PhaseProgress';

const phases = ['analyzing', 'planning', 'executing', 'verifying'] as const;

describe('PhaseProgress', () => {
  it('renders all 4 phase labels', () => {
    render(<PhaseProgress currentPhase={null} phaseStatuses={{}} />);
    expect(screen.getByText(/analyz/i)).toBeInTheDocument();
    expect(screen.getByText(/plann/i)).toBeInTheDocument();
    expect(screen.getByText(/execut/i)).toBeInTheDocument();
    expect(screen.getByText(/verify/i)).toBeInTheDocument();
  });

  it('marks the current active phase', () => {
    render(<PhaseProgress currentPhase="planning" phaseStatuses={{ planning: 'started' }} />);
    const pill = screen.getByTestId('phase-planning');
    expect(pill).toHaveClass('active');
  });

  it('marks completed phases', () => {
    render(
      <PhaseProgress
        currentPhase="planning"
        phaseStatuses={{ analyzing: 'completed', planning: 'started' }}
      />,
    );
    expect(screen.getByTestId('phase-analyzing')).toHaveClass('completed');
  });

  it('marks failed phase', () => {
    render(<PhaseProgress currentPhase="analyzing" phaseStatuses={{ analyzing: 'failed' }} />);
    expect(screen.getByTestId('phase-analyzing')).toHaveClass('failed');
  });

  it('shows retry badge when retrying', () => {
    render(
      <PhaseProgress
        currentPhase="analyzing"
        phaseStatuses={{ analyzing: 'retrying' }}
        retryCount={2}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
