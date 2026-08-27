import { render, screen } from '@testing-library/react';
import { LoadingState } from '../src/components/states/LoadingState';

/**
 * The skeleton and spinner are the design system's `Skeleton` and `Spinner`, so
 * this file asserts against THEIR markup. It used to look for `.animate-pulse`
 * and `.animate-spin`, which were Tailwind utility classes the product no
 * longer ships — the tests failed while the component was perfectly correct.
 */
describe('LoadingState', () => {
  it('renders skeleton loader by default', () => {
    render(<LoadingState />);
    expect(document.querySelectorAll('.u-skeleton').length).toBeGreaterThan(0);
  });

  it('renders spinner when variant is spinner', () => {
    render(<LoadingState variant="spinner" />);
    expect(document.querySelector('.u-spinner')).toBeTruthy();
    expect(screen.getAllByText('Loading').length).toBeGreaterThan(0);
  });

  it('renders one skeleton block per requested item', () => {
    render(<LoadingState count={5} />);
    // Two bars per block — a short label and the body it stands in for.
    expect(document.querySelectorAll('.u-skeleton').length).toBe(10);
  });
});
