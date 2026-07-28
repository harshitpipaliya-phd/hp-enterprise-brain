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
  const [archiving, setArchiving] = useState(false);

  const submit = async () => {
    setError(null);
    setArchiving(true);
    try {
      // Capabilities are Brain-owned and archive by flipping status, so unlike
      // the ERP entities the endpoint really does return the updated row.
      onArchived(await api.archiveCapability(capability.tenantId, capability.id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div>
      <h2>Archive Capability</h2>
      <p>Are you sure you want to archive <strong>{capability.name}</strong>? This action cannot be undone.</p>
      <p>Type the capability code to confirm: <strong>{capability.capabilityCode}</strong></p>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div>
        <button disabled={confirm !== capability.capabilityCode || archiving} onClick={submit}>{archiving ? 'Archiving…' : 'Archive'}</button>
        <button onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
