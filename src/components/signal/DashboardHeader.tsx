import { useTheme } from '../../hooks/useTheme';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function DashboardHeader({ title, subtitle, actions }: DashboardHeaderProps) {
  const theme = useTheme();

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: theme.text }}>{title}</h1>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 14, color: theme.textMuted }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </header>
  );
}
