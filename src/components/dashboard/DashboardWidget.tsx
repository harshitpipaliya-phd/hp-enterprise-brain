import React from 'react';

interface DashboardWidgetProps {
  widget: {
    widget_key: string;
    config: Record<string, any>;
    definition?: {
      component_type: string;
      name: string;
    };
  };
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({ widget }) => {
  const ComponentType = widget.definition?.component_type || 'div';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h4 className="mb-2 text-sm font-semibold text-gray-700">{widget.definition?.name || widget.widget_key}</h4>
      <div className={ComponentType === 'AnalyticsChartWidget' ? 'h-48' : 'h-32'}>
        <div className="flex h-full items-center justify-center text-gray-400">
          Widget: {widget.widget_key}
        </div>
      </div>
    </div>
  );
};
