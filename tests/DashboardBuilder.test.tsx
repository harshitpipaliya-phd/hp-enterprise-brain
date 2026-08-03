import { render, screen } from '@testing-library/react';
import { DashboardBuilder } from '../src/components/dashboard/DashboardBuilder';

describe('DashboardBuilder', () => {
  const mockDashboard = {
    name: 'Test Dashboard',
    layout: {
      layout_type: 'grid',
      grid_columns: 12,
      grid_rows: 12,
      widgets: [
        { widget_key: 'signal_summary', config: {} },
      ],
    },
  };

  it('renders dashboard name', () => {
    render(<DashboardBuilder dashboard={mockDashboard} />);
    expect(screen.getByText('Test Dashboard')).toBeTruthy();
  });

  it('renders widgets', () => {
    render(<DashboardBuilder dashboard={mockDashboard} />);
    expect(screen.getByText(/Widget: signal_summary/)).toBeTruthy();
  });

  it('renders empty state when no widgets', () => {
    const emptyDashboard = {
      ...mockDashboard,
      layout: { ...mockDashboard.layout, widgets: [] },
    };
    render(<DashboardBuilder dashboard={emptyDashboard} />);
    expect(screen.getByText('No widgets configured')).toBeTruthy();
  });
});
