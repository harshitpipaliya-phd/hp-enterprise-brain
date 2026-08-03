import { render, screen } from '@testing-library/react';
import { ErrorState } from '../src/components/states/ErrorState';

describe('ErrorState', () => {
  it('renders default title', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('renders custom title', () => {
    render(<ErrorState title="Custom error" />);
    expect(screen.getByText('Custom error')).toBeTruthy();
  });

  it('renders message when provided', () => {
    render(<ErrorState message="Something failed" />);
    expect(screen.getByText('Something failed')).toBeTruthy();
  });

  it('renders retry button when onRetry provided', () => {
    render(<ErrorState onRetry={() => {}} />);
    expect(screen.getByText('Try Again')).toBeTruthy();
  });
});
