import { render, screen } from '@testing-library/react';
import { PlanViewer } from './PlanViewer';
import type { MigrationPlan } from '@/lib/schemas/migration';

const plan: MigrationPlan = {
  strategy: 'Migrate component by component',
  steps: [
    {
      id: 'step-1',
      description: 'Migrate App component',
      files: ['App.tsx'],
      dependencies: [],
      complexity: 'low',
      status: 'completed',
    },
    {
      id: 'step-2',
      description: 'Migrate utils',
      files: ['utils.ts'],
      dependencies: ['step-1'],
      complexity: 'medium',
      status: 'in_progress',
    },
    {
      id: 'step-3',
      description: 'Migrate styles',
      files: ['styles.css'],
      dependencies: ['step-2'],
      complexity: 'high',
      status: 'pending',
    },
  ],
};

describe('PlanViewer', () => {
  it('renders null when no plan provided', () => {
    const { container } = render(<PlanViewer plan={null} stepStatuses={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders strategy', () => {
    render(<PlanViewer plan={plan} stepStatuses={{}} />);
    expect(screen.getByText(/Migrate component by component/i)).toBeInTheDocument();
  });

  it('renders all step descriptions', () => {
    render(<PlanViewer plan={plan} stepStatuses={{}} />);
    expect(screen.getByText(/Migrate App component/i)).toBeInTheDocument();
    expect(screen.getByText(/Migrate utils/i)).toBeInTheDocument();
    expect(screen.getByText(/Migrate styles/i)).toBeInTheDocument();
  });

  it('shows complexity chip for each step', () => {
    render(<PlanViewer plan={plan} stepStatuses={{}} />);
    expect(screen.getByText('low')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('shows status for each step', () => {
    render(<PlanViewer plan={plan} stepStatuses={{}} />);
    expect(screen.getAllByTestId(/step-status/).length).toBe(3);
  });

  it('applies override status from stepStatuses prop', () => {
    render(
      <PlanViewer
        plan={plan}
        stepStatuses={{ 'step-3': 'in_progress' }}
      />,
    );
    const step3Status = screen.getByTestId('step-status-step-3');
    expect(step3Status).toHaveTextContent(/in_progress/i);
  });
});
