import { render, screen } from '@testing-library/react';
import { LoadingState } from '../src/components/states/LoadingState';

describe('LoadingState', () => {
  it('renders skeleton loader by default', () => {
    render(<LoadingState />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders spinner when variant is spinner', () => {
    render(<LoadingState variant="spinner" />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('renders correct number of skeleton items', () => {
    render(<LoadingState count={5} />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(5);
  });
});
