import { render, screen } from '@testing-library/react';
import { EmptyState } from '../src/components/states/EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No data found" />);
    expect(screen.getByText('No data found')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="No data" description="Try adding some" />);
    expect(screen.getByText('Try adding some')).toBeTruthy();
  });

  it('renders action when provided', () => {
    render(<EmptyState title="No data" action={<button>Add</button>} />);
    expect(screen.getByText('Add')).toBeTruthy();
  });
});
