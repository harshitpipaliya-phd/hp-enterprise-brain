import { render, screen } from '@testing-library/react';
import { StaleDataState } from '../src/components/states/StaleDataState';

describe('StaleDataState', () => {
  it('renders stale data message', () => {
    render(<StaleDataState onRefresh={() => {}} />);
    expect(screen.getByText('Data may be outdated')).toBeTruthy();
  });

  it('renders last updated when provided', () => {
    render(<StaleDataState onRefresh={() => {}} lastUpdated="2 hours ago" />);
    expect(screen.getByText('Last updated: 2 hours ago')).toBeTruthy();
  });

  it('renders refresh button', () => {
    render(<StaleDataState onRefresh={() => {}} />);
    expect(screen.getByText('Refresh')).toBeTruthy();
  });
});
