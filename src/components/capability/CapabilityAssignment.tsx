import { useState, useEffect } from 'react';
import type { Capability } from './CapabilityApp';
import { api } from '../../api/capability';

interface Props {
  capability: Capability;
  onBack: () => void;
}

export default function CapabilityAssignment({ capability, onBack }: Props) {
  const [targetType, setTargetType] = useState('Person');
  const [targetId, setTargetId] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAssignments = async () => {
    try {
      setAssignments(await api.getAssignments(capability.tenantId, capability.id));
    } catch {
      setAssignments([]);
    }
  };

  useEffect(() => { loadAssignments(); }, [capability.tenantId, capability.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api.assignCapability(capability.tenantId, capability.id, targetType, targetId);
      setSuccess(`Assigned to ${targetType}:${targetId}`);
      setTargetId('');
      await loadAssignments();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <button onClick={onBack}>← Back</button>
      <h2>Assign Capability — {capability.name}</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {success && <div style={{ color: 'green' }}>{success}</div>}
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
          <option value="Person">Person</option>
          <option value="Department">Department</option>
          <option value="JobRole">JobRole</option>
          <option value="Organization">Organization</option>
        </select>
        <input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="Target ID" style={{ flex: 1 }} />
        <button type="submit" disabled={!targetId}>Assign</button>
      </form>
      <h3 style={{ marginTop: 24 }}>Current Assignments</h3>
      {assignments.length === 0 ? <p>No assignments.</p> : (
        <ul>
          {assignments.map((a: any) => (
            <li key={a.id}>{a.targetType}: {a.targetId} (assigned by {a.assignedBy})</li>
          ))}
        </ul>
      )}
    </div>
  );
}
