import { render, screen } from '@testing-library/react';
import { ErrorState } from '../src/components/states/ErrorState';

/**
 * These assertions follow the shared state components in ui/primitives, which
 * this wrapper now delegates to. The copy they check ("Try again", not "Try
 * Again") is the design system's, and the title/message split is the reason
 * this file has a case for each.
 */
describe('ErrorState', () => {
  it('renders default title', () => {
    render(<ErrorState />);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy();
  });

  it('renders custom title', () => {
    render(<ErrorState title="Custom error" />);
    expect(screen.getByRole('heading', { name: 'Custom error' })).toBeTruthy();
  });

  it('renders message when provided', () => {
    render(<ErrorState message="Something failed" />);
    expect(screen.getByText('Something failed')).toBeTruthy();
  });

  // The regression: with only a default title, the card used to print the same
  // sentence as heading AND body.
  it('does not repeat the title as the description', () => {
    render(<ErrorState />);
    expect(screen.getAllByText('Something went wrong').length).toBe(1);
  });

  it('keeps a custom title alongside a message', () => {
    render(<ErrorState title="Import failed" message="row 42 is malformed" />);
    expect(screen.getByRole('heading', { name: 'Import failed' })).toBeTruthy();
    expect(screen.getByText('row 42 is malformed')).toBeTruthy();
  });

  it('renders retry button when onRetry provided', () => {
    render(<ErrorState onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });
});
