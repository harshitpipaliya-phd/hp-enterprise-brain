import { describe, expect, it, vi } from 'vitest';

import { openRecordAction } from '../src/components/workspace/GraphExplorer';
import type { GraphNode } from '../src/components/graph/graphTypes';

/**
 * "Open full record" — the id must travel with the click, not just the
 * screen name a deepLink names.
 */
function node(overrides: Partial<GraphNode>): GraphNode {
  return {
    key: 'Department:2', label: 'Department', labels: ['Department'], id: '2',
    title: 'Surgery', subtitle: null, family: 'organization', kind: 'entity',
    count: null, expandable: false, properties: {}, deepLink: 'departments',
    ...overrides,
  };
}

describe('openRecordAction', () => {
  it('opens a Department node straight into that department, not the generic list', () => {
    const onOpenDepartment = vi.fn();
    const onNavigate = vi.fn();

    openRecordAction(node({ label: 'Department', id: '2' }), { onNavigate, onOpenDepartment })?.();

    expect(onOpenDepartment).toHaveBeenCalledWith('2');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('opens a Person node straight into that person, not the generic list', () => {
    const onOpenPerson = vi.fn();
    const onNavigate = vi.fn();

    openRecordAction(node({ label: 'Person', id: '11', deepLink: 'people' }), { onNavigate, onOpenPerson })?.();

    expect(onOpenPerson).toHaveBeenCalledWith('11');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('falls back to the generic navigate for Student, even though its deepLink is also "people"', () => {
    const onOpenPerson = vi.fn();
    const onNavigate = vi.fn();

    openRecordAction(node({ label: 'Student', id: '77', deepLink: 'people' }), { onNavigate, onOpenPerson })?.();

    expect(onOpenPerson).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith('people');
  });

  it('falls back to the generic navigate when no id-aware handler was supplied at all', () => {
    const onNavigate = vi.fn();

    openRecordAction(node({ label: 'Department', id: '2' }), { onNavigate })?.();

    expect(onNavigate).toHaveBeenCalledWith('departments');
  });

  it('returns nothing to call when the node has no deepLink and no id-aware handler applies', () => {
    const onNavigate = vi.fn();

    const action = openRecordAction(node({ label: 'Signal', id: 's-1', deepLink: null }), { onNavigate });

    expect(action).toBeUndefined();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('opens a Signal node straight into its full chain, not the generic Signals list', () => {
    const onOpenChain = vi.fn();
    const onNavigate = vi.fn();

    openRecordAction(node({ label: 'Signal', id: 's-1', deepLink: 'signals' }), { onNavigate, onOpenChain })?.();

    expect(onOpenChain).toHaveBeenCalledWith('s-1');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('opens a Case node straight into that case, not the generic Deliberation screen', () => {
    const onOpenCase = vi.fn();
    const onNavigate = vi.fn();

    openRecordAction(node({ label: 'Case', id: 'c-1', deepLink: 'deliberation' }), { onNavigate, onOpenCase })?.();

    expect(onOpenCase).toHaveBeenCalledWith('c-1');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('opens an Evidence node into the chain of the signal it supports, using the signalId GraphProjection now sends', () => {
    const onOpenChain = vi.fn();
    const onNavigate = vi.fn();

    openRecordAction(
      node({ label: 'Evidence', id: 'ev-1', deepLink: 'evidence', properties: { signalId: 'sig-9' } }),
      { onNavigate, onOpenChain },
    )?.();

    expect(onOpenChain).toHaveBeenCalledWith('sig-9');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('falls back to the generic Evidence list when the evidence has no signal to trace', () => {
    const onOpenChain = vi.fn();
    const onNavigate = vi.fn();

    openRecordAction(
      node({ label: 'Evidence', id: 'ev-2', deepLink: 'evidence', properties: { signalId: null } }),
      { onNavigate, onOpenChain },
    )?.();

    expect(onOpenChain).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith('evidence');
  });
});
