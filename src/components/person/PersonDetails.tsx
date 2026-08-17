import { Fragment, useState, useEffect } from 'react';
import type { Person } from './PersonApp';
import { api } from '../../api/person';
import { formatDateTime } from '../workspace/intelligenceShared';

interface Props {
  person: Person;
  onEdit: () => void;
  onArchive: () => void;
  onBack: () => void;
}

/**
 * The source record behind a person, exactly as the People API returns it.
 *
 * This is the raw view, reached from the profile. It is deliberately literal —
 * one row per field the API actually sent — because its job is to let someone
 * check what the profile is built from.
 *
 * WHAT IT NO LONGER DOES. It used to print a fixed list of twenty-one labels
 * including Manager, Reporting Manager, Location, Date of Birth, Profile Photo
 * and Created By. None of those is returned by the People API for any tenant:
 * the client's normalize() seeds them as null and nothing ever overwrites them,
 * so the screen showed six permanent em-dashes and invited the reader to
 * conclude that the ERP holds those fields and left them empty. It does not hold
 * them at all. Fields the response does not carry are now absent, and the screen
 * says how many were absent rather than drawing them as blanks.
 */
export default function PersonDetails({ person, onEdit, onArchive, onBack }: Props) {
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

  const candidates: Array<[string, unknown]> = [
    ['Person ID', person.id],
    ['Employee / student reference', person.employeeId],
    ['First name', person.firstName],
    ['Last name', person.lastName],
    ['Display name', person.displayName],
    ['Email', person.email],
    ['Phone', person.phone],
    ['Gender', person.gender],
    ['Designation', person.designation],
    ['Employment type', person.employmentType],
    ['Employment status', person.employmentStatus],
    ['Joining date', person.joiningDate],
    ['Department ID', person.departmentId],
    ['Organization', person.orgId],
    ['Status', person.status],
    ['Created', person.createdDate ? new Date(person.createdDate).toLocaleString() : null],
    ['Last updated', person.updatedDate ? new Date(person.updatedDate).toLocaleString() : null],
  ];

  const fields = candidates.filter(([, value]) => value !== null && value !== undefined && value !== '');
  const omitted = candidates.length - fields.length;

  const copyId = () => { navigator.clipboard.writeText(person.id); };

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="people-inline-actions" style={{ justifyContent: 'flex-start', marginBottom: 16 }}>
        <button className="eb-pill-btn" onClick={onBack}>{'← Back to profile'}</button>
        <span style={{ flex: 1 }} />
        <button className="eb-pill-btn" onClick={onEdit}>Edit contact details</button>
        <button className="eb-pill-btn" onClick={onArchive}>Archive</button>
      </div>

      <div className="eb-eyebrow">Source record</div>
      <h2 style={{ marginTop: 6 }}>{person.displayName || `${person.firstName} ${person.lastName}`}</h2>

      <div className="eb-card" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', maxWidth: 480 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--content-secondary)', fontWeight: 650, textTransform: 'uppercase', marginBottom: 2 }}>Person ID</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.id}</div>
        </div>
        <button className="eb-pill-btn" onClick={copyId}>Copy ID</button>
      </div>

      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 16px' }}>
        {fields.map(([label, value]) => (
          <Fragment key={label}>
            <dt style={{ fontWeight: 650, color: 'var(--content-tertiary)' }}>{label}</dt>
            <dd style={{ margin: 0 }}>{String(value)}</dd>
          </Fragment>
        ))}
      </dl>

      {omitted > 0 && (
        <p style={{ marginTop: 14, fontSize: 13, color: 'var(--content-secondary)', maxWidth: '72ch' }}>
          {omitted} further {omitted === 1 ? 'field is' : 'fields are'} not held for this person by this
          organization’s source system, so {omitted === 1 ? 'it is' : 'they are'} not listed.
        </p>
      )}

      <h3 style={{ marginTop: 28 }}>Change history</h3>
      {auditLoading ? <p>Loading change history…</p>
        : auditError ? <p style={{ color: 'var(--status-crit)' }}>Could not load the change history: {auditError}</p>
        : auditLogs.length === 0 ? (
          <p style={{ color: 'var(--content-secondary)' }}>
            No changes have been recorded against this person.
          </p>
        ) : (
        <ul>
          {auditLogs.map((log: any) => (
            <li key={log.id}>{log.action} by {log.actorName ?? 'an unnamed actor'} on {formatDateTime(log.createdAt)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
