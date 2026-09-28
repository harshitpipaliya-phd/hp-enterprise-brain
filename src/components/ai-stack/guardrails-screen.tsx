/**
 * AI Stack → Guardrails, for any module.
 *
 * The limits this module's AI operates within, and what they actually stopped.
 *
 * WHY THIS SCREEN READS RATHER THAN OWNS
 *
 * Every guardrail shown here is already configured in the place it is enforced:
 *
 *   · which capabilities the module may use at all → `ai_modules.capabilities`
 *   · whether a person must read what a model wrote → `requires_review` on each template,
 *     edited on the Prompts and Templates tabs
 *   · what may be sent to a model, and what must be disclosed → the module's AI policies
 *     on the Policies tab
 *   · who may operate any of it → `agents.<module>`, which in HP Brain is the
 *     `settings.manage` permission held by the Admin and Tenant admin roles
 *   · what an agent may call → the module's tool catalogue, where every tool is annotated
 *     `read` or `draft`
 *
 * A second place to edit any of those would be a second source of truth, and the first
 * time the two disagreed the one nobody was looking at would be the one being enforced. So
 * this tab gathers them into one view and sends the operator to the tab that owns each. It
 * is the only honest arrangement given the rule that these tabs must not duplicate each
 * other's function.
 *
 * THE GUARDRAIL THAT MATTERS MOST IS THE MODULE'S OWN
 *
 * `module.copy.centralRisk` is the one thing this module's AI must never do, and it is
 * stated at the top. It is not decoration: a guardrails screen that did not name the
 * module's central risk would be describing a different module.
 *
 * WHAT IT ADDS THAT NOTHING ELSE HAS
 *
 * The refusals. A guardrails screen listing only configuration is a screen of good
 * intentions; the rows at the bottom are the requests a rule actually stopped, with the
 * verdict the governance layer recorded and the reason it gave. Those come from
 * `ai_generation_requests` for this module's templates, whose `status` is that verdict — so
 * the list needs no hardcoded catalogue of failure names to stay accurate.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleSlash, KeyRound, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';

import { fetchModuleGuardrails, type AiModuleGuardrails } from '../../api/aiStack/module';
import { fetchAiPolicies, type AiPolicyRow } from '../../api/aiIntelligence/policies';
import { describeAiError } from '../../api/aiIntelligence/client';
import { toolsForModule } from './agentRegistry';
import { useAiStackProfile } from './profile-context';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackMetrics,
  AiStackPill,
  AiStackTableHead,
  formatWhen,
} from './ai-stack-chrome';
import { aiStackRbacKey, type AiStackModule } from './ai-stack-module';
import './aiStackScreens-b.css';

/**
 * What each capability flag actually permits, in the operator's terms.
 *
 * The keys are the ones `ai_modules.capabilities` carries. An unknown key is still
 * rendered — with its raw name — so a capability added in Laravel shows up here as
 * something rather than being silently dropped.
 */
function capabilityWording(module: AiStackModule): Record<string, { label: string; allows: string }> {
  return {
    conversational: {
      label: 'Conversational',
      allows: `Somebody may ask the assistant a ${module.label} question from a ${module.label} page.`,
    },
    generative: {
      label: 'Generative',
      allows: `A model may write text and fill ${module.label} report templates.`,
    },
    // Named for what is actually registered, not for the module: a module with no manifest
    // must not be described as having "the module's agent", because that names something
    // that does not exist.
    agent: { label: 'Agents', allows: module.copy.capabilityAgent },
    workflow: { label: 'Workflows', allows: module.copy.capabilityWorkflow },
    ontology: { label: 'Knowledge graph', allows: `${module.records} may be traversed through the entity graph.` },
  };
}

