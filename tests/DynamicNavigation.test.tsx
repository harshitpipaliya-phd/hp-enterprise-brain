import { render, screen } from '@testing-library/react';
import { DynamicNavigation } from '../src/components/navigation/DynamicNavigation';
import { FeatureFlagProvider } from '../src/contexts/FeatureFlagContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FeatureFlagProvider tenantId="test-tenant">{children}</FeatureFlagProvider>
);

describe('DynamicNavigation', () => {
  const mockItems = [
    { id: '1', label: 'Dashboard', required_module: null, children: [] },
    { id: '2', label: 'Analytics', required_module: 'analytics', children: [] },
    { id: '3', label: 'Settings', required_module: null, children: [] },
  ];

  it('renders navigation items', () => {
    render(<DynamicNavigation items={mockItems} enabledModules={['analytics']} />, { wrapper });
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Analytics')).toBeTruthy();
  });

  it('filters items by required_module', () => {
    render(<DynamicNavigation items={mockItems} enabledModules={[]} />, { wrapper });
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.queryByText('Analytics')).toBeFalsy();
  });
});
