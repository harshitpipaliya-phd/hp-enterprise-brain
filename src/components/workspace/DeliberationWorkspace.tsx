import { useState, useEffect } from 'react';
import { caseApi } from '../../api/case';
import { useTheme } from '../../hooks/useTheme';

interface Case { id: string; title: string; status: string; resolvedHypothesisId: string | null }
interface Hypothesis {
  id: string; statement: string; rootCauseFamily: string; confidence: number;
  status: 'proposed' | 'supported' | 'rejected' | 'confirmed'; rejectedReason: string | null; createdDate: string;
}

const ROOT_CAUSE_FAMILIES = ['Capability', 'Capacity', 'Process', 'Information', 'Motivation', 'Coordination', 'External', 'Policy'];
const STATUS_COLOR: Record<string, string> = { proposed: '#3b82f6', supported: '#22c55e', rejected: '#ef4444', confirmed: '#8b5cf6' };

/**
 * Deliberation Workspace (EPIC-004). The Hypothesis Ledger, visible — every
 * hypothesis tried for a case, in order, including rejections and why.
 * This is the screen §12.3's "deliberation moment" demo actually needs.
 */
export default function DeliberationWorkspace({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [cases, setCases] = useState<Case[]>([]);
  const [active, setActive] = useState<Case | null>(null);
  const [ledger, setLedger] = useState<Hypothesis[]>([]);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [caseTitle, setCaseTitle] = useState('');
  const [showHypForm, setShowHypForm] = useState(false);
  const [hypStatement, setHypStatement] = useState('');
  const [hypFamily, setHypFamily] = useState(ROOT_CAUSE_FAMILIES[0]);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const loadCases = async () => {
    try { setCases(await caseApi.listCases(tenantId)); } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { loadCases(); }, [tenantId]);

  const openCase = async (c: Case) => {
    setActive(c);
    try { setLedger(await caseApi.getLedger(tenantId, c.id)); } catch (e: any) { setError(e.message); }
  };

  const createCase = async () => {
    if (!caseTitle.trim()) return;
    try {
      const c = await caseApi.createCase({ tenantId, title: caseTitle });
      await caseApi.transition(tenantId, c.id, 'investigating');
      setCaseTitle('');
      setShowCaseForm(false);
      await loadCases();
      openCase({ ...c, status: 'investigating' });
    } catch (e: any) { setError(e.message); }
  };

  const proposeHypothesis = async () => {
    if (!active || !hypStatement.trim()) return;
    try {
      await caseApi.proposeHypothesis({ tenantId, caseId: active.id, statement: hypStatement, rootCauseFamily: hypFamily });
      setHypStatement('');
      setShowHypForm(false);
      setLedger(await caseApi.getLedger(tenantId, active.id));
    } catch (e: any) { setError(e.message); }
  };

  const reject = async (h: Hypothesis) => {
    const reason = rejectReason[h.id];
    if (!reason?.trim()) { setError('A rejection reason is required — this is what makes the ledger a real deliberation trace.'); return; }
    if (!active) return;
    try {
      await caseApi.rejectHypothesis(tenantId, active.id, h.id, reason);
      setLedger(await caseApi.getLedger(tenantId, active.id));
    } catch (e: any) { setError(e.message); }
  };

  const confirm = async (h: Hypothesis) => {
    if (!active) return;
    try {
      await caseApi.confirmHypothesis(tenantId, active.id, h.id);
      setLedger(await caseApi.getLedger(tenantId, active.id));
      await loadCases();
      const updated = await caseApi.getCase(tenantId, active.id);
      setActive(updated);
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 8 }}>Deliberation Workspace</h1>
      <p style={{ color: theme.textMuted, marginBottom: 24, fontSize: 13 }}>
        Every hypothesis considered for a case, in order — including what was rejected and why. Nothing here is ever overwritten.
      </p>

      {error && <div style={{ padding: 10, borderRadius: 6, backgroundColor: '#ef444420', color: '#ef4444', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24 }}>
        <div>
          <button onClick={() => setShowCaseForm((s) => !s)} style={{ width: '100%', marginBottom: 12 }}>+ New Case</button>
          {showCaseForm && (
            <div style={{ marginBottom: 12, display: 'grid', gap: 6 }}>
              <input placeholder="Case title" value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text }} />
              <button onClick={createCase}>Create & Start Investigating</button>
            </div>
          )}
          <div style={{ display: 'grid', gap: 4 }}>
            {cases.map((c) => (
              <div key={c.id} onClick={() => openCase(c)} style={{ padding: 8, borderRadius: 6, cursor: 'pointer', backgroundColor: active?.id === c.id ? theme.surface : 'transparent', border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: 13 }}>{c.title}</div>
                <div style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase' }}>{c.status}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {!active ? (
            <p style={{ color: theme.textMuted }}>Select or create a case to begin deliberation.</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>{active.title}</h2>
                <button onClick={() => setShowHypForm((s) => !s)} disabled={active.status === 'resolved' || active.status === 'closed'}>
                  + Propose Hypothesis
                </button>
              </div>

              {showHypForm && (
                <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, marginBottom: 16, display: 'grid', gap: 8 }}>
                  <input placeholder="Hypothesis statement" value={hypStatement} onChange={(e) => setHypStatement(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }} />
                  <select value={hypFamily} onChange={(e) => setHypFamily(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }}>
                    {ROOT_CAUSE_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <button onClick={proposeHypothesis}>Propose</button>
                </div>
              )}

              <h3>Hypothesis Ledger — the deliberation trace</h3>
              {ledger.length === 0 ? (
                <p style={{ color: theme.textMuted }}>No hypotheses proposed yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {ledger.map((h) => (
                    <div key={h.id} style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${STATUS_COLOR[h.status]}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, textTransform: 'uppercase', color: STATUS_COLOR[h.status] }}>{h.status} · {h.rootCauseFamily}</span>
                        <span style={{ fontSize: 11, color: theme.textMuted }}>{Math.round(h.confidence * 100)}% confidence</span>
                      </div>
                      <div style={{ margin: '4px 0' }}>{h.statement}</div>
                      {h.rejectedReason && <div style={{ fontSize: 12, color: theme.textMuted, fontStyle: 'italic' }}>Rejected because: {h.rejectedReason}</div>}
                      {h.status === 'proposed' && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                          <button onClick={() => confirm(h)}>Confirm (resolves case)</button>
                          <input
                            placeholder="Rejection reason (required)"
                            value={rejectReason[h.id] ?? ''}
                            onChange={(e) => setRejectReason({ ...rejectReason, [h.id]: e.target.value })}
                            style={{ flex: 1, padding: 4, borderRadius: 4, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, fontSize: 12 }}
                          />
                          <button onClick={() => reject(h)}>Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
