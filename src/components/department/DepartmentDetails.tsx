import { Fragment, useState, useEffect } from 'react';
import type { Department } from './DepartmentApp';
import { api } from '../../api/department';

interface Props {
  department: Department;
  onEdit: () => void;
  onArchive: () => void;
  onBack: () => void;
}

export default function DepartmentDetails({ department, onEdit, onArchive, onBack }: Props) {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    setAuditLoading(true);
    setAuditError(null);
    api
      .getAuditLogs(department.tenantId, department.id)
      .then((rows) => setAuditLogs(Array.isArray(rows) ? rows : []))
      // Swallowing this rendered "No audit logs." for a server error, which
      // reads as "nothing has happened to this record" — the opposite of true.
      .catch((e: any) => setAuditError(e.message))
      .finally(() => setAuditLoading(false));
  }, [department.tenantId, department.id]);

  const fields = [
    ['ID', department.id],
    ['Name', department.name],
    ['Description', department.description],
    ['Type', department.departmentType],
    ['Parent Department', department.parentDepartmentId],
    ['Head', department.headId],
    ['Organization', department.orgId],
    ['Status', department.status],
    ['Created By', department.createdBy],
    ['Created Date', new Date(department.createdDate).toLocaleString()],
    ['Updated Date', new Date(department.updatedDate).toLocaleString()],
  ];

  const copyId = () => { navigator.clipboard.writeText(department.id); };

  return (
    <div>
      <button onClick={onBack}>{'←'} Back</button>
      <h2>{department.name}</h2>
      <div className="eb-card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, maxWidth: 480 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--content-secondary)', fontWeight: 650, textTransform: 'uppercase', marginBottom: 2 }}>Department ID</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>{department.id}</div>
        </div>
        <button className="eb-pill-btn" onClick={copyId}>Copy ID</button>
      </div>
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 16px' }}>
        {fields.map(([label, value]) => (
          <Fragment key={label}>
            <dt style={{ fontWeight: 'bold' }}>{label}</dt>
            <dd>{value ?? '—'}</dd>
          </Fragment>
        ))}
      </dl>
      <div style={{ marginTop: 16 }}>
        <button onClick={onEdit}>Edit</button>
        <button onClick={onArchive} style={{ marginLeft: 8 }}>Archive</button>
      </div>
      <h3 style={{ marginTop: 24 }}>Audit Log</h3>
      {auditLoading ? <p>Loading audit log…</p>
        : auditError ? <p style={{ color: '#ef4444' }}>Error loading audit log: {auditError}</p>
        : auditLogs.length === 0 ? <p>No audit logs.</p> : (
        <ul>
          {auditLogs.map((log: any) => (
            <li key={log.id}>{log.action} by {log.actorName} on {new Date(log.createdAt).toLocaleString()}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
