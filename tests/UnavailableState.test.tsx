import { render, screen } from '@testing-library/react';
import { UnavailableState } from '../src/components/states/UnavailableState';

describe('UnavailableState', () => {
  // Sentence case, matching every other state heading in the design system.
  it('renders default unavailable message', () => {
    render(<UnavailableState />);
    expect(screen.getByRole('heading', { name: 'Feature unavailable' })).toBeTruthy();
  });

  it('renders feature name when provided', () => {
    render(<UnavailableState featureName="AI Workspace" />);
    expect(screen.getByRole('heading', { name: 'AI Workspace is unavailable' })).toBeTruthy();
  });

  it('renders custom message', () => {
    render(<UnavailableState message="Contact admin" />);
    expect(screen.getByText('Contact admin')).toBeTruthy();
  });
});
