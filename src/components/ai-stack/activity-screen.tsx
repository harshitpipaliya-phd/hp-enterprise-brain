/**
 * AI Stack → Activity, for any module.
 *
 * The ledger. What happened in this module, which AI capability it used, which agent,
 * prompt or template ran, who did it, which record it was about, and how it ended.
 *
 * WHY THIS TAB EXISTS
 *
 * The other eight tabs each answer "what is configured". None of them answers "what
 * actually ran", and a stack you cannot audit is a stack nobody should point at a
 * person's record. This is the join: a row here names the module operation on one side and
 * the AI Stack record on the other, so a question like "which prompt drafted the message
 * we sent" has an answer that is a lookup rather than an investigation.
 *
 * WHERE THE ROWS COME FROM
 *
 * `ai_audit_logs`, under an event type of `module.<key>.<operation>` — the same table the
 * agent runs, generation requests and governance refusals already write to. No table was
 * added for this. Each row was written by a module screen at the moment it finished doing
 * something, and the template and prompt names in it were resolved by the backend out of
 * `ai_templates` rather than supplied by the browser, so a row cannot name an artefact that
 * does not exist — or one belonging to another module.
 *
 * FAILURES ARE RECORDED, NOT JUST SUCCESSES
 *
 * An agent run that was refused, a report that matched nothing, a generation governance
 * stopped — each is written with `status: failed` and the reason. A ledger that only holds
 * the things that worked is a ledger that cannot answer the question people actually bring
 * to it.
 *
 * AN ENTRY WITH NO AI IS STILL AN ENTRY
 *
 * Some operations use no model. They are recorded anyway, with no artefact against them,
 * because the ledger's job is to show what happened in the module — and "this operation ran
 * without AI" is an answer. Attaching a template that had nothing to do with it to make the
 * row look richer would be the one thing that makes the whole tab worthless.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, FileText, History, Terminal, Workflow, Wrench } from 'lucide-react';

import { Button, Modal, Select } from '../../ui';
import { fetchModuleActivity, type AiModuleActivity, type AiModuleActivityEntry } from '../../api/aiStack/module';
import { describeAiError } from '../../api/aiIntelligence/client';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackEmpty,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackMetrics,
  AiStackPill,
  AiStackTableHead,
  formatWhen,
} from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';
import './aiStackScreens-b.css';

/** How many entries a page of the ledger carries. The API caps this at 200. */
const PAGE = 100;

