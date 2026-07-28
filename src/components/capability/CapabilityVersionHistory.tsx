import { useState, useEffect } from 'react';
import type { Capability } from './CapabilityApp';
import { api } from '../../api/capability';

interface Props {
  capability: Capability;
  onBack: () => void;
}

export default function CapabilityVersionHistory({ capability, onBack }: Props) {
  const [versions, setVersions] = useState<Array<{ version: number; name: string; createdDate: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getVersions(capability.tenantId, capability.id).then(setVersions).catch((e) => setError(e.message));
  }, [capability.tenantId, capability.id]);

  return (
    <div>
      <button onClick={onBack}>← Back</button>
      <h2>Version History — {capability.name}</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <p>Current version: v{capability.version}</p>
      {versions.length === 0 ? <p>No version snapshots yet.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Version</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Name</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.version}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>v{v.version}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{v.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(v.createdDate).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
