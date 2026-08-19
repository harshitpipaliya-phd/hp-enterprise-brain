import type { View } from '../App';
import {
  Activity, Boxes, Brain, Building2, ChartNoAxesColumn, CircleGauge,
  Database, FileSearch, FolderTree, Gauge, Layers, Library, ListChecks,
  MessageSquare, Network, Notebook, Radio, Scale, Search, Settings, ShieldCheck,
  Sparkles, Target, TrendingUp, Upload, Users, Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * ONE definition per view: label, section, icon, breadcrumb trail.
 *
 * Before this, the same facts were restated in three places — NAV_ITEMS in
 * Sidebar.tsx, breadcrumbFor() in the same file, and ad-hoc <h1>s inside each
 * screen. They drifted: 'home' had no nav entry at all, so the breadcrumb fell
 * through to its else branch and rendered the literal string "home".
 *
 * ROLE VISIBILITY IS NOT HERE, DELIBERATELY. It lives in ./roleAccess.ts, which
 * lifted the allow-lists verbatim from the previous Sidebar.tsx. Restating them
 * here would create a second definition to keep in step with the first — the
 * exact failure this file exists to remove.
 */

export type SectionId =
  | 'Overview' | 'Foundation' | 'Intelligence Loop'
  | 'Analytics' | 'Knowledge' | 'Automation' | 'Account';

export interface ViewMeta {
  /** Sidebar and breadcrumb label. */
  label: string;
  section: SectionId;
  icon: LucideIcon;
  /** Needs a selected organization before it can render. */
  requiresOrg: boolean;
  /** Hidden from the sidebar but still routable (sub-screens of a nav item). */
  hidden?: boolean;
  /** Parent view, for a breadcrumb trail deeper than section → screen. */
  parent?: View;
  description?: string;
}

export const SECTIONS: SectionId[] = [
  'Overview', 'Foundation', 'Intelligence Loop',
  'Analytics', 'Knowledge', 'Automation', 'Account',
];

/** Sections whose nav items render as a single expandable group header rather
 *  than a permanent list. Clicking the header toggles the group; only one group
 *  is open at a time. Always-visible sections (Overview, Foundation, Account)
 *  are excluded so their items are always reachable without a second tap. */
export const COLLAPSIBLE_SECTIONS: SectionId[] = [
  'Intelligence Loop', 'Analytics', 'Knowledge', 'Automation',
];

/** Every one of the 31 View values, exhaustively — the Record type enforces it. */
export const VIEW_META: Record<View, ViewMeta> = {
  home:             { label: 'Organization', section: 'Overview', icon: CircleGauge, requiresOrg: true, description: 'What this organization contains, and how far its data has travelled through the loop.' },
  // Retained as an alias so a session persisted by an earlier build still
  // resolves. Hidden, because Command Center already has a nav entry as 'home'.
  commandcenter:    { label: 'Organization', section: 'Overview', icon: CircleGauge, requiresOrg: true, hidden: true },

  list:             { label: 'Organizations', section: 'Foundation', icon: Building2, requiresOrg: false, hidden: true, description: 'Every organization the Brain is configured for.' },
  create:           { label: 'New Organization', section: 'Foundation', icon: Building2, requiresOrg: false, hidden: true, parent: 'list' },
  edit:             { label: 'Edit Organization', section: 'Foundation', icon: Building2, requiresOrg: true, hidden: true, parent: 'list' },
  details:          { label: 'Organization', section: 'Overview', icon: CircleGauge, requiresOrg: true, hidden: true },
  archive:          { label: 'Archive Organization', section: 'Foundation', icon: Building2, requiresOrg: true, hidden: true, parent: 'list' },
  departments:      { label: 'Departments', section: 'Foundation', icon: FolderTree, requiresOrg: true, description: 'How the organization is structured, and who leads each unit.' },
  people:           { label: 'People', section: 'Foundation', icon: Users, requiresOrg: true, description: 'Everyone recorded in this organization, and whose record is incomplete.' },
  capabilities:     { label: 'Capabilities', section: 'Foundation', icon: Target, requiresOrg: true, description: 'What people need to be able to do, and who is assigned to each.' },
  ingestion:        { label: 'Ingestion', section: 'Foundation', icon: Upload, requiresOrg: true, description: 'Bring this organization’s data in from a file.' },

  signals:          { label: 'Signals', section: 'Intelligence Loop', icon: Radio, requiresOrg: true, description: 'What the data has flagged, and who it concerns.' },
  evidence:         { label: 'Evidence', section: 'Intelligence Loop', icon: FileSearch, requiresOrg: true, description: 'What supports each signal, and how firmly it is held.' },
  deliberation:     { label: 'Deliberation', section: 'Intelligence Loop', icon: Scale, requiresOrg: true, description: 'Open investigations and the decisions waiting on them.' },
  workspace:        { label: 'Intelligence Workspace', section: 'Intelligence Loop', icon: Brain, requiresOrg: true, description: 'What this organization currently knows about itself.' },
  executions:       { label: 'Execution Center', section: 'Intelligence Loop', icon: Workflow, requiresOrg: true, description: 'What has been done about approved decisions, and the result.' },

  executive:        { label: 'Executive Dashboard', section: 'Analytics', icon: Gauge, requiresOrg: true, description: 'Organization health at a glance.' },
  analytics:        { label: 'Decision Analytics', section: 'Analytics', icon: ChartNoAxesColumn, requiresOrg: true, description: 'How decisions are performing over time.' },
  decisionintel:    { label: 'Decision Intelligence', section: 'Analytics', icon: TrendingUp, requiresOrg: true, description: 'Patterns across decisions, risks and outcomes.' },
  mentalmodels:     { label: 'Organizational Knowledge', section: 'Analytics', icon: Notebook, requiresOrg: true, description: 'The mental models the organization reasons with.' },

  graph:            { label: 'Graph Explorer', section: 'Knowledge', icon: Network, requiresOrg: true, description: 'Entities and the relationships between them.' },
  kasbaexplorer:    { label: 'KASBA Explorer', section: 'Knowledge', icon: Layers, requiresOrg: true, description: 'Knowledge, ability, skill, behaviour and attitude.' },
  search:           { label: 'Global Search', section: 'Knowledge', icon: Search, requiresOrg: true, description: 'Search across everything this organization holds.' },
  copilot:          { label: 'Copilot', section: 'Knowledge', icon: MessageSquare, requiresOrg: true, description: 'Conversational access to the Brain.' },
  aiworkspace:      { label: 'AI Workspace', section: 'Knowledge', icon: Sparkles, requiresOrg: true, description: 'Grounded AI sessions with citations.' },
  knowledgelibrary: { label: 'Knowledge Library', section: 'Knowledge', icon: Library, requiresOrg: true, description: 'Reusable knowledge assets.' },
  memory:           { label: 'Memory', section: 'Knowledge', icon: Database, requiresOrg: true, description: 'What the Brain retains between sessions.' },
  esolibrary:       { label: 'ESO Library', section: 'Knowledge', icon: Boxes, requiresOrg: true, description: 'Executable strategic objectives.' },

  agents:           { label: 'Agent Monitor', section: 'Automation', icon: Activity, requiresOrg: true, description: 'What the agents are doing, and on whose authority.' },
  tasks:            { label: 'Task Orchestrator', section: 'Automation', icon: ListChecks, requiresOrg: true, description: 'Scheduled and queued work.' },
  policies:         { label: 'Policy Management', section: 'Automation', icon: ShieldCheck, requiresOrg: true, description: 'The rules execution must respect.' },

  settings:         { label: 'Settings', section: 'Account', icon: Settings, requiresOrg: true, description: 'Configuration for this organization.' },
};

/** Sidebar order. Hidden views are routable but never drawn. */
export const NAV_VIEWS: View[] = (Object.keys(VIEW_META) as View[])
  .filter((v) => !VIEW_META[v].hidden);

export interface CrumbSpec {
  label: string;
  /** Absent on the final crumb and on section headings, which go nowhere. */
  view?: View;
}

/**
 * Breadcrumb trail for a view: Home › [Organization] › Section › [Parent] › Screen.
 *
 * A crumb only carries a `view` when navigating there does something. A section
 * heading is a grouping, not a destination, so it is rendered as plain text —
 * a link that goes nowhere is worse than no link, because a keyboard user has
 * to tab through it to find out.
 */
export function breadcrumbsFor(view: View, orgName?: string): CrumbSpec[] {
  const meta = VIEW_META[view];
  if (!meta) return [{ label: 'Home' }];

  const trail: CrumbSpec[] = [{ label: 'Home', view: 'home' }];

  if (orgName && meta.requiresOrg) trail.push({ label: orgName });

  trail.push({ label: meta.section });

  if (meta.parent && meta.parent !== view) {
    trail.push({ label: VIEW_META[meta.parent].label, view: meta.parent });
  }

  trail.push({ label: meta.label });

  return trail;
}
