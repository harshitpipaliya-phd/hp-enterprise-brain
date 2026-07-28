import { useState, useEffect } from 'react';
import { policyApi } from '../../api/policy';
import { useTheme } from '../../hooks/useTheme';

interface Rule { field?: string; operator?: string; value?: unknown; conditions?: Array<{ field: string; operator: string; value: unknown }>; match?: 'all' | 'any'; action: string }
interface Policy { id: string; name: string; scope: string; policyType: string; rules: Rule[]; version: number; createdDate: string }

interface Condition { field: string; operator: string; value: string }

/**
 * Policy Management. Real, previously zero UI despite governing the
 * safety-critical autonomous-approval mechanism (Sprint 6).
 *
 * The rule builder below closes a real gap: the Policy Engine has
 * supported multi-condition AND/OR rules since Sprint 10, but this screen
 * only ever exposed a single flat field/operator/value form — meaning a
 * business user could never actually reach that capability without
 * writing raw JSON against the API. This is the "no-code rule builder"
 * this project can honestly deliver: a real add/remove condition list and
 * an AND/OR toggle, not a drag-and-drop visual designer.
 */
export default function PolicyManagement({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('recommendations');
  const [policyType, setPolicyType] = useState<'executor_autonomy' | 'business_rule'>('business_rule');
  const [conditions, setConditions] = useState<Condition[]>([{ field: 'recommendation.category', operator: 'eq', value: 'risk' }]);
  const [match, setMatch] = useState<'all' | 'any'>('all');
  const [ruleAction, setRuleAction] = useState('escalate');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setPolicies(await policyApi.list(tenantId));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  const addCondition = () => setConditions((c) => [...c, { field: '', operator: 'eq', value: '' }]);
  const removeCondition = (i: number) => setConditions((c) => c.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, patch: Partial<Condition>) => setConditions((c) => c.map((cond, idx) => idx === i ? { ...cond, ...patch } : cond));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const parsedConditions = conditions.map((c) => ({ field: c.field, operator: c.operator, value: isNaN(Number(c.value)) ? c.value : Number(c.value) }));
      // Single condition serializes as the original flat form (backward
      // compatible with every policy created before this UI existed);
      // multiple conditions use the real composite form.
      const rule = parsedConditions.length === 1
        ? { ...parsedConditions[0], action: ruleAction }
        : { conditions: parsedConditions, match, action: ruleAction };
      await policyApi.create({ tenantId, name, scope, policyType, rules: [rule] });
      setName(''); setShowForm(false);
      setConditions([{ field: 'recommendation.category', operator: 'eq', value: 'risk' }]);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1>Policy Management</h1>
        <button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ New Policy'}</button>
      </header>
      <p style={{ color: theme.textMuted, marginBottom: 24, fontSize: 13 }}>
        Policies govern autonomous decision approval. An <code>executor_autonomy</code>-type policy with an <code>auto_approve</code> action can let the system approve recommendations without a human — <strong>except</strong> opportunity-category recommendations, which are hard-blocked regardless of any policy.
      </p>

      {showForm && (
        <form onSubmit={submit} style={{ padding: 16, borderRadius: 8, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, marginBottom: 24, display: 'grid', gap: 8 }}>
          <input placeholder="Policy name" value={name} onChange={(e) => setName(e.target.value)} required style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }} />
          <input placeholder="Scope (e.g. recommendations)" value={scope} onChange={(e) => setScope(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }} />
          <select value={policyType} onChange={(e) => setPolicyType(e.target.value as any)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }}>
            <option value="business_rule">business_rule</option>
            <option value="executor_autonomy">executor_autonomy</option>
          </select>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: theme.textMuted }}>Conditions</span>
              {conditions.length > 1 && (
                <label style={{ fontSize: 12 }}>
                  Match:
                  <select value={match} onChange={(e) => setMatch(e.target.value as 'all' | 'any')} style={{ marginLeft: 6, padding: 4, borderRadius: 4, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }}>
                    <option value="all">All (AND)</option>
                    <option value="any">Any (OR)</option>
                  </select>
                </label>
              )}
            </div>
            {conditions.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8 }}>
                <input placeholder="field" value={c.field} onChange={(e) => updateCondition(i, { field: e.target.value })} required style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }} />
                <select value={c.operator} onChange={(e) => updateCondition(i, { operator: e.target.value })} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }}>
                  {['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'in'].map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
                <input placeholder="value" value={c.value} onChange={(e) => updateCondition(i, { value: e.target.value })} required style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }} />
                {conditions.length > 1 && <button type="button" onClick={() => removeCondition(i)} style={{ fontSize: 11 }}>✕</button>}
              </div>
            ))}
            <button type="button" onClick={addCondition} style={{ fontSize: 12, justifySelf: 'start' }}>+ Add condition</button>
          </div>
          <input placeholder="action (e.g. escalate, auto_approve)" value={ruleAction} onChange={(e) => setRuleAction(e.target.value)} required style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }} />
          <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Policy'}</button>
        </form>
      )}

      {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <div>Loading policies...</div>
      ) : policies.length === 0 ? (
        <p style={{ color: theme.textMuted }}>No policies exist yet — the system behaves as it always has (every recommendation requires human approval).</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {policies.map((p) => (
            <div key={p.id} style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${p.policyType === 'executor_autonomy' ? '#f59e0b' : '#3b82f6'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{p.name}</strong>
                <span style={{ fontSize: 11, color: theme.textMuted }}>{p.policyType} · v{p.version} · scope: {p.scope}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12 }}>
                {p.rules.map((r, i) => (
                  <div key={i} style={{ color: theme.textMuted }}>
                    {r.conditions ? `${r.conditions.length} conditions (${r.match ?? 'all'})` : `${r.field} ${r.operator} ${JSON.stringify(r.value)}`} → <strong style={{ color: theme.text }}>{r.action}</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
