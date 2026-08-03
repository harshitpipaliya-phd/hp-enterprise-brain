import { render, screen } from '@testing-library/react';
import { UnavailableState } from '../src/components/states/UnavailableState';

describe('UnavailableState', () => {
  it('renders default unavailable message', () => {
    render(<UnavailableState />);
    expect(screen.getByText('Feature Unavailable')).toBeTruthy();
  });

  it('renders feature name when provided', () => {
    render(<UnavailableState featureName="AI Workspace" />);
    expect(screen.getByText('AI Workspace is unavailable')).toBeTruthy();
  });

  it('renders custom message', () => {
    render(<UnavailableState message="Contact admin" />);
    expect(screen.getByText('Contact admin')).toBeTruthy();
  });
});
