import { useState } from 'react';
import type { Capability } from './CapabilityApp';
import { api } from '../../api/capability';

interface Props {
  capability: Capability;
  onArchived: (cap: Capability) => void;
  onCancel: () => void;
}

export default function CapabilityArchiveConfirm({ capability, onArchived, onCancel }: Props) {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const c = await api.archiveCapability(capability.tenantId, capability.id);
      if (c) onArchived(c);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Archive Capability</h2>
      <p>Are you sure you want to archive <strong>{capability.name}</strong>? This action cannot be undone.</p>
      <p>Type the capability code to confirm: <strong>{capability.capabilityCode}</strong></p>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div>
        <button disabled={confirm !== capability.capabilityCode} onClick={submit}>Archive</button>
        <button onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
