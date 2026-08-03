export const WidgetRegistry: Record<string, { name: string; component: string }> = {
  signal_summary: { name: 'Signal Summary', component: 'SignalSummaryWidget' },
  decision_pipeline: { name: 'Decision Pipeline', component: 'DecisionPipelineWidget' },
  capability_heatmap: { name: 'Capability Heatmap', component: 'CapabilityHeatmapWidget' },
  team_performance: { name: 'Team Performance', component: 'TeamPerformanceWidget' },
  analytics_chart: { name: 'Analytics Chart', component: 'AnalyticsChartWidget' },
  task_monitor: { name: 'Task Monitor', component: 'TaskMonitorWidget' },
};

export const getWidget = (key: string) => WidgetRegistry[key];
