import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MigrationForm } from './MigrationForm';

describe('MigrationForm', () => {
  it('renders file name and content inputs for the initial file', () => {
    render(<MigrationForm onSubmit={jest.fn()} loading={false} />);
    expect(screen.getByPlaceholderText(/filename/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste.*code/i)).toBeInTheDocument();
  });

  it('renders source and target framework selects', () => {
    render(<MigrationForm onSubmit={jest.fn()} loading={false} />);
    expect(screen.getByLabelText(/source framework/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target framework/i)).toBeInTheDocument();
  });

  it('adds a new file row when "Add file" is clicked', async () => {
    const user = userEvent.setup();
    render(<MigrationForm onSubmit={jest.fn()} loading={false} />);
    await user.click(screen.getByRole('button', { name: /add file/i }));
    expect(screen.getAllByPlaceholderText(/filename/i)).toHaveLength(2);
  });

  it('removes a file row when remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<MigrationForm onSubmit={jest.fn()} loading={false} />);
    await user.click(screen.getByRole('button', { name: /add file/i }));
    expect(screen.getAllByPlaceholderText(/filename/i)).toHaveLength(2);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);
    expect(screen.getAllByPlaceholderText(/filename/i)).toHaveLength(1);
  });

  it('calls onSubmit with correct request shape when submitted', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<MigrationForm onSubmit={onSubmit} loading={false} />);

    await user.clear(screen.getByPlaceholderText(/filename/i));
    await user.type(screen.getByPlaceholderText(/filename/i), 'App.tsx');
    await user.clear(screen.getByPlaceholderText(/paste.*code/i));
    await user.type(screen.getByPlaceholderText(/paste.*code/i), 'const x = 1');

    await user.click(screen.getByRole('button', { name: /migrate/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [{ name: 'App.tsx', content: 'const x = 1' }],
        source: expect.any(String),
        target: expect.any(String),
      }),
    );
  });

  it('disables submit button while loading', () => {
    render(<MigrationForm onSubmit={jest.fn()} loading={true} />);
    expect(screen.getByRole('button', { name: /migrat/i })).toBeDisabled();
  });

  it('disables submit button when there is no valid file', () => {
    render(<MigrationForm onSubmit={jest.fn()} loading={false} />);
    expect(screen.getByRole('button', { name: /migrate/i })).toBeDisabled();
  });

  it('enables submit button once a file has both a name and content', async () => {
    const user = userEvent.setup();
    render(<MigrationForm onSubmit={jest.fn()} loading={false} />);

    expect(screen.getByRole('button', { name: /migrate/i })).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/filename/i), 'App.tsx');
    await user.type(screen.getByPlaceholderText(/paste.*code/i), 'const x = 1');

    expect(screen.getByRole('button', { name: /migrate/i })).toBeEnabled();
  });

  it('loads a sample preset when the sample button is clicked', async () => {
    const user = userEvent.setup();
    render(<MigrationForm onSubmit={jest.fn()} loading={false} />);
    await user.click(screen.getByRole('button', { name: /sample/i }));
    // After loading sample, the filename field should be non-empty
    const filenameInput = screen.getAllByPlaceholderText(/filename/i)[0] as HTMLInputElement;
    expect(filenameInput.value).not.toBe('');
  });
});
