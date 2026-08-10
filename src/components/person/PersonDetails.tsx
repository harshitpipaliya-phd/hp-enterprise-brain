import { Fragment, useState, useEffect } from 'react';
import type { Person } from './PersonApp';
import { api } from '../../api/person';

interface Props {
  onViewTwin?: () => void;
  person: Person;
  onEdit: () => void;
  onArchive: () => void;
  onBack: () => void;
}

export default function PersonDetails({ person, onEdit, onArchive, onBack, onViewTwin }: Props) {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    setAuditLoading(true);
    setAuditError(null);
    api
      .getAuditLogs(person.tenantId, person.id)
      .then((rows) => setAuditLogs(Array.isArray(rows) ? rows : []))
      // Swallowing this rendered "No audit logs." for a server error, which
      // reads as "nothing has happened to this record" — the opposite of true.
      .catch((e: any) => setAuditError(e.message))
      .finally(() => setAuditLoading(false));
  }, [person.tenantId, person.id]);

  const fields = [
    ['ID', person.id],
    ['Employee ID', person.employeeId],
    ['Name', `${person.firstName} ${person.lastName}`],
    ['Display Name', person.displayName],
    ['Email', person.email],
    ['Phone', person.phone],
    ['Gender', person.gender],
    ['Date of Birth', person.dateOfBirth],
    ['Employment Type', person.employmentType],
    ['Employment Status', person.employmentStatus],
    ['Joining Date', person.joiningDate],
    ['Department', person.departmentId],
    ['Manager', person.managerId],
    ['Reporting Manager', person.reportingManagerId],
    ['Designation', person.designation],
    ['Location', person.location],
    ['Organization', person.orgId],
    ['Status', person.status],
    ['Created By', person.createdBy],
    ['Created Date', new Date(person.createdDate).toLocaleString()],
    ['Updated Date', new Date(person.updatedDate).toLocaleString()],
  ];

  const copyId = () => { navigator.clipboard.writeText(person.id); };

  return (
    <div>
      <button onClick={onBack}>{'←'} Back</button>
      <h2>{person.displayName || `${person.firstName} ${person.lastName}`}</h2>
      <div className="eb-card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, maxWidth: 480 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--content-secondary)', fontWeight: 650, textTransform: 'uppercase', marginBottom: 2 }}>Person ID</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.id}</div>
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
        {onViewTwin && <button onClick={onViewTwin} style={{ marginLeft: 8, fontWeight: 'bold' }}>View Twin</button>}
      </div>
      <div style={{ marginTop: 16 }}>
        <button onClick={onEdit}>Edit</button>
        <button onClick={onArchive} style={{ marginLeft: 8 }}>Archive</button>
      </div>
      <h3 style={{ marginTop: 24 }}>Audit Log</h3>
      {auditLoading ? <p>Loading audit log…</p>
        : auditError ? <p style={{ color: 'var(--status-crit)' }}>Error loading audit log: {auditError}</p>
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
