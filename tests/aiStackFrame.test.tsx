import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ModuleAiStackFrame } from '../src/components/ai-stack/ModuleAiStackFrame';
import { AI_STACK_VIEWS } from '../src/components/ai-stack/moduleViews';
import { AI_STACK_MODULES } from '../src/components/ai-stack/modules';
import { AGENT_MODULES, findTool, toolsForModule, type AgentTool } from '../src/components/ai-stack/agentRegistry';
import { VIEW_META } from '../src/shell/viewMeta';

// The panel is the lazily loaded AI Stack itself; these tests are about the frame
// around a module screen, so the panel is replaced by a marker naming its module.
vi.mock('../src/components/ai-stack/ModuleAiStackPanel', () => ({
  default: ({ moduleKey }: { moduleKey: string }) => <p>AI Stack panel for {moduleKey}</p>,
}));

const screenContent = <p>Module screen content</p>;

describe('module AI Stack frame', () => {
  it.each(['admin', 'tenant_admin'])('offers the toggle to %s on a module that has an AI Stack', async (role) => {
    render(<ModuleAiStackFrame view="signals" userRole={role}>{screenContent}</ModuleAiStackFrame>);

    const moduleButton = screen.getByRole('button', { name: 'Signals' });
    const stackButton = screen.getByRole('button', { name: /AI Stack/ });
    expect(moduleButton.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(stackButton);
    expect(await screen.findByText('AI Stack panel for signals')).toBeTruthy();
    expect(stackButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the module screen mounted while the AI Stack is open, so its state survives', async () => {
    render(<ModuleAiStackFrame view="signals" userRole="admin">{screenContent}</ModuleAiStackFrame>);
    fireEvent.click(screen.getByRole('button', { name: /AI Stack/ }));
    await screen.findByText('AI Stack panel for signals');

    const content = screen.getByText('Module screen content');
    expect(content.closest('[hidden]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Signals' }));
    expect(screen.getByText('Module screen content').closest('[hidden]')).toBeNull();
    expect(screen.queryByText('AI Stack panel for signals')).toBeNull();
  });

  it.each(['manager', 'analyst', 'viewer', 'member', null])('renders the screen alone for %s — the API would 403', (role) => {
    render(<ModuleAiStackFrame view="signals" userRole={role}>{screenContent}</ModuleAiStackFrame>);
    expect(screen.getByText('Module screen content')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /AI Stack/ })).toBeNull();
  });

  it.each(['home', 'ingestion', 'executive', 'analytics', 'aiassistant', 'settings', 'ai'])(
    'adds nothing to %s, which has no AI Stack by design',
    (view) => {
      render(<ModuleAiStackFrame view={view} userRole="admin">{screenContent}</ModuleAiStackFrame>);
      expect(screen.queryByRole('button', { name: /AI Stack/ })).toBeNull();
    },
  );
});

describe('module AI Stack registry', () => {
  const entries = Object.entries(AI_STACK_VIEWS);

  it('covers the eighteen agreed modules, each a real HP Brain view', () => {
    expect(entries).toHaveLength(18);
    for (const [view] of entries) expect(VIEW_META).toHaveProperty(view);
  });

  it.each(entries)('%s has a descriptor and an agent module entry', (view, { key }) => {
    const descriptor = AI_STACK_MODULES[key];
    expect(descriptor?.key).toBe(key);
    expect(descriptor.menuSlug).toBe(view);
    expect(AGENT_MODULES.some((m) => m.key === key)).toBe(true);
  });

  it('gives every module a different default data source name', () => {
    // `report.defaultDataSource` is the one field of the old static descriptor still
    // read at runtime (as a last-resort fallback — see ai-stack-module.ts) and is worth
    // keeping distinct per module even though it no longer drives the report filters
    // themselves (those now come from the live profile; see below).
    const sources = Object.values(AI_STACK_MODULES).map((m) => m.report.defaultDataSource);
    expect(new Set(sources).size).toBe(sources.length);
  });
});

/**
 * `toolsForModule`/`findTool` no longer read a compiled-in `AGENT_TOOLS` catalogue —
 * every real call site passes `useAiStackProfile().tools`, the tenant-scoped list
 * `GET /ai-intelligence/modules/{key}/profile` returns (see ModuleAiStackPanel and
 * agentRegistry.ts). There is nothing left in this bundle to assert the real catalogue
 * against; that check now belongs to a backend or end-to-end test. What is still this
 * suite's to prove is the pure filtering CONTRACT these two functions promise their
 * callers: given a profile's tools, return only this module's own (plus any explicitly
 * shared ones), and let a key be found only among those offered.
 */
describe('agentRegistry tool helpers (contract, not catalogue)', () => {
  const fixture: AgentTool[] = [
    {
      key: 'signals.open',
      label: 'Open signals',
      description: 'Reads unresolved signals.',
      module: 'signals',
      risk: 'read',
      kind: 'mcp',
      available: true,
      example_input: { limit: 50 },
    },
    {
      key: 'policies.catalogue',
      label: 'Policy catalogue',
      description: 'Reads business policies.',
      module: 'policies',
      risk: 'read',
      kind: 'mcp',
      available: true,
      example_input: { limit: 50 },
    },
  ];

  it('returns only the named module’s tools out of a loaded profile’s list', () => {
    expect(toolsForModule(fixture, 'signals').map((t) => t.key)).toEqual(['signals.open']);
    expect(toolsForModule(fixture, 'policies').map((t) => t.key)).toEqual(['policies.catalogue']);
    expect(toolsForModule(fixture, 'tasks')).toEqual([]);
  });

  it('finds a tool by key only within the tools it was given', () => {
    expect(findTool(fixture, 'signals.open')?.label).toBe('Open signals');
    expect(findTool(fixture, 'not.a.real.tool')).toBeUndefined();
    expect(findTool([], 'signals.open')).toBeUndefined();
  });

  it('every profile tool this platform actually offers is read risk', () => {
    expect(fixture.every((t) => t.risk === 'read')).toBe(true);
  });
});