export function AiStackGuardrailsScreen({ module }: { module: AiStackModule }) {
  const [guardrails, setGuardrails] = useState<AiModuleGuardrails | null>(null);
  const [policies, setPolicies] = useState<AiPolicyRow[] | null>(null);
  /** Non-fatal: policies are a separate endpoint and a separate right. */
  const [policiesError, setPoliciesError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchModuleGuardrails(module.key)
      .then((next) => {
        if (cancelled) return;
        setGuardrails(next);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describeAiError(cause));
        setLoading(false);
      });

    fetchAiPolicies(module.key)
      .then((index) => {
        if (!cancelled) setPolicies(index.policies.filter((policy) => policy.status === 1));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setPoliciesError(describeAiError(cause, 'Policies unavailable.'));
      });

    return () => {
      cancelled = true;
    };
  }, [token, module.key]);

  /** This module's live agent tool catalogue — from its loaded profile, not a compiled-in list. */
  const profile = useAiStackProfile();
  const tools = useMemo(() => toolsForModule(profile.tools, module.key), [profile.tools, module.key]);
  const writeTools = useMemo(() => tools.filter((tool) => tool.risk === 'write' && tool.available), [tools]);

  const review = guardrails?.review;
  // Memoised together: `?? {}` is a fresh object each render, so deriving the key list from
  // it directly would rebuild that list on every render.
  const capabilities = useMemo(() => guardrails?.capabilities ?? {}, [guardrails]);
  const capabilityKeys = useMemo(() => Object.keys(capabilities), [capabilities]);
  const wording = useMemo(() => capabilityWording(module), [module]);

  const rbacKey = aiStackRbacKey(module);

  if (loading && !guardrails) {
    return <AiStackLoading label={`Loading ${module.label} guardrails…`} />;
  }

  return (
    <section className="ais-stack" aria-label={`${module.label} AI guardrails`}>
      <AiStackHeader
        icon={ShieldAlert}
        title={`${module.label} AI guardrails`}
        summary={`What the ${module.label} module's AI is allowed to do, what a person has to approve, and which requests a rule refused.`}
        loading={loading}
        onRefresh={reload}
      />

      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      <AiStackMetrics
        metrics={[
          {
            key: 'capabilities',
            label: 'Capabilities on',
            value: capabilityKeys.filter((key) => capabilities[key]).length,
            hint: `of ${capabilityKeys.length || '—'} for ${module.label}`,
          },
          {
            key: 'review',
            label: 'Need review',
            value: review?.available ? review.requires_review : '—',
            hint: review?.available ? `of ${review.templates} ${module.label} templates` : 'unavailable',
          },
          {
            key: 'policies',
            label: 'Active policies',
            value: policies ? policies.length : '—',
            hint: policiesError ? 'not readable' : `scoped to ${module.label}`,
          },
          {
            key: 'write-tools',
            label: 'Write tools',
            value: writeTools.length,
            hint: tools.length > 0 && writeTools.length === 0 ? 'this platform has none yet' : 'agents that change records',
          },
          {
            key: 'refusals',
            label: 'Refusals recorded',
            value: guardrails?.refusal_totals ? guardrails.refusal_totals.total : guardrails ? guardrails.refusals.length : '—',
            hint: guardrails?.refusal_totals
              ? `${guardrails.refusal_totals.refused} refused · ${guardrails.refusal_totals.failed} failed`
              : 'requests a rule stopped',
          },
        ]}
      />

      <AiStackHint>
        <strong>The rule this module turns on:</strong> {module.copy.centralRisk}
      </AiStackHint>

      <AiStackCard className="ais-b-overflow">
        <AiStackCardHeading
          title={`What ${module.label} AI may do at all`}
          hint={`From the ${module.label} row in ai_modules. A capability that is off cannot be reached, whatever a policy allows.`}
        />
        {capabilityKeys.length === 0 ? (
          <p className="ais-b-card-note">
            {guardrails?.module.registered === false
              ? `${module.label} is not registered as an AI module, so no capability is enabled for it.`
              : `No capability flags are recorded for ${module.label}.`}
          </p>
        ) : (
          <ul className="ais-b-divided">
            {capabilityKeys.map((key) => {
              const enabled = capabilities[key];
              const entry = wording[key];

              return (
                <li key={key} className="ais-b-li">
                  {enabled ? (
                    <CheckCircle2 size={16} className="ais-b-ok" aria-hidden="true" />
                  ) : (
                    <CircleSlash size={16} className="ais-b-faint" aria-hidden="true" />
                  )}
                  <div className="ais-b-flex1">
                    <div className="ais-row">
                      <span className={enabled ? 'ais-b-strong' : 'ais-b-faint'} style={{ fontSize: 14, fontWeight: 500 }}>
                        {entry?.label ?? key}
                      </span>
                      <AiStackPill tone={enabled ? 'green' : 'gray'}>{enabled ? 'allowed' : 'blocked'}</AiStackPill>
                    </div>
                    <p className={`ais-b-xs ais-b-mt1${enabled ? '' : ' ais-b-faint'}`} style={{ marginBottom: 0 }}>
                      {entry?.allows ?? `Capability "${key}", as recorded for ${module.label}.`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AiStackCard>

      <div className="ais-grid-2">
        <AiStackCard className="ais-b-overflow">
          <AiStackCardHeading
            title="Human review"
            hint="Whether a person must read what a model wrote before it is used. Set per template."
          />
          {!review?.available ? (
            <p className="ais-b-card-note">{review?.reason ?? 'Unavailable.'}</p>
          ) : review.templates === 0 ? (
            <p className="ais-b-card-note">
              {module.label} has no templates, so there is nothing to review and nothing a model can produce through
              them.
            </p>
          ) : (
            <>
              <dl className="ais-b-dl">
                <GuardRow label={`${module.label} templates`} value={`${review.templates}`} />
                <GuardRow label="Published, so in use" value={`${review.published}`} />
                <GuardRow
                  label="Require a person to review"
                  value={`${review.requires_review} of ${review.templates}`}
                  tone={review.requires_review === review.templates ? 'green' : 'amber'}
                />
                <GuardRow
                  label="May be cited as evidence"
                  value={`${review.allowed_as_evidence}`}
                  tone={review.allowed_as_evidence > 0 ? 'amber' : 'green'}
                />
              </dl>
              {review.requires_review < review.published && (
                <p className="ais-b-card-foot ais-b-card-foot--warning">
                  {review.published - review.requires_review} published {module.label} template(s) can produce output
                  nobody has to read. That is reasonable for an internal summary and is not for anything a person
                  outside the team receives — check which is which on the <strong>Prompts</strong> tab.
                </p>
              )}
            </>
          )}
        </AiStackCard>

        <AiStackCard className="ais-b-overflow">
          <AiStackCardHeading
            title={`What a ${module.label} agent may call`}
            hint="The module's tool catalogue. A tool absent from it cannot be put on an agent's allow-list."
          />
          {tools.length === 0 ? (
            <p className="ais-b-card-note">No tools are registered for {module.label}.</p>
          ) : (
            <ul className="ais-b-divided">
              {tools.map((tool) => (
                <li key={tool.key} className="ais-b-li ais-b-li--tight">
                  <Wrench size={14} className="ais-b-faint" aria-hidden="true" />
                  <div className="ais-b-flex1">
                    <div className="ais-row">
                      <span className="ais-mono">{tool.key}</span>
                      <AiStackPill tone={tool.risk === 'write' ? 'red' : tool.risk === 'draft' ? 'blue' : 'green'}>
                        {tool.risk}
                      </AiStackPill>
                      {!tool.available && <AiStackPill tone="gray">not selectable</AiStackPill>}
                    </div>
                    <p className="ais-b-xs ais-b-mt1" style={{ marginBottom: 0 }}>
                      {tool.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="ais-b-card-foot">
            {writeTools.length === 0 ? (
              <>
                Write tools: 0 — this platform has none yet, for {module.label} or any other module. Every registered
                tool reads what the {module.records} say and changes nothing, so the worst a {module.label} agent can
                do today is be wrong on screen, never wrong in the records.
              </>
            ) : (
              <>
                {writeTools.length} {module.label} tool(s) can change records. Any agent allowed one should require
                confirmation before it runs.
              </>
            )}
          </p>
        </AiStackCard>
      </div>

      <AiStackCard className="ais-b-overflow">
        <AiStackCardHeading
          title="Who may operate it"
          hint="In HP Brain these rights are the settings.manage permission, held by the Admin and Tenant admin roles, and checked again server-side on every create and run."
          actions={
            <span className="ais-b-key">
              <KeyRound size={14} aria-hidden="true" />
              {rbacKey}
            </span>
          }
        />
        <p className="ais-b-card-pad-y ais-b-xs" style={{ margin: 0 }}>
          Enabling, running and pausing {module.label} tool agents is gated on <span className="ais-mono">{rbacKey}</span>.{' '}
          {module.boundAgent ? (
            <>
              The {module.boundAgent.fallbackName} this module is bound to is gated separately, on the roles and
              permissions written into its own manifest, which is what the chatbot is checked against too — one
              authority for one agent, whichever screen it is run from.
            </>
          ) : (
            <>This module is bound to no backend agent, so that key is the only gate there is to grant here.</>
          )}{' '}
          Your own flags are shown on the <strong>Policies</strong> tab.
        </p>
      </AiStackCard>

      <AiStackCard className="ais-b-overflow">
        <AiStackCardHeading
          title="Disclosure and detection"
          hint={`From the ${module.label} AI policies. Edited on the Policies tab, which is where they are enforced from.`}
        />
        {policiesError ? (
          <p className="ais-b-card-note">{policiesError}</p>
        ) : !policies ? (
          <p className="ais-b-card-note" role="status">
            Loading {module.label} policies…
          </p>
        ) : policies.length === 0 ? (
          <p className="ais-b-card-note">
            No active policy is scoped to {module.label}, so {module.label} AI runs under whatever the estate-wide
            policies allow. Create one on the <strong>Policies</strong> tab to narrow it.
          </p>
        ) : (
          <div className="ais-table-wrap">
            <table className="ais-table ais-b-minw-44">
              <AiStackTableHead columns={['Policy', 'Disclosure', 'Acknowledgement', 'Detection', 'Refused uses']} />
              <tbody>
                {policies.map((policy) => {
                  const refused = Object.entries(policy.rules ?? {}).filter(([, enabled]) => !enabled);

                  return (
                    <tr key={policy.id}>
                      <td>
                        <div className="ais-b-strong">{policy.name}</div>
                        <div className="ais-b-xs ais-b-mt1">{policy.policy_type}</div>
                      </td>
                      <td>
                        <AiStackPill tone={policy.require_disclosure ? 'green' : 'amber'}>
                          {policy.require_disclosure ? 'required' : 'not required'}
                        </AiStackPill>
                      </td>
                      <td>
                        <AiStackPill tone={policy.require_acknowledgement ? 'green' : 'gray'}>
                          {policy.require_acknowledgement ? 'required' : 'not required'}
                        </AiStackPill>
                      </td>
                      <td className="ais-b-xs">
                        {policy.ai_detection_required || policy.plagiarism_check_required ? (
                          <>
                            <div>{policy.detection_provider ?? 'provider not set'}</div>
                            {policy.detection_threshold !== null && (
                              <div className="ais-b-faint">threshold {policy.detection_threshold}</div>
                            )}
                          </>
                        ) : (
                          <span className="ais-b-faint">not required</span>
                        )}
                      </td>
                      <td>
                        {refused.length ? (
                          <div className="ais-b-chips" style={{ maxWidth: '24rem' }}>
                            {refused.map(([key]) => (
                              <span key={key} className="ais-b-chip ais-b-chip--red">
                                {key}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="ais-b-xs ais-b-faint">nothing refused</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AiStackCard>

      <AiStackCard className="ais-b-overflow">
        <AiStackCardHeading
          title="Requests a rule refused"
          hint={`${module.label} generations that did not complete, with the verdict the governance layer recorded.`}
        />

        {guardrails?.refusal_totals && (
          <p className="ais-b-card-note" style={{ marginBottom: 0 }}>
            <strong>{guardrails.refusal_totals.total.toLocaleString('en-IN')}</strong> refused or failed in total —{' '}
            {guardrails.refusal_totals.refused.toLocaleString('en-IN')} refused by a quota before the call was sent,{' '}
            {guardrails.refusal_totals.failed.toLocaleString('en-IN')} failed at the provider or the network. The
            table below lists only the most recent {Math.min(guardrails.refusals.length, 25)}.
          </p>
        )}

        {guardrails && guardrails.refusal_counts.length > 0 && (
          <div className="ais-b-pill-row">
            {guardrails.refusal_counts.map((row) => (
              <AiStackPill key={row.status} tone={row.status === 'completed' ? 'green' : 'amber'}>
                {row.status} {row.count}
              </AiStackPill>
            ))}
          </div>
        )}

        {!guardrails || guardrails.refusals.length === 0 ? (
          <p className="ais-b-card-note ais-b-card-note--icon">
            <ShieldCheck size={16} className="ais-b-ok" aria-hidden="true" />
            <span>
              Nothing has been refused for {module.label}. That is either a clean record or an unused one — the{' '}
              <strong>Usage &amp; Cost</strong> tab says which, by showing how much has been asked of {module.label}{' '}
              AI at all.
            </span>
          </p>
        ) : (
          <div className="ais-table-wrap">
            <table className="ais-table ais-b-minw-52 ais-b-td-tight">
              <AiStackTableHead columns={['Request', 'Template', 'Verdict', 'Reason recorded', 'Model', 'When']} />
              <tbody>
                {guardrails.refusals.map((refusal) => (
                  <tr key={refusal.id}>
                    <td>
                      <div className="ais-mono ais-muted">{refusal.reference}</div>
                      {refusal.purpose && <div className="ais-b-xs ais-b-mt1">{refusal.purpose}</div>}
                    </td>
                    <td className="ais-mono ais-muted">{refusal.template_key ?? '—'}</td>
                    <td>
                      <AiStackPill tone="amber">{refusal.status}</AiStackPill>
                    </td>
                    <td className="ais-b-cell-max ais-b-xs">
                      {refusal.reason ?? <span className="ais-b-faint">none recorded</span>}
                    </td>
                    <td className="ais-b-xs">
                      {refusal.provider ? `${refusal.provider}${refusal.model ? ` · ${refusal.model}` : ''}` : '—'}
                    </td>
                    <td className="ais-b-nowrap ais-b-xs">{formatWhen(refusal.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AiStackCard>

      <AiStackHint>
        Each guardrail is edited where it is enforced — capabilities in the AI module registry, review on a template,
        disclosure on a policy, tool reach in the agent catalogue, and who may operate it in HP Brain&apos;s role
        permissions. This tab reads all five so they can be checked together, and deliberately does not offer a second
        place to change them.
      </AiStackHint>
    </section>
  );
}

function GuardRow({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'amber' }) {
  return (
    <div className="ais-b-dl-row">
      <dt>{label}</dt>
      <dd>
        {value}
        {tone && <AiStackPill tone={tone}>{tone === 'green' ? 'all' : 'partial'}</AiStackPill>}
      </dd>
    </div>
  );
}
