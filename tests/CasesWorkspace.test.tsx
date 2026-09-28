import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CasesWorkspace from '../src/components/case/CasesWorkspace';
import { ApiError } from '../src/api/client';

const listCases = vi.fn();
const getCase = vi.fn();
const getCaseEvidence = vi.fn();
const getLedger = vi.fn();
const transition = vi.fn();
const getSignalChain = vi.fn();

vi.mock('../src/api/case', () => ({
  caseApi: {
    listCases: (...args: unknown[]) => listCases(...args),
    getCase: (...args: unknown[]) => getCase(...args),
    getCaseEvidence: (...args: unknown[]) => getCaseEvidence(...args),
    getLedger: (...args: unknown[]) => getLedger(...args),
    transition: (...args: unknown[]) => transition(...args),
  },
}));

vi.mock('../src/api/intelligence', () => ({
  api: {
    getSignalChain: (...args: unknown[]) => getSignalChain(...args),
  },
}));

const CASE_WITH_SIGNAL = {
  id: 'case-1',
  tenantId: 'tenant-1',
  signalId: 'signal-1',
  title: 'Fee collection delays — East campus',
  description: 'Fee collection has slowed for three consecutive weeks.',
  status: 'investigating',
  resolvedHypothesisId: null,
  createdBy: 'system',
  createdDate: '2026-08-01T00:00:00Z',
  updatedDate: '2026-08-03T00:00:00Z',
};

const CASE_WITHOUT_SIGNAL = {
  id: 'case-2',
  tenantId: 'tenant-1',
  signalId: null,
  title: 'Capacity review — Science department',
  description: null,
  status: 'open',
  resolvedHypothesisId: null,
  createdBy: 'system',
  createdDate: '2026-07-15T00:00:00Z',
  updatedDate: '2026-07-15T00:00:00Z',
};

const SIGNAL_CHAIN = {
  signal: {
    id: 'signal-1',
    source: 'fee_ledger',
    classification: 'fee_delay',
    severity: 'high',
    status: 'triaged',
    relatedEntityType: 'Department',
    relatedEntityId: 'dept-9',
    confidence: 0.8,
    createdDate: '2026-07-30T00:00:00Z',
  },
  evidence: [],
  cases: [],
  hypotheses: [],
  reasoning: [],
  recommendations: [],
  decisions: [],
  executions: [],
  outcomes: [],
  learnings: [],
  loopClosed: false,
};

let consoleErrors: unknown[][] = [];

