import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExecutiveInterpretationPanel } from '../src/components/workspace/intelligenceUi';
import type { ExecutiveInterpretation } from '../src/api/organizationIntelligence';

/**
 * Opening a screen must never spend a model call. The panel shows a cached interpretation or says
 * none has been generated; only an explicit click by a role that may spend triggers generation.
 * (The server enforces the same rule — this test covers what the user is offered.)
 */

const generateInterpretation = vi.fn();
let role = 'analyst';

vi.mock('../src/api/organizationIntelligence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/organizationIntelligence')>();
  return {
    ...actual,
    organizationIntelligenceApi: {
      ...actual.organizationIntelligenceApi,
      generateInterpretation: (...a: unknown[]) => generateInterpretation(...a),
    },
  };
});

vi.mock('../src/utils/tenant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/tenant')>();
  return { ...actual, getAuthRole: () => role, getAuthTenantId: () => 'tenant-1' };
});

const guardrails = { facts: 'Facts are deterministic.', model_role: 'Interpretation only.', unknown_policy: 'Unknown stays unknown.' };

const notGenerated = {
  status: 'unavailable',
  reason: 'interpretation_not_generated',
  detail: 'Not generated yet.',
  dataVersion: 'v1',
  generatedAt: '2026-09-29T00:00:00Z',
  executive_summary: 'UNKNOWN: interpretation is unavailable.',
  organizational_state: { overall_assessment: '', strengths: [], weaknesses: [], confidence: null },
  critical_findings: [], root_causes: [], blind_spots: [], risks: [], opportunities: [],
  recommendations: [], next_steps: [], guardrails,
} as unknown as ExecutiveInterpretation;

const available = {
  ...notGenerated,
  status: 'available',
  reason: undefined,
  model: 'test-model',
  executive_summary: 'A generated summary.',
} as unknown as ExecutiveInterpretation;

beforeEach(() => {
  generateInterpretation.mockReset();
  role = 'analyst';
});

describe('ExecutiveInterpretationPanel — paid generation is an explicit act', () => {
  it('does not call the API just by rendering', () => {
    render(<ExecutiveInterpretationPanel interpretation={notGenerated} />);

    expect(screen.getByText('No interpretation generated yet.')).toBeTruthy();
    expect(generateInterpretation).not.toHaveBeenCalled();
  });

  it.each(['analyst', 'manager', 'tenant_admin', 'admin'])('offers %s an explicit Generate button', (r) => {
    role = r;
    render(<ExecutiveInterpretationPanel interpretation={notGenerated} />);

    expect(screen.getByRole('button', { name: /Generate AI interpretation/i })).toBeTruthy();
  });

  it.each(['viewer', 'member', ''])('offers no Generate button to role "%s" and says why', (r) => {
    role = r;
    render(<ExecutiveInterpretationPanel interpretation={notGenerated} />);

    expect(screen.queryByRole('button', { name: /Generate AI interpretation/i })).toBeNull();
    expect(screen.getByText(/cannot request a model call/i)).toBeTruthy();
    expect(generateInterpretation).not.toHaveBeenCalled();
  });

  it('spends exactly once, on click, and shows the result', async () => {
    generateInterpretation.mockResolvedValue({ interpretation: available });
    render(<ExecutiveInterpretationPanel interpretation={notGenerated} />);

    fireEvent.click(screen.getByRole('button', { name: /Generate AI interpretation/i }));

    await waitFor(() => expect(screen.getByText('A generated summary.')).toBeTruthy());
    expect(generateInterpretation).toHaveBeenCalledTimes(1);
    expect(generateInterpretation).toHaveBeenCalledWith('tenant-1');
  });

  it('reports a refusal without pretending it worked', async () => {
    generateInterpretation.mockRejectedValue(new Error('Forbidden'));
    render(<ExecutiveInterpretationPanel interpretation={notGenerated} />);

    fireEvent.click(screen.getByRole('button', { name: /Generate AI interpretation/i }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Forbidden'));
    expect(screen.getByText('No interpretation generated yet.')).toBeTruthy();
  });

  it('shows a cached interpretation with no button and no call', () => {
    render(<ExecutiveInterpretationPanel interpretation={available} />);

    expect(screen.getByText('A generated summary.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Generate AI interpretation/i })).toBeNull();
    expect(generateInterpretation).not.toHaveBeenCalled();
  });
});
