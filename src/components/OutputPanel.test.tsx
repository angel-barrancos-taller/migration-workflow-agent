import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutputPanel } from './OutputPanel';
import type { MigratedFile } from '@/lib/schemas/migration';

const files: MigratedFile[] = [
  { name: 'App.vue', content: '<template><div>Hello</div></template>', sourceFile: 'App.tsx' },
  { name: 'utils.ts', content: 'export const x = 1', sourceFile: 'utils.ts' },
];

const sourceFiles = [
  { name: 'App.tsx', content: 'function App() { return <div>Hello</div> }' },
  { name: 'utils.ts', content: 'export const x = 1' },
];

describe('OutputPanel', () => {
  it('renders null when no files provided', () => {
    const { container } = render(<OutputPanel migratedFiles={[]} sourceFiles={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders file tabs for each migrated file', () => {
    render(<OutputPanel migratedFiles={files} sourceFiles={sourceFiles} />);
    expect(screen.getByRole('tab', { name: /App.vue/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /utils.ts/i })).toBeInTheDocument();
  });

  it('shows first file content by default', () => {
    render(<OutputPanel migratedFiles={files} sourceFiles={sourceFiles} />);
    expect(screen.getByText(/<template>/)).toBeInTheDocument();
  });

  it('switches to another file on tab click', async () => {
    const user = userEvent.setup();
    render(<OutputPanel migratedFiles={files} sourceFiles={sourceFiles} />);
    await user.click(screen.getByRole('tab', { name: /utils.ts/i }));
    expect(screen.getByText(/export const x/)).toBeInTheDocument();
  });

  it('renders diff toggle button', () => {
    render(<OutputPanel migratedFiles={files} sourceFiles={sourceFiles} />);
    expect(screen.getByRole('button', { name: /diff/i })).toBeInTheDocument();
  });
});
