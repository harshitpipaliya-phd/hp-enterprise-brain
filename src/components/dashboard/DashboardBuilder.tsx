import React from 'react';
import { DashboardWidget } from './DashboardWidget';

interface DashboardBuilderProps {
  dashboard: {
    name: string;
    layout: {
      layout_type: string;
      grid_columns: number;
      grid_rows: number;
      widgets: Array<{
        widget_key: string;
        config: Record<string, any>;
      }>;
    };
  };
  onLayoutChange?: (layout: any) => void;
  editable?: boolean;
}

export const DashboardBuilder: React.FC<DashboardBuilderProps> = ({ dashboard }) => {
  const { layout, name } = dashboard;
  const gridCols = layout.grid_columns || 12;

  return (
    <div className="dashboard-builder">
      <h2 className="mb-4 text-xl font-bold">{name}</h2>
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
      >
        {layout.widgets && layout.widgets.length > 0
          ? layout.widgets.map((widget, idx) => (
              <div key={idx} style={{ gridColumn: 'span 4' }}>
                <DashboardWidget widget={widget} />
              </div>
            ))
          : (
            <div className="col-span-full text-center text-gray-500">No widgets configured</div>
          )}
      </div>
    </div>
  );
};