export function AiStackActivityScreen({ module }: { module: AiStackModule }) {
  const [activity, setActivity] = useState<AiModuleActivity | null>(null);
  const [operation, setOperation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState(0);
  const [open, setOpen] = useState<AiModuleActivityEntry | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  const closeDetail = useCallback(() => setOpen(null), []);

  useEffect(() => {
    let cancelled = false;

    fetchModuleActivity(module.key, { limit: PAGE, operation: operation || undefined })
      .then((next) => {
        if (cancelled) return;
        setActivity(next);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describeAiError(cause));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, operation, module.key]);

  const entries = useMemo(() => activity?.entries ?? [], [activity]);

  const stats = useMemo(() => {
    const completed = entries.filter((entry) => entry.status === 'completed').length;
    const failed = entries.filter((entry) => entry.status === 'failed' || entry.status === 'denied').length;
    const withAi = entries.filter((entry) => Object.keys(entry.used ?? {}).length > 0).length;
    const people = new Set(entries.map((entry) => entry.actor_id ?? entry.actor_label ?? 'unknown'));

    return { completed, failed, withAi, people: people.size };
  }, [entries]);

  /** Operations the ledger actually holds, so the filter never offers an empty one. */
  const operations = useMemo(() => {
    const seen = new Map<string, number>();

    for (const row of activity?.by_operation ?? []) {
      seen.set(row.operation, (seen.get(row.operation) ?? 0) + row.count);
    }

    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [activity]);

  const labelFor = useCallback((key: string) => module.operations[key]?.label ?? key, [module.operations]);

  if (loading && !activity) {
    return <AiStackLoading label={`Loading the ${module.label} AI activity ledger…`} />;
  }

  return (
    <section className="ais-stack" aria-label={`${module.label} AI activity`}>
      <AiStackHeader
        icon={History}
        title={`${module.label} AI activity`}
        summary={`Every ${module.label} operation the AI Stack recorded — what ran, which capability and record it used, who did it, and how it ended.`}
        loading={loading}
        onRefresh={reload}
        actions={
          operations.length > 0 ? (
            <Select
              value={operation}
              onChange={(event) => setOperation(event.target.value)}
              aria-label={`Filter ${module.label} activity by operation`}
            >
              <option value="">All operations</option>
              {operations.map(([key, count]) => (
                <option key={key} value={key}>
                  {labelFor(key)} ({count})
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />

      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      {activity && !activity.available && (
        <AiStackError>{activity.reason ?? 'The ledger is unavailable on this estate.'}</AiStackError>
      )}

      <AiStackMetrics
        metrics={[
          { key: 'total', label: 'Recorded', value: activity ? activity.total : '—', hint: `${module.label} operations` },
          { key: 'shown', label: 'Shown', value: entries.length, hint: `newest ${PAGE}` },
          { key: 'completed', label: 'Completed', value: stats.completed, hint: 'of those shown' },
          { key: 'failed', label: 'Failed or denied', value: stats.failed, hint: 'recorded, not hidden' },
          { key: 'with-ai', label: 'Used AI', value: stats.withAi, hint: 'named an AI record' },
        ]}
      />

      {entries.length === 0 && !loading ? (
        <AiStackEmpty icon={History} title="Nothing recorded yet">
          The ledger fills as people use {module.label} AI. Build a {module.label} report, or draft with AI on a{' '}
          {module.label} screen, and the operation appears here with whatever AI Stack record it used.
        </AiStackEmpty>
      ) : (
        <AiStackCard className="ais-b-overflow">
          <AiStackCardHeading title="Execution history" hint="Newest first. Select a row to see everything recorded about it." />
          <div className="ais-table-wrap">
            <table className="ais-table ais-b-minw-68 ais-b-td-tight">
              <AiStackTableHead
                columns={['When', 'Operation', 'Capability', 'AI Stack record used', 'By', 'About', 'Reference', 'Status']}
              />
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setOpen(entry)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setOpen(entry);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Open ${entry.operation_label ?? labelFor(entry.operation)} entry from ${formatWhen(entry.created_at)}`}
                    className="ais-b-row-click"
                  >
                    <td className="ais-b-nowrap ais-b-xs">{formatWhen(entry.created_at)}</td>
                    <td>
                      <div className="ais-b-strong" style={{ fontSize: 12 }}>
                        {entry.operation_label ?? labelFor(entry.operation)}
                      </div>
                      <div className="ais-mono ais-b-3xs ais-b-mt1">{entry.operation}</div>
                    </td>
                    <td>
                      {entry.capability ? (
                        <AiStackPill tone="blue">{entry.capability}</AiStackPill>
                      ) : (
                        <span className="ais-b-xs ais-b-faint">—</span>
                      )}
                    </td>
                    <td>
                      <UsedCell entry={entry} />
                    </td>
                    <td className="ais-b-xs">{entry.actor_label ?? (entry.actor_id ? `user ${entry.actor_id}` : '—')}</td>
                    <td className="ais-b-xs">
                      {entry.subject_label ??
                        (entry.subject_id ? `${entry.subject_entity_key ?? 'record'} ${entry.subject_id}` : '—')}
                    </td>
                    <td className="ais-mono ais-muted">{entry.reference ?? '—'}</td>
                    <td>
                      <AiStackPill
                        tone={
                          entry.status === 'completed'
                            ? 'green'
                            : entry.status === 'denied'
                              ? 'amber'
                              : entry.status === 'skipped'
                                ? 'gray'
                                : 'red'
                        }
                      >
                        {entry.status}
                      </AiStackPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AiStackCard>
      )}

      <AiStackHint>
        These rows sit in the same audit table as the agent runs and governance refusals the rest of the AI layer
        writes, so one investigation reads them together. An operation that used no AI is recorded without an
        artefact rather than attributed to one it did not use.
      </AiStackHint>

      {open && <EntryDetail entry={open} onClose={closeDetail} />}
    </section>
  );
}

/** The AI Stack records one entry names, or an honest dash. */
function UsedCell({ entry }: { entry: AiModuleActivityEntry }) {
  const used = entry.used ?? {};
  const parts: Array<{ icon: typeof Bot; label: string; title: string }> = [];

  if (used.agent) {
    parts.push({
      icon: Bot,
      label: used.agent.name ?? used.agent.id ?? 'agent',
      title: `Agent ${used.agent.id ?? ''}`.trim(),
    });
  }
  if (used.prompt) {
    parts.push({ icon: Terminal, label: used.prompt.name, title: `${used.prompt.key} v${used.prompt.version}` });
  }
  if (used.template) {
    parts.push({ icon: FileText, label: used.template.name, title: `${used.template.key} v${used.template.version}` });
  }
  if (used.workflow) {
    parts.push({ icon: Workflow, label: used.workflow, title: 'Workflow' });
  }
  if (used.tool) {
    parts.push({ icon: Wrench, label: used.tool, title: 'Tool' });
  }

  if (parts.length === 0) {
    return <span className="ais-b-xs ais-b-faint">no AI record — ran without one</span>;
  }

  return (
    <div className="ais-b-chips">
      {parts.map((part) => (
        <span key={`${part.title}-${part.label}`} title={part.title} className="ais-b-chip">
          <part.icon size={12} aria-hidden="true" />
          <span className="ais-b-truncate">{part.label}</span>
        </span>
      ))}
    </div>
  );
}

function EntryDetail({ entry, onClose }: { entry: AiModuleActivityEntry; onClose: () => void }) {
  const used = entry.used ?? {};

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={entry.operation_label ?? entry.operation}
      description={`#${entry.id} · ${formatWhen(entry.created_at)} · ${entry.actor_label ?? `user ${entry.actor_id ?? 'unknown'}`}${
        entry.capability ? ` · ${entry.capability}` : ''
      }`}
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="ais-stack">
        {entry.message && (
          <p className="ais-b-text" style={{ margin: 0, lineHeight: 1.6 }}>
            {entry.message}
          </p>
        )}

        <dl className="ais-grid-2" style={{ margin: 0, gap: 'var(--space-3)' }}>
          <Detail label="Status" value={entry.status} />
          <Detail label="Audit outcome" value={entry.outcome ?? '—'} />
          <Detail
            label="About"
            value={entry.subject_label ?? (entry.subject_id ? `${entry.subject_entity_key ?? 'record'} ${entry.subject_id}` : '—')}
          />
          <Detail label="Reference" value={entry.reference ?? '—'} />
        </dl>

        <div>
          <p className="ais-b-overline">AI Stack records used</p>
          {Object.keys(used).length === 0 ? (
            <p className="ais-b-text ais-muted ais-b-mt1" style={{ marginBottom: 0 }}>
              None. This operation ran without an AI capability, and is recorded that way.
            </p>
          ) : (
            <ul className="ais-b-list-reset ais-b-stack-xs ais-b-mt2">
              {used.agent && (
                <UsedRow
                  icon={Bot}
                  title={used.agent.name ?? 'Agent'}
                  lines={[
                    used.agent.id ? `id ${used.agent.id}` : null,
                    used.agent.run_id ? `run ${used.agent.run_id}` : null,
                    `from the ${used.agent.source.replace(/_/g, ' ')}`,
                  ]}
                />
              )}
              {used.prompt && (
                <UsedRow
                  icon={Terminal}
                  title={used.prompt.name}
                  lines={[
                    `${used.prompt.key} · v${used.prompt.version} · ${used.prompt.status}`,
                    'resolved from ai_templates by the backend',
                  ]}
                />
              )}
              {used.template && (
                <UsedRow
                  icon={FileText}
                  title={used.template.name}
                  lines={[
                    `${used.template.key} · v${used.template.version} · ${used.template.status}`,
                    'resolved from ai_templates by the backend',
                  ]}
                />
              )}
              {used.workflow && <UsedRow icon={Workflow} title={used.workflow} lines={['Workflow']} />}
              {used.tool && <UsedRow icon={Wrench} title={used.tool} lines={['Tool']} />}
            </ul>
          )}
        </div>

        {entry.result && (
          <div>
            <p className="ais-b-overline">Result</p>
            <pre className="ais-pre ais-b-pre-scroll ais-b-mt1">{JSON.stringify(entry.result, null, 2)}</pre>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ais-b-overline">{label}</dt>
      <dd className="ais-b-text" style={{ margin: 'var(--space-0-5) 0 0' }}>
        {value}
      </dd>
    </div>
  );
}

function UsedRow({ icon: Icon, title, lines }: { icon: typeof Bot; title: string; lines: Array<string | null> }) {
  return (
    <li className="ais-b-box ais-b-box--pad-sm ais-b-icon-top" style={{ gap: 'var(--space-3)' }}>
      <Icon size={16} className="ais-b-faint" aria-hidden="true" />
      <div className="ais-minw0">
        <p className="ais-b-strong" style={{ margin: 0, fontSize: 14 }}>
          {title}
        </p>
        {lines.filter(Boolean).map((line) => (
          <p key={line} className="ais-b-2xs" style={{ margin: 0 }}>
            {line}
          </p>
        ))}
      </div>
    </li>
  );
}
