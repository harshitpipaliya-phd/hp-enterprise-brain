import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, FolderSearch, RefreshCw, Workflow } from 'lucide-react';
import {
  Button, PageHeader, HeaderActions, SearchInput, Select, StatusBadge,
  DataTable, TablePagination, EmptyState, ErrorState as UiErrorState,
  PermissionDeniedState,
} from '../../ui';
import type { Column, BadgeTone } from '../../ui';
import { ApiError } from '../../api/client';
import { caseApi } from '../../api/case';
import { api as intelligenceApi } from '../../api/intelligence';
import { Panel, SectionHeading, Pill, shortDate } from '../intelligence/parts';
import { EvidenceLink } from '../rcl';
import '../intelligence/intelligence.css';

/**
 * THE CASES WORKSPACE.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHY THIS SCREEN EXISTS
 *
 * Before this, a case could only be reached two ways: through a signal's chain
 * (Signal Chain view), or by "Open case" on a department's recommendation —
 * and the second of those used to be a dead end, since nothing let a reader
 * come back and find the case again. Neither is a directory. This is: every
 * case the tenant has, searchable and filterable, with nothing invented that
 * the API does not actually return.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE TRANSITION TABLE MIRRORS THE SERVER, IT DOES NOT REPLACE IT
 *
 * CASE_TRANSITIONS below is a read-only copy of config/brain.php's
 * case_transitions, kept here only to decide which buttons to draw. The
 * server re-validates every transition through CaseService::assertTransition
 * regardless of what this screen offers — a stale copy can show a button that
 * then 422s, but it can never let an invalid transition actually happen.
 */

type CaseStatus = 'open' | 'investigating' | 'hypothesized' | 'resolved' | 'closed';
type HypothesisStatus = 'proposed' | 'supported' | 'rejected' | 'confirmed';

interface CaseRow {
  id: string;
  tenantId: string;
  signalId: string | null;
  title: string;
  description: string | null;
  status: CaseStatus;
  resolvedHypothesisId: string | null;
  createdBy: string;
  createdDate: string;
  updatedDate: string;
}

interface EvidenceRow {
  id: string;
  source: string;
  confidence: number;
  content: Record<string, unknown> | null;
  provenance: { ts?: string } | null;
  createdDate: string;
}

interface HypothesisRowData {
  id: string;
  statement: string;
  rootCauseFamily: string;
  confidence: number | null;
  status: HypothesisStatus;
  rejectedReason: string | null;
}

interface SignalSummary {
  id: string;
  source: string;
  classification: string;
  severity: string;
  status: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  confidence: number | null;
}

const CASE_STATUSES: CaseStatus[] = ['open', 'investigating', 'hypothesized', 'resolved', 'closed'];

const STATUS_TONE: Record<CaseStatus, BadgeTone> = {
  open: 'info',
  investigating: 'warning',
  hypothesized: 'warning',
  resolved: 'success',
  closed: 'neutral',
};

/** Verbatim from config/brain.php `case_transitions`. See the file doc above. */
const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  open: ['investigating'],
  investigating: ['hypothesized'],
  hypothesized: ['investigating', 'resolved'],
  resolved: ['closed'],
  closed: [],
};

const HYPOTHESIS_TONE: Record<HypothesisStatus, BadgeTone> = {
  proposed: 'neutral',
  supported: 'info',
  rejected: 'danger',
  confirmed: 'success',
};

/** What this evidence says, read out of its content object — the same
 *  fallback rule used in Evidence and in the Signal Chain view: a preferred
 *  free-text field first, then the object's own key: value pairs. */
