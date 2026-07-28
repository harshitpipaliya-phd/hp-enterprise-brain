import { useState } from 'react';
import type { View } from '../App';

interface NavItem {
  view: View;
  label: string;
  section: string;
  requiresOrg: boolean;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'commandcenter', label: 'Command Center', section: 'Overview', requiresOrg: true, icon: '⌘' },

  { view: 'list', label: 'Organizations', section: 'Foundation', requiresOrg: false, icon: '▢' },
  { view: 'departments', label: 'Departments', section: 'Foundation', requiresOrg: true, icon: '☷' },
  { view: 'people', label: 'People', section: 'Foundation', requiresOrg: true, icon: '○' },
  { view: 'capabilities', label: 'Capabilities', section: 'Foundation', requiresOrg: true, icon: '✦' },

  { view: 'signals', label: 'Signals', section: 'Intelligence Loop', requiresOrg: true, icon: '⤳' },
  { view: 'evidence', label: 'Evidence', section: 'Intelligence Loop', requiresOrg: true, icon: '☷' },
  { view: 'deliberation', label: 'Deliberation (Cases)', section: 'Intelligence Loop', requiresOrg: true, icon: '⚖' },
  { view: 'workspace', label: 'Intelligence Workspace', section: 'Intelligence Loop', requiresOrg: true, icon: '◆' },
  { view: 'executions', label: 'Execution Center', section: 'Intelligence Loop', requiresOrg: true, icon: '▸' },

  { view: 'executive', label: 'Executive Dashboard', section: 'Analytics', requiresOrg: true, icon: '▤' },
  { view: 'analytics', label: 'Decision Analytics', section: 'Analytics', requiresOrg: true, icon: '≡' },
  { view: 'decisionintel', label: 'Decision Intelligence', section: 'Analytics', requiresOrg: true, icon: '◇' },
  { view: 'mentalmodels', label: 'Organizational Knowledge', section: 'Analytics', requiresOrg: true, icon: '☷' },

  { view: 'graph', label: 'Graph Explorer', section: 'Knowledge', requiresOrg: true, icon: '⚛' },
  { view: 'kasbaexplorer', label: 'KASBA Explorer', section: 'Knowledge', requiresOrg: true, icon: '⌘' },
  { view: 'search', label: 'Global Search', section: 'Knowledge', requiresOrg: true, icon: '⚲' },
  { view: 'copilot', label: 'Copilot', section: 'Knowledge', requiresOrg: true, icon: '✦' },
  { view: 'aiworkspace', label: 'AI Workspace', section: 'Knowledge', requiresOrg: true, icon: '⚙' },
  { view: 'knowledgelibrary', label: 'Knowledge Library', section: 'Knowledge', requiresOrg: true, icon: '☷' },

  { view: 'agents', label: 'Agent Monitor', section: 'Automation', requiresOrg: true, icon: '◉' },
  { view: 'tasks', label: 'Task Orchestrator', section: 'Automation', requiresOrg: true, icon: '☑' },
  { view: 'policies', label: 'Policy Management', section: 'Automation', requiresOrg: true, icon: '⚖' },

  { view: 'settings', label: 'Settings', section: 'Account', requiresOrg: true, icon: '⚙' },
];

export const NAV_ITEMS_FOR_PALETTE = NAV_ITEMS;

const SECTIONS = ['Overview', 'Foundation', 'Intelligence Loop', 'Analytics', 'Knowledge', 'Automation', 'Account'];

interface SidebarProps {
  currentView: View;
  hasSelectedOrg: boolean;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}

export function Sidebar({ currentView, hasSelectedOrg, onNavigate, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('hpbrain-sidebar-collapsed') === 'true');

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('hpbrain-sidebar-collapsed', String(next));
  };

  return (
    <nav className={`eb-sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="eb-sidebar-brand">
        <div className="eb-sidebar-logo">HP</div>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div className="eb-sidebar-brand-text">Enterprise Brain</div>
            <div className="eb-sidebar-brand-sub">Organizational Intelligence</div>
          </div>
        )}
        <button className="eb-sidebar-toggle" onClick={toggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? '»' : '«'}
        </button>
      </div>
      {SECTIONS.map((section) => {
        const items = NAV_ITEMS.filter((item) => item.section === section);
        if (items.length === 0) return null;
        return (
          <div key={section}>
            {!collapsed && <div className="eb-sidebar-section">{section}</div>}
            {items.map((item) => {
              const disabled = item.requiresOrg && !hasSelectedOrg;
              const active = currentView === item.view;
              return (
                <button
                  key={item.view}
                  className={`eb-sidebar-item${active ? ' active' : ''}`}
                  onClick={() => !disabled && onNavigate(item.view)}
                  disabled={disabled}
                  title={disabled ? 'Select an organization first' : item.label}
                  aria-label={item.label}
                >
                  <span className="eb-sidebar-icon">{item.icon}</span>
                  {!collapsed && <span className="eb-sidebar-label">{item.label}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
      <div className="eb-sidebar-footer">
        <button className="eb-sidebar-item" onClick={onLogout}>
          <span className="eb-sidebar-icon">{'⏻'}</span>
          {!collapsed && <span className="eb-sidebar-label">Logout</span>}
        </button>
      </div>
    </nav>
  );
}

export function Breadcrumb({ items }: { items: string[] }) {
  return (
    <div className="eb-topbar">
      <div className="eb-breadcrumb">
        {items.map((item, i) => (
          <span key={i}>
            {i > 0 && <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>}
            {i === items.length - 1 ? <b>{item}</b> : item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function breadcrumbFor(view: View, orgName?: string): string[] {
  const item = NAV_ITEMS.find((i) => i.view === view);
  const trail = ['Home'];
  if (item) {
    if (orgName && item.requiresOrg) trail.push(orgName);
    trail.push(item.section, item.label);
  } else {
    trail.push(view);
  }
  return trail;
}
