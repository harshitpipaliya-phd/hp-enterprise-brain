import { Fragment, useState, useEffect } from 'react';
import type { Capability } from './CapabilityApp';
import { api } from '../../api/capability';

interface Props {
  capability: Capability;
  onEdit: () => void;
  onArchive: () => void;
  onAssign: () => void;
  onVersions: () => void;
  onBack: () => void;
}

const KASBA_FIELDS = ['knowledge', 'ability', 'skill', 'behaviour', 'attitude'] as const;

export default function CapabilityDetails({ capability, onEdit, onArchive, onAssign, onVersions, onBack }: Props) {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    api.getAuditLogs(capability.tenantId, capability.id).then(setAuditLogs).catch(() => {});
  }, [capability.tenantId, capability.id]);

  const fields: Array<[string, unknown]> = [
    ['Code', capability.capabilityCode],
    ['Name', capability.name],
    ['Description', capability.description],
    ['Category', capability.category],
    ['Type', capability.capabilityType],
    ['Difficulty', capability.difficulty],
    ['Criticality', capability.criticality],
    ['Version', `v${capability.version}`],
    ['Status', capability.status],
    ['Created By', capability.createdBy],
    ['Created Date', new Date(capability.createdDate).toLocaleString()],
    ['Updated Date', new Date(capability.updatedDate).toLocaleString()],
  ];

  return (
    <div>
      <button onClick={onBack}>← Back</button>
      <h2>{capability.name} ({capability.capabilityCode})</h2>
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 16px' }}>
        {fields.map(([label, value]) => (
          <Fragment key={label}>
            <dt style={{ fontWeight: 'bold' }}>{label}</dt>
            <dd>{value == null ? '—' : String(value)}</dd>
          </Fragment>
        ))}
      </dl>
      <h3 style={{ marginTop: 24 }}>KASBA Elements</h3>
      <ul>
        {KASBA_FIELDS.map((key) => (
          <li key={key}>{key}: {capability[key] ? 'configured' : 'not set'}</li>
        ))}
      </ul>
      <div style={{ marginTop: 16 }}>
        <button onClick={onEdit}>Edit</button>
        <button onClick={onAssign} style={{ marginLeft: 8 }}>Assign</button>
        <button onClick={onVersions} style={{ marginLeft: 8 }}>Versions</button>
        <button onClick={onArchive} style={{ marginLeft: 8 }}>Archive</button>
      </div>
      <h3 style={{ marginTop: 24 }}>Audit Log</h3>
      {auditLogs.length === 0 ? <p>No audit logs.</p> : (
        <ul>
          {auditLogs.map((log: any) => (
            <li key={log.id}>{log.action} by {log.actorName} on {new Date(log.createdAt).toLocaleString()}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