function evidenceText(item: EvidenceRow): string {
  const content = item.content ?? {};
  const preferred = (content as Record<string, unknown>).note
    ?? (content as Record<string, unknown>).text
    ?? (content as Record<string, unknown>).summary
    ?? (content as Record<string, unknown>).description;

  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
  if (preferred !== undefined && preferred !== null && typeof preferred !== 'object') return String(preferred);

  const pairs = Object.entries(content)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${String(v)}`);

  return pairs.length > 0 ? pairs.join(' · ') : 'No readable detail was recorded with this evidence.';
}

const PAGE_SIZE = 10;

export default function CasesWorkspace({
  tenantId,
  onOpenChain,
  initialCaseId,
}: {
  tenantId: string;
  /** Opens the Signal Chain view for a signal — the same navigator Signals
   *  and Department Intelligence already use. */
  onOpenChain?: (signalId: string) => void;
  /** A specific case requested from outside this screen — Graph Explorer or
   *  Global Search, currently. Opens straight into that case's detail;
   *  CaseDetail does its own fetch-and-validate, so an id that turns out not
   *  to exist (or belongs to another tenant) surfaces its own honest error
   *  rather than silently falling back to a different case. Read only once,
   *  at mount — like initialDepartmentId/initialPersonId, a later change to
   *  this prop without the component remounting does not reopen it. */
  initialCaseId?: string | null;
}) {
  const [mode, setMode] = useState<'list' | 'detail'>(initialCaseId ? 'detail' : 'list');
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(initialCaseId ?? null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPermissionDenied(false);
    try {
      const rows = await caseApi.listCases(tenantId, statusFilter || undefined);
      setCases(rows);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setPermissionDenied(true);
      else setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }, [tenantId, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter, search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) =>
      c.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q));
  }, [cases, search]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCase = (id: string) => { setSelectedId(id); setMode('detail'); };
  const backToList = () => { setMode('list'); setSelectedId(null); };

  const columns: Column<CaseRow>[] = [
    {
      key: 'title',
      header: 'Case',
      render: (c) => (
        <button type="button" className="eb-link-btn" onClick={() => openCase(c.id)}>{c.title}</button>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <StatusBadge tone={STATUS_TONE[c.status]} icon={false}>{c.status}</StatusBadge>,
    },
    {
      key: 'signal',
      header: 'Signal',
      secondary: true,
      render: (c) => (c.signalId ? `#${c.signalId.slice(0, 8)}` : <span className="u-muted">None</span>),
    },
    {
      key: 'created',
      header: 'Opened',
      secondary: true,
      render: (c) => shortDate(c.createdDate) ?? '—',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <button type="button" className="eb-pill-btn" onClick={() => openCase(c.id)}>Open</button>
      ),
    },
  ];

  if (permissionDenied) {
    return (
      <div className="dv">
        <PageHeader variant="list" icon={<FolderSearch />} title="Cases" description="Every investigation opened from a signal or a recommendation." />
        <PermissionDeniedState requiredPermission="read" />
      </div>
    );
  }

  if (mode === 'detail' && selectedId) {
    return (
      <CaseDetail
        tenantId={tenantId}
        caseId={selectedId}
        onBack={backToList}
        onOpenChain={onOpenChain}
        onStatusChanged={load}
      />
    );
  }

  return (
    <div className="dv">
      <PageHeader
        variant="list"
        icon={<FolderSearch />}
        title="Cases"
        description="Every investigation opened from a signal or a recommendation, across this organization."
        actions={(
          <HeaderActions>
            <Button variant="secondary" size="sm" loading={loading} icon={<RefreshCw size={14} aria-hidden="true" />} onClick={load}>
              Refresh
            </Button>
          </HeaderActions>
        )}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchInput value={search} onValueChange={setSearch} placeholder="Search by title or description…" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={paged}
        rowKey={(c) => c.id}
        loading={loading}
        error={error}
        onRetry={load}
        caption="Cases"
        empty={(
          <EmptyState
            title={search || statusFilter ? 'No cases match these filters' : 'No cases yet'}
            description={
              search || statusFilter
                ? 'Try a different search term or status.'
                : 'A case is opened from a signal, or from a recommendation on a department’s intelligence screen.'
            }
          />
        )}
      />

      {!loading && !error && filtered.length > 0 && (
        <TablePagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      )}
    </div>
  );
}

/* ============================================================================
   CASE DETAIL
   ========================================================================== */

