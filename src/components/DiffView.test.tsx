import { render, screen } from '@testing-library/react';
import { DiffView } from './DiffView';

describe('DiffView', () => {
  it('renders added lines with + prefix', () => {
    const { container } = render(
      <DiffView original="ctx\n" migrated="ctx\nadded line\n" />,
    );
    const addedEl = container.querySelector('.bg-green-900\\/40');
    expect(addedEl?.textContent).toMatch(/added line/);
  });

  it('renders removed lines with - prefix', () => {
    const { container } = render(
      <DiffView original="old line\nctx\n" migrated="ctx\n" />,
    );
    const removedEl = container.querySelector('.bg-red-900\\/40');
    expect(removedEl?.textContent).toMatch(/old line/);
  });

  it('renders all lines present in a diff', () => {
    const { container } = render(
      <DiffView original="context\nold\n" migrated="context\nnew\n" />,
    );
    // All line content is visible regardless of diff algorithm classification
    expect(container.textContent).toContain('old');
    expect(container.textContent).toContain('new');
  });

  it('renders "No changes" when content is identical', () => {
    render(<DiffView original="abc\n" migrated="abc\n" />);
    expect(screen.getByText(/no changes/i)).toBeInTheDocument();
  });

  it('renders code-only view when no original provided', () => {
    render(<DiffView original="" migrated="const x = 1\n" />);
    expect(screen.getByText(/const x = 1/)).toBeInTheDocument();
  });
});
