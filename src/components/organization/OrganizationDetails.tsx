import { Fragment, useState, useEffect } from 'react';
import type { Organization } from '../../App';

interface Props {
  organization: Organization;
  onEdit: () => void;
  onArchive: () => void;
  onBack: () => void;
  onViewDepartments?: () => void;
  onViewPeople?: () => void;
  onViewCapabilities?: () => void;
  onViewSignals?: () => void;
  onViewWorkspace?: () => void;
  onViewAnalytics?: () => void;
  onViewExecutive?: () => void;
  onViewGraph?: () => void;
  onViewAgents?: () => void;
  onViewEvidence?: () => void;
  onViewCopilot?: () => void;
  onViewDecisionIntel?: () => void;
  onViewTasks?: () => void;
  onViewDeliberation?: () => void;
}

type Tab = 'details' | 'structure' | 'quality' | 'audit';

export default function OrganizationDetails({ organization, onEdit, onArchive, onBack, onViewDepartments, onViewPeople, onViewCapabilities, onViewSignals, onViewWorkspace, onViewAnalytics, onViewExecutive, onViewGraph, onViewAgents, onViewEvidence, onViewCopilot, onViewDecisionIntel, onViewTasks, onViewDeliberation }: Props) {
  const [tab, setTab] = useState<Tab>('details');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [structure, setStructure] = useState<any>(null);
  const [structureLoading, setStructureLoading] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [quality, setQuality] = useState<any>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityError, setQualityError] = useState<string | null>(null);

  useEffect(() => {
    setAuditLoading(true);
    setAuditError(null);
    const token = localStorage.getItem('accessToken') || '';
    fetch('/api/v1/organizations/' + organization.tenantId + '/' + organization.id + '/audit', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then((rows) => setAuditLogs(Array.isArray(rows) ? rows : []))
      .catch((e: any) => setAuditError(e.message))
      .finally(() => setAuditLoading(false));
  }, [organization.tenantId, organization.id]);

  useEffect(() => {
    if (tab !== 'structure') return;
    setStructureLoading(true);
    setStructureError(null);
    const token = localStorage.getItem('accessToken') || '';
    fetch('/api/v1/organizations/' + organization.tenantId + '/' + organization.id + '/structure', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    })
      .then((r) => { if (!r.ok) throw new Error('Failed to load structure'); return r.json(); })
      .then(setStructure)
      .catch((e: any) => setStructureError(e.message))
      .finally(() => setStructureLoading(false));
  }, [tab, organization.tenantId, organization.id]);

  useEffect(() => {
    if (tab !== 'quality') return;
    setQualityLoading(true);
    setQualityError(null);
    const token = localStorage.getItem('accessToken') || '';
    fetch('/api/v1/organizations/' + organization.tenantId + '/' + organization.id + '/data-quality', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    })
      .then((r) => { if (!r.ok) throw new Error('Failed to load data quality'); return r.json(); })
      .then(setQuality)
      .catch((e: any) => setQualityError(e.message))
      .finally(() => setQualityLoading(false));
  }, [tab, organization.tenantId, organization.id]);

  const fields = [
    ['Name', organization.name],
    ['Legal Name', organization.legalName],
    ['Org Code', organization.orgCode],
    ['Industry', organization.industry],
    ['Country', organization.country],
    ['Timezone', organization.timezone],
    ['Currency', organization.currency],
    ['Logo', organization.logo],
    ['Status', organization.status],
    ['Created By', organization.createdBy],
    ['Created Date', new Date(organization.createdDate).toLocaleString()],
    ['Updated Date', new Date(organization.updatedDate).toLocaleString()],
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'structure', label: 'Structure' },
    { key: 'quality', label: 'Data Quality' },
    { key: 'audit', label: 'Audit' },
  ];

  return (
    <div>
      <button onClick={onBack}>← Back</button>
      <h2>{organization.name}</h2>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              background: tab === t.key ? 'var(--action-primary)' : 'var(--surface-card)',
              color: tab === t.key ? '#fff' : 'var(--content-primary)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <>
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
            {onViewDepartments && <button onClick={onViewDepartments} style={{ marginLeft: 8 }}>View Departments</button>}
            {onViewPeople && <button onClick={onViewPeople} style={{ marginLeft: 8 }}>View People</button>}
            {onViewCapabilities && <button onClick={onViewCapabilities} style={{ marginLeft: 8 }}>View Capabilities</button>}
            {onViewSignals && <button onClick={onViewSignals} style={{ marginLeft: 8 }}>View Signals</button>}
            {onViewWorkspace && <button onClick={onViewWorkspace} style={{ marginLeft: 8, fontWeight: 'bold' }}>Intelligence Workspace</button>}
            {onViewAnalytics && <button onClick={onViewAnalytics} style={{ marginLeft: 8 }}>Decision Analytics</button>}
            {onViewExecutive && <button onClick={onViewExecutive} style={{ marginLeft: 8, fontWeight: 'bold' }}>Executive Dashboard</button>}
            {onViewGraph && <button onClick={onViewGraph} style={{ marginLeft: 8 }}>Graph Explorer</button>}
            {onViewAgents && <button onClick={onViewAgents} style={{ marginLeft: 8 }}>Agent Monitor</button>}
            {onViewEvidence && <button onClick={onViewEvidence} style={{ marginLeft: 8 }}>Evidence</button>}
            {onViewCopilot && <button onClick={onViewCopilot} style={{ marginLeft: 8, fontWeight: 'bold' }}>Copilot</button>}
            {onViewDecisionIntel && <button onClick={onViewDecisionIntel} style={{ marginLeft: 8 }}>Decision Intelligence</button>}
            {onViewTasks && <button onClick={onViewTasks} style={{ marginLeft: 8 }}>Task Orchestrator</button>}
            {onViewDeliberation && <button onClick={onViewDeliberation} style={{ marginLeft: 8, fontWeight: 'bold' }}>Deliberation</button>}
          </div>
        </>
      )}

      {tab === 'structure' && (
        <div>
          <h3>Organization Structure</h3>
          {structureLoading ? <p>Loading structure…</p>
            : structureError ? <p style={{ color: 'var(--status-crit)' }}>Error: {structureError}</p>
            : structure ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <strong>{structure.departments?.length ?? 0} departments</strong>
                </div>
                {structure.departments?.length === 0 ? (
                  <p>No departments found.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)', padding: 8 }}>Department</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)', padding: 8 }}>People</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)', padding: 8 }}>Manager</th>
                      </tr>
                    </thead>
                    <tbody>
                      {structure.departments.map((d: any) => (
                        <tr key={d.id}>
                          <td style={{ padding: 8 }}>{d.name}</td>
                          <td style={{ padding: 8 }}>{structure.peopleByDepartment?.[d.id] ?? 0}</td>
                          <td style={{ padding: 8 }}>{structure.heads?.[d.id] ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <p>No structure data.</p>
            )}
        </div>
      )}

      {tab === 'quality' && (
        <div>
          <h3>Data Quality</h3>
          {qualityLoading ? <p>Loading data quality…</p>
            : qualityError ? <p style={{ color: 'var(--status-crit)' }}>Error: {qualityError}</p>
            : quality ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <strong>Score: {quality.score}%</strong>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <span>{quality.totalPeople} people · {quality.totalDepartments} departments</span>
                </div>
                {quality.issues?.length === 0 ? (
                  <p style={{ color: 'var(--status-good)' }}>No data quality issues found.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)', padding: 8 }}>Field</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)', padding: 8 }}>Count</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)', padding: 8 }}>Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quality.issues.map((issue: any, i: number) => (
                        <tr key={i}>
                          <td style={{ padding: 8 }}>{issue.field}</td>
                          <td style={{ padding: 8 }}>{issue.count}</td>
                          <td style={{ padding: 8 }}>
                            <span className={`eb-badge eb-badge-${issue.severity === 'high' ? 'danger' : issue.severity === 'medium' ? 'warning' : 'info'}`}>
                              {issue.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <p>No quality data.</p>
            )}
        </div>
      )}

      {tab === 'audit' && (
        <div>
          <h3>Audit Log</h3>
          {auditLoading ? <p>Loading audit log…</p>
            : auditError ? <p style={{ color: 'var(--status-crit)' }}>Error loading audit log: {auditError}</p>
            : auditLogs.length === 0 ? <p>No audit logs.</p> : (
            <ul>
              {auditLogs.map((log: any) => (
                <li key={log.id}>
                  {log.action} by {log.actorName ?? log.actorId ?? 'unknown'} on{' '}
                  {new Date(log.createdAt ?? log.createdDate).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