function CaseDetail({
  tenantId,
  caseId,
  onBack,
  onOpenChain,
  onStatusChanged,
}: {
  tenantId: string;
  caseId: string;
  onBack: () => void;
  onOpenChain?: (signalId: string) => void;
  /** The list this detail was opened from is stale the moment a transition
   *  succeeds — this refetches it in the background so going back shows the
   *  new status rather than the one the reader left. */
  onStatusChanged: () => void;
}) {
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [hypotheses, setHypotheses] = useState<HypothesisRowData[]>([]);
  const [signal, setSignal] = useState<SignalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [resolveHypothesisId, setResolveHypothesisId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [caseData, evidenceData, hypothesesData] = await Promise.all([
        caseApi.getCase(tenantId, caseId),
        caseApi.getCaseEvidence(tenantId, caseId),
        caseApi.getLedger(tenantId, caseId),
      ]);

      setCaseRow(caseData);
      setEvidence(evidenceData ?? []);
      setHypotheses(hypothesesData ?? []);

      // The signal is read through the Signal Chain endpoint rather than a
      // dedicated signal-by-id call — it is the one already built and tested
      // for exactly this fact, and it is also what "View full chain" needs.
      if (caseData.signalId) {
        try {
          const chain = await intelligenceApi.getSignalChain(tenantId, caseData.signalId);
          setSignal(chain.signal ?? null);
        } catch {
          // The case itself loaded fine; a signal that can no longer be read
          // is a fact about the signal, not about the case, so it does not
          // fail this screen — the "no traceable chain" branch below covers it.
          setSignal(null);
        }
      } else {
        setSignal(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }, [tenantId, caseId]);

  useEffect(() => { load(); }, [load]);

  const transition = async (status: CaseStatus) => {
    if (!caseRow) return;

    setTransitioning(true);
    setTransitionError(null);
    try {
      const updated = await caseApi.transition(
        tenantId,
        caseId,
        status,
        status === 'resolved' ? resolveHypothesisId : undefined,
      );
      setCaseRow(updated);
      onStatusChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setTransitionError('You do not have permission to change this case’s status.');
      } else {
        setTransitionError(e instanceof Error ? e.message : 'That transition could not be completed.');
      }
    } finally {
      setTransitioning(false);
    }
  };

  const confirmedHypotheses = hypotheses.filter((h) => h.status === 'confirmed');

  if (loading) {
    return (
      <div className="dv">
        <div className="dv-toolbar">
          <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} aria-hidden="true" />} onClick={onBack}>Cases</Button>
        </div>
        <div className="dv-empty" role="status"><b>Loading case…</b></div>
      </div>
    );
  }

  if (error || !caseRow) {
    return (
      <div className="dv">
        <div className="dv-toolbar">
          <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} aria-hidden="true" />} onClick={onBack}>Cases</Button>
        </div>
        <UiErrorState message={error ?? 'This case could not be found.'} onRetry={load} />
      </div>
    );
  }

  const nextStatuses = CASE_TRANSITIONS[caseRow.status] ?? [];

  return (
    <div className="dv">
      <div className="dv-toolbar">
        <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} aria-hidden="true" />} onClick={onBack}>Cases</Button>
      </div>

      <Panel title={caseRow.title} sub={`Opened ${shortDate(caseRow.createdDate)} · Last updated ${shortDate(caseRow.updatedDate)}`}>
        <div className="dv-row">
          <span className="dv-row__lab">
            {caseRow.description || 'No description recorded.'}
          </span>
          <span className="dv-row__val">
            <StatusBadge tone={STATUS_TONE[caseRow.status]} icon={false}>{caseRow.status}</StatusBadge>
          </span>
        </div>
      </Panel>

      <SectionHeading title="Signal" sub="the confirmed trigger this case was opened from" />
      {caseRow.signalId && signal ? (
        <Panel>
          <div className="dv-row">
            <span className="dv-row__lab">
              {signal.classification}
              <span className="dv-why">
                {signal.relatedEntityType
                  ? `Concerns ${signal.relatedEntityType}${signal.relatedEntityId ? ` ${signal.relatedEntityId}` : ''}`
                  : 'No related entity recorded.'}
              </span>
            </span>
            <span className="dv-row__val" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Pill tone="neutral">{signal.severity}</Pill>
              {onOpenChain && (
                <Button variant="secondary" size="sm" icon={<Workflow size={14} aria-hidden="true" />} onClick={() => onOpenChain(signal.id)}>
                  View full chain
                </Button>
              )}
            </span>
          </div>
        </Panel>
      ) : caseRow.signalId ? (
        <div className="dv-empty"><b>This case's signal could not be loaded.</b><span>It may have been removed, or is outside your tenant.</span></div>
      ) : (
        <div className="dv-empty"><b>This case has no traceable signal chain.</b><span>It was opened without a signal attached, so there is nothing here to trace.</span></div>
      )}

      <SectionHeading title="Evidence" sub="attached to this case" />
      {evidence.length === 0 ? (
        <div className="dv-empty"><b>No evidence has been attached to this case yet.</b></div>
      ) : (
        <div className="dv-stack">
          {evidence.map((e) => (
            <EvidenceLink key={e.id} evidence={{ id: e.id, source: e.source, confidence: e.confidence, provenanceTs: e.provenance?.ts ?? '', content: evidenceText(e) }} />
          ))}
        </div>
      )}

      <SectionHeading title="Hypotheses" sub="confirmed status is shown separately from a proposal or a rejection" />
      {hypotheses.length === 0 ? (
        <div className="dv-empty"><b>No hypothesis has been proposed for this case yet.</b></div>
      ) : (
        <div className="dv-stack">
          {hypotheses.map((h) => (
            <div key={h.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, backgroundColor: 'var(--surface-card)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--content-primary)' }}>{h.statement}</span>
                <StatusBadge tone={HYPOTHESIS_TONE[h.status]} icon={false}>{h.status}</StatusBadge>
              </div>
              <div style={{ fontSize: 11, color: 'var(--content-tertiary)', marginTop: 4 }}>
                {h.rootCauseFamily} · Confidence: {h.confidence !== null && h.confidence !== undefined ? `${(h.confidence * 100).toFixed(0)}%` : '—'}
              </div>
              {h.status === 'rejected' && h.rejectedReason && (
                <div style={{ fontSize: 12, color: 'var(--content-tertiary)', marginTop: 4, fontStyle: 'italic' }}>{h.rejectedReason}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <SectionHeading title="Move this case" sub="only the transitions the case engine allows from its current status" />
      {nextStatuses.length === 0 ? (
        <div className="dv-empty"><b>This case is closed. No further transition is available.</b></div>
      ) : (
        <Panel>
          {caseRow.status === 'hypothesized' && nextStatuses.includes('resolved') && (
            <div className="dv-row" style={{ marginBottom: 8 }}>
              <span className="dv-row__lab">
                Resolve with
                <span className="dv-why">
                  {confirmedHypotheses.length === 0
                    ? 'No hypothesis under this case has been confirmed yet — resolving requires one.'
                    : 'Which confirmed hypothesis explains this case.'}
                </span>
              </span>
              <span className="dv-row__val">
                <Select
                  value={resolveHypothesisId}
                  onChange={(e) => setResolveHypothesisId(e.target.value)}
                  disabled={confirmedHypotheses.length === 0}
                  aria-label="Confirmed hypothesis to resolve with"
                >
                  <option value="">Select a confirmed hypothesis…</option>
                  {confirmedHypotheses.map((h) => (
                    <option key={h.id} value={h.id}>{h.statement}</option>
                  ))}
                </Select>
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {nextStatuses.map((s) => (
              <Button
                key={s}
                variant="primary"
                size="sm"
                loading={transitioning}
                disabled={s === 'resolved' && !resolveHypothesisId}
                onClick={() => transition(s)}
              >
                Move to {s}
              </Button>
            ))}
          </div>

          {transitionError && <p className="dv-why" role="alert" style={{ marginTop: 8 }}>{transitionError}</p>}
        </Panel>
      )}
    </div>
  );
}