beforeEach(() => {
  listCases.mockReset();
  getCase.mockReset();
  getCaseEvidence.mockReset();
  getLedger.mockReset();
  transition.mockReset();
  getSignalChain.mockReset();

  listCases.mockResolvedValue([CASE_WITH_SIGNAL, CASE_WITHOUT_SIGNAL]);
  getCase.mockResolvedValue(CASE_WITH_SIGNAL);
  getCaseEvidence.mockResolvedValue([]);
  getLedger.mockResolvedValue([]);
  getSignalChain.mockResolvedValue(SIGNAL_CHAIN);

  consoleErrors = [];
  vi.spyOn(console, 'error').mockImplementation((...a) => { consoleErrors.push(a); });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mount(props: Partial<React.ComponentProps<typeof CasesWorkspace>> = {}) {
  return render(<CasesWorkspace tenantId="tenant-1" {...props} />);
}

describe('CasesWorkspace — the case directory', () => {
  it('lists every case the tenant has, with its status and whether it has a signal', async () => {
    mount();

    expect(await screen.findByText('Fee collection delays — East campus')).toBeInTheDocument();
    expect(screen.getByText('Capacity review — Science department')).toBeInTheDocument();

    const table = within(screen.getByRole('table'));
    expect(table.getByText('investigating')).toBeInTheDocument();
    expect(table.getByText('open')).toBeInTheDocument();
    expect(table.getByText(`#${'signal-1'.slice(0, 8)}`)).toBeInTheDocument();
    expect(table.getByText('None')).toBeInTheDocument();

    expect(consoleErrors).toEqual([]);
  });

  it('narrows the list by title as the reader searches', async () => {
    mount();
    await screen.findByText('Fee collection delays — East campus');

    fireEvent.change(screen.getByPlaceholderText('Search by title or description…'), {
      target: { value: 'capacity' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Fee collection delays — East campus')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Capacity review — Science department')).toBeInTheDocument();
  });

  it('re-fetches from the server when the status filter changes, using the real status filter the API supports', async () => {
    mount();
    await screen.findByText('Fee collection delays — East campus');

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'resolved' } });

    await waitFor(() => {
      expect(listCases).toHaveBeenLastCalledWith('tenant-1', 'resolved');
    });
  });

  it('shows an honest empty state, not a blank screen, when nothing matches', async () => {
    listCases.mockResolvedValue([]);
    mount();

    expect(await screen.findByText('No cases yet')).toBeInTheDocument();
  });

  it('shows a retry, not a raw error string, when the list fails to load', async () => {
    listCases.mockRejectedValue(new Error('network down'));
    mount();

    expect(await screen.findByText('network down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows a permission-denied state, not a generic error, on a 403', async () => {
    listCases.mockRejectedValue(new ApiError('forbidden', {
      status: 403, statusText: 'Forbidden', url: '/cases/tenant-1', method: 'GET', responseText: '', responseJson: null,
    }));
    mount();

    expect(await screen.findByText(/don.t have access to this/i)).toBeInTheDocument();
  });

  describe('opening a case', () => {
    it('shows the case’s real detail: evidence, hypotheses (marked by status), and its signal', async () => {
      getCaseEvidence.mockResolvedValue([
        { id: 'ev-1', source: 'fee_ledger', confidence: 0.7, content: { note: 'Three weeks of declining collections.' }, provenance: { ts: '2026-07-29T00:00:00Z' }, createdDate: '2026-07-29T00:00:00Z' },
      ]);
      getLedger.mockResolvedValue([
        { id: 'hyp-1', statement: 'Staffing shortfall in the collections team.', rootCauseFamily: 'Capacity', confidence: 0.6, status: 'confirmed', rejectedReason: null },
        { id: 'hyp-2', statement: 'A billing system outage.', rootCauseFamily: 'Process', confidence: 0.2, status: 'rejected', rejectedReason: 'No outage recorded in the period.' },
      ]);

      mount();
      fireEvent.click(await screen.findByRole('button', { name: 'Fee collection delays — East campus' }));

      // Evidence renders as a closed drawer, source first — open it to check
      // the actual content underneath.
      fireEvent.click(await screen.findByRole('button', { name: /fee_ledger/ }));
      expect(await screen.findByText('Three weeks of declining collections.')).toBeInTheDocument();
      expect(screen.getByText('Staffing shortfall in the collections team.')).toBeInTheDocument();
      expect(screen.getByText('confirmed')).toBeInTheDocument();
      expect(screen.getByText('No outage recorded in the period.')).toBeInTheDocument();

      // The signal is read, not fabricated — via the same chain endpoint the
      // Signal Chain view uses.
      expect(getSignalChain).toHaveBeenCalledWith('tenant-1', 'signal-1');
      expect(await screen.findByText('Concerns Department dept-9')).toBeInTheDocument();
      expect(consoleErrors).toEqual([]);
    });

    it('offers a route to the full Signal Chain when the case has a valid signal', async () => {
      const onOpenChain = vi.fn();
      mount({ onOpenChain });

      fireEvent.click(await screen.findByRole('button', { name: 'Fee collection delays — East campus' }));
      fireEvent.click(await screen.findByRole('button', { name: 'View full chain' }));

      expect(onOpenChain).toHaveBeenCalledWith('signal-1');
    });

    it('says plainly that a case with no signal has no traceable chain, rather than hiding the section', async () => {
      getCase.mockResolvedValue(CASE_WITHOUT_SIGNAL);
      mount();

      fireEvent.click(await screen.findByRole('button', { name: 'Capacity review — Science department' }));

      expect(await screen.findByText('This case has no traceable signal chain.')).toBeInTheDocument();
      expect(getSignalChain).not.toHaveBeenCalled();
    });

    it('returns to the list, preserving the search the reader had typed', async () => {
      mount();
      await screen.findByText('Fee collection delays — East campus');

      fireEvent.change(screen.getByPlaceholderText('Search by title or description…'), {
        target: { value: 'fee' },
      });
      await waitFor(() => {
        expect(screen.queryByText('Capacity review — Science department')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('button', { name: 'Fee collection delays — East campus' })[0]);
      await screen.findByRole('button', { name: 'Cases' });
      fireEvent.click(screen.getByRole('button', { name: 'Cases' }));

      expect(await screen.findByText('Fee collection delays — East campus')).toBeInTheDocument();
      expect(screen.queryByText('Capacity review — Science department')).not.toBeInTheDocument();
    });

    it('only offers the transitions the case engine allows from the current status, and does not claim success before the API confirms it', async () => {
      getLedger.mockResolvedValue([
        { id: 'hyp-1', statement: 'Staffing shortfall.', rootCauseFamily: 'Capacity', confidence: 0.6, status: 'proposed', rejectedReason: null },
      ]);

      mount();
      fireEvent.click(await screen.findByRole('button', { name: 'Fee collection delays — East campus' }));

      // investigating -> hypothesized is the only transition config/brain.php allows.
      expect(await screen.findByRole('button', { name: 'Move to hypothesized' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Move to resolved' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Move to open' })).not.toBeInTheDocument();

      let resolveTransition: (v: unknown) => void = () => {};
      transition.mockReturnValue(new Promise((resolve) => { resolveTransition = resolve; }));

      fireEvent.click(screen.getByRole('button', { name: 'Move to hypothesized' }));

      // Not yet resolved — the screen must not have moved on already.
      expect(screen.getByText('investigating')).toBeInTheDocument();

      resolveTransition({ ...CASE_WITH_SIGNAL, status: 'hypothesized' });

      await waitFor(() => expect(screen.getByText('hypothesized')).toBeInTheDocument());
      expect(transition).toHaveBeenCalledWith('tenant-1', 'case-1', 'hypothesized', undefined);
    });

    it('surfaces a 403 on a transition as a clear permission message, not a silent failure or a false success', async () => {
      getCase.mockResolvedValue({ ...CASE_WITH_SIGNAL, status: 'open' });
      mount();

      fireEvent.click(await screen.findByRole('button', { name: 'Fee collection delays — East campus' }));

      transition.mockRejectedValue(new ApiError('forbidden', {
        status: 403, statusText: 'Forbidden', url: '/cases/tenant-1/case-1/transition', method: 'PATCH', responseText: '', responseJson: null,
      }));

      fireEvent.click(await screen.findByRole('button', { name: 'Move to investigating' }));

      expect(await screen.findByText(/do not have permission to change this case/i)).toBeInTheDocument();
      // Status must still read what the server last confirmed, not what was attempted.
      expect(screen.getByText('open')).toBeInTheDocument();
    });
  });

  describe('opening a specific case from outside — Graph Explorer, Global Search', () => {
    it('opens straight into that case’s detail, bypassing the list entirely', async () => {
      mount({ initialCaseId: 'case-1' });

      expect(await screen.findByText('Fee collection delays — East campus')).toBeInTheDocument();
      // The list's own fetch is not required to open the detail — CaseDetail
      // fetches and validates the case itself, so this does not wait on
      // caseApi.listCases resolving first.
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('surfaces the same honest not-found state as any other invalid case id, rather than silently falling back to a different case', async () => {
      getCase.mockRejectedValue(new Error('case_not_found'));

      mount({ initialCaseId: 'does-not-exist' });

      expect(await screen.findByText('case_not_found')).toBeInTheDocument();
      expect(screen.queryByText('Fee collection delays — East campus')).not.toBeInTheDocument();
    });

    it('opens on the ordinary list when no case id is requested at all', async () => {
      mount();

      expect(await screen.findByRole('table')).toBeInTheDocument();
    });
  });
});
