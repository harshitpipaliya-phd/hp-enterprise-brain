import { useState, useEffect } from 'react';
import type { Capability } from './CapabilityApp';
import { api } from '../../api/capability';
import { api as personApi } from '../../api/person';
import { api as departmentApi } from '../../api/department';
import { LoadingState } from '../shared/States';

interface Props {
  capability: Capability;
  onBack: () => void;
}

/**
 * hpbrain_capability_assignments stores (target_type, target_id), so a
 * capability can be assigned to a Person, a Department, a JobRole or an
 * Organization. Person and Department have real endpoints behind them, so those
 * two are picked from live lists rather than typed as a raw id; JobRole has no
 * endpoint, so it keeps a plain id field.
 */
const TARGET_TYPES = ['Person', 'Department', 'Organization', 'JobRole'] as const;
type TargetType = (typeof TARGET_TYPES)[number];

export default function CapabilityAssignment({ capability, onBack }: Props) {
  const [targetType, setTargetType] = useState<TargetType>('Person');
  const [targetId, setTargetId] = useState('');
  const [people, setPeople] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [assigned, roster, depts] = await Promise.all([
        api.getAssignments(capability.tenantId, capability.id),
        personApi.listPeople(capability.tenantId, capability.orgId),
        departmentApi.listDepartments(capability.tenantId, capability.orgId),
      ]);
      setAssignments(Array.isArray(assigned) ? assigned : []);
      setPeople(Array.isArray(roster) ? roster : []);
      setDepartments(Array.isArray(depts) ? depts : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [capability.tenantId, capability.id, capability.orgId]);

  // Reset the chosen target whenever the type changes — a person id is
  // meaningless once the target type is Department.
  useEffect(() => { setTargetId(''); }, [targetType]);

  const personName = (p: any) =>
    p.displayName || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || String(p.id);

  const labelFor = (type: string, id: string) => {
    if (type === 'Person') {
      const p = people.find((x) => String(x.id) === String(id));
      return p ? personName(p) : id;
    }
    if (type === 'Department') {
      const d = departments.find((x) => String(x.id) === String(id));
      return d ? d.name : id;
    }
    return id;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await api.assignCapability(capability.tenantId, capability.id, targetType, targetId);
      setSuccess(`Assigned to ${targetType} — ${labelFor(targetType, targetId)}`);
      setTargetId('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <button onClick={onBack}>← Back</button>
      <h2>Assign Capability — {capability.name}</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {success && <div style={{ color: 'green' }}>{success}</div>}
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <select value={targetType} onChange={(e) => setTargetType(e.target.value as TargetType)}>
          {TARGET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {targetType === 'Person' && (
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{ flex: 1 }}>
            <option value="">Select a person…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {personName(p)}{p.employeeId ? ` (${p.employeeId})` : ''}
              </option>
            ))}
          </select>
        )}

        {targetType === 'Department' && (
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{ flex: 1 }}>
            <option value="">Select a department…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        {targetType === 'Organization' && (
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{ flex: 1 }}>
            <option value="">Select…</option>
            <option value={capability.orgId}>This organization ({capability.orgId})</option>
          </select>
        )}

        {targetType === 'JobRole' && (
          <input
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="Job role ID"
            style={{ flex: 1 }}
          />
        )}

        <button type="submit" disabled={!targetId || submitting}>
          {submitting ? 'Assigning…' : 'Assign'}
        </button>
      </form>

      <h3 style={{ marginTop: 24 }}>Current Assignments</h3>
      {loading ? <LoadingState label="Loading assignments…" />
        : assignments.length === 0 ? <p>No assignments.</p> : (
        <ul>
          {assignments.map((a: any) => (
            <li key={a.id}>
              {a.targetType}: {labelFor(a.targetType, a.targetId)} — {a.status}
              {a.assignedBy ? ` (assigned by ${a.assignedBy})` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
