import { Fragment, useState, useEffect } from 'react';
import type { Organization } from '../../App';
import { api } from '../../api/organization';

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

export default function OrganizationDetails({ organization, onEdit, onArchive, onBack, onViewDepartments, onViewPeople, onViewCapabilities, onViewSignals, onViewWorkspace, onViewAnalytics, onViewExecutive, onViewGraph, onViewAgents, onViewEvidence, onViewCopilot, onViewDecisionIntel, onViewTasks, onViewDeliberation }: Props) {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    api.getAuditLogs(organization.tenantId, organization.id).then(setAuditLogs).catch(() => {});
  }, [organization.tenantId, organization.id]);

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

  return (
    <div>
      <button onClick={onBack}>← Back</button>
      <h2>{organization.name}</h2>
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
