import type { View } from '../App';
import {
  Activity, Bell, Boxes, Brain, Building2, CalendarClock, ChartNoAxesColumn,
  CircleGauge, ClipboardCheck, Database, FileSearch, FileText, FolderSearch, FolderTree,
  Gauge, KeyRound, Layers, Library, ListChecks, Network, Notebook, Plug, Radio,
  Route, Scale, Search, Settings, ShieldCheck, Sparkles, Target, TrendingUp, Upload,
  Users, Waypoints, Workflow,
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
  | 'Analytics' | 'Knowledge' | 'Automation' | 'Platform Services' | 'Account';

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
  'Analytics', 'Knowledge', 'Automation', 'Platform Services', 'Account',
];

/** Sections whose nav items render as a single expandable group header rather
 *  than a permanent list. Clicking the header toggles the group; only one group
 *  is open at a time. Always-visible sections (Overview, Foundation, Account)
 *  are excluded so their items are always reachable without a second tap. */
export const COLLAPSIBLE_SECTIONS: SectionId[] = [
  'Intelligence Loop', 'Analytics', 'Knowledge', 'Automation', 'Platform Services',
];

/** Every one of the 41 View values, exhaustively — the Record type enforces it. */
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
  // Routable, not a nav entry: reached by "Open as case" from a department's
  // recommendation panel, or from a Case result/node in Global Search and the
  // Graph Explorer (viewCase() in App.tsx). The finding it represents is shown
  // in-context in those workflows now, so a standalone browse-all-cases entry
  // is no longer in the user-facing navigation. Same pattern as signalchain.
  cases:            { label: 'Cases', section: 'Intelligence Loop', icon: FolderSearch, requiresOrg: true, hidden: true, description: 'Every investigation opened from a signal or a recommendation, across the organization.' },
  deliberation:     { label: 'Deliberation', section: 'Intelligence Loop', icon: Scale, requiresOrg: true, description: 'Open investigations and the decisions waiting on them.' },
  workspace:        { label: 'Intelligence Workspace', section: 'Intelligence Loop', icon: Brain, requiresOrg: true, description: 'What this organization currently knows about itself.' },
  executions:       { label: 'Execution Center', section: 'Intelligence Loop', icon: Workflow, requiresOrg: true, description: 'What has been done about approved decisions, and the result.' },
  // Routable, not a nav entry: reached by "View chain" from a signal row or
  // from a case opened off a recommendation. See viewChain() in App.tsx.
  signalchain:      { label: 'Signal Chain', section: 'Intelligence Loop', icon: Workflow, requiresOrg: true, hidden: true, parent: 'signals', description: 'The full trace from this signal to its evidence, case, decision, execution, outcome and learning.' },

  executive:        { label: 'Executive Dashboard', section: 'Analytics', icon: Gauge, requiresOrg: true, description: 'Organization health at a glance.' },
  analytics:        { label: 'Decision Analytics', section: 'Analytics', icon: ChartNoAxesColumn, requiresOrg: true, description: 'How decisions are performing over time.' },
  decisionintel:    { label: 'Decision Intelligence', section: 'Analytics', icon: TrendingUp, requiresOrg: true, description: 'Patterns across decisions, risks and outcomes.' },
  mentalmodels:     { label: 'Organizational Knowledge', section: 'Analytics', icon: Notebook, requiresOrg: true, description: 'The mental models the organization reasons with.' },

  graph:            { label: 'Graph Explorer', section: 'Knowledge', icon: Network, requiresOrg: true, description: 'Entities and the relationships between them.' },
  kasbaexplorer:    { label: 'KASBA Explorer', section: 'Knowledge', icon: Layers, requiresOrg: true, description: 'Knowledge, ability, skill, behaviour and attitude.' },
  knowledgelibrary: { label: 'Knowledge Library', section: 'Knowledge', icon: Library, requiresOrg: true, description: 'Reusable knowledge assets.' },
  memory:           { label: 'Memory', section: 'Knowledge', icon: Database, requiresOrg: true, description: 'What the Brain retains between sessions.' },
  aiassistant:      { label: 'AI Assistant', section: 'Knowledge', icon: Sparkles, requiresOrg: true, description: 'Context-scoped search, conversation and AI operation history.' },
  // A plain query across every record type, not a conversation — distinct
  // from AI Assistant above, which is why both are visible side by side
  // rather than one absorbing the other.
  globalsearch:     { label: 'Global Search', section: 'Knowledge', icon: Search, requiresOrg: true, description: 'One query across departments, people, signals, evidence and cases.' },
  esolibrary:       { label: 'ESO Library', section: 'Knowledge', icon: Boxes, requiresOrg: true, description: 'Executable strategic objectives.' },
  // Phase 7.5 — cross-product GraphRAG. Self-contained (own G2G-user-id
  // lookup box), so unlike viewPerson/viewDepartment it needs no carrier
  // state or a button elsewhere to reach it.
  personprofile:    { label: 'Person Profile (Cross-Product)', section: 'Knowledge', icon: Users, requiresOrg: true, description: 'One person\'s record across K-12, G2G and Enterprise Brain.' },

  // Hidden aliases for persisted sessions and older in-app navigation. They
  // render AI Assistant, but breadcrumbs no longer advertise separate screens.
  search:           { label: 'AI Assistant', section: 'Knowledge', icon: Sparkles, requiresOrg: true, hidden: true },
  copilot:          { label: 'AI Assistant', section: 'Knowledge', icon: Sparkles, requiresOrg: true, hidden: true },
  aiworkspace:      { label: 'AI Assistant', section: 'Knowledge', icon: Sparkles, requiresOrg: true, hidden: true },

  agents:           { label: 'Agent Monitor', section: 'Automation', icon: Activity, requiresOrg: true, description: 'What the agents are doing, and on whose authority.' },
  tasks:            { label: 'Task Orchestrator', section: 'Automation', icon: ListChecks, requiresOrg: true, description: 'Scheduled and queued work.' },
  policies:         { label: 'Policy Management', section: 'Automation', icon: ShieldCheck, requiresOrg: true, description: 'The rules execution must respect.' },

  // Platform Services: the cross-cutting services every module runs on. One
  // screen (components/platform/PlatformServices) renders all eight, and the
  // account menu lists them under the same heading.
  rbac:             { label: 'RBAC', section: 'Platform Services', icon: KeyRound, requiresOrg: true, description: 'The access roles the API enforces, and what each one may do.' },
  workflow:         { label: 'Workflow', section: 'Platform Services', icon: Route, requiresOrg: true, description: 'Decisions awaiting approval, and the executions and policies that follow them.' },
  notifications:    { label: 'Notification', section: 'Platform Services', icon: Bell, requiresOrg: true, description: 'Every notification sent to you in this organization.' },
  scheduler:        { label: 'Scheduler', section: 'Platform Services', icon: CalendarClock, requiresOrg: true, description: 'Recurring jobs, when each next runs, and on-demand tasks.' },
  documents:        { label: 'Document', section: 'Platform Services', icon: FileText, requiresOrg: true, description: 'Files brought in, and the knowledge assets they became.' },
  integrations:     { label: 'Integration', section: 'Platform Services', icon: Plug, requiresOrg: true, description: 'Source systems, modules and feature flags this organization is wired to.' },
  audit:            { label: 'Audit', section: 'Platform Services', icon: ClipboardCheck, requiresOrg: true, description: 'Every recorded change — who made it, to what, and when.' },
  eventbus:         { label: 'Event Bus', section: 'Platform Services', icon: Waypoints, requiresOrg: true, description: 'What is queued, in flight, settled or failed on the event backbone.' },

  settings:         { label: 'Settings', section: 'Account', icon: Settings, requiresOrg: true, description: 'Configuration for this organization.' },
  // Reached from the account menu, as in G2G and LMS K-12, so hidden from the
  // sidebar. Its sub-screens are a console route held in App state, not views.
  ai:               { label: 'AI & Intelligence', section: 'Account', icon: Sparkles, requiresOrg: true, hidden: true, description: 'The AI capabilities every module calls, configured for this organization.' },
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
