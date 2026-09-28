/**
 * AI Stack → Policies, for any module. Ported from G2G's components/ai-stack/policies-screen.tsx.
 *
 * What the AI is allowed to do in this module, who may operate it, and what it must
 * disclose when it does.
 *
 * DECENTRALISED, NOT DUPLICATED
 *
 * Every row here is an `ai_policies` row reached through the same
 * `api/aiIntelligence/policies` client the central AI & Intelligence console uses. There
 * is no second policy store and no second set of endpoints. What makes a policy this
 * module's is the scope: the list is fetched with `module_key=<this module>`, so it only
 * ever contains policies carrying a `module` assignment for it, and every save from this
 * screen writes that assignment itself. A policy created here cannot come out filed
 * against another module, because the module is not a control the operator can reach.
 *
 * The scope is stored in `ai_policy_assignments` using the columns it already has —
 * `scope_type = 'module'` with `scope_id` set to this module's row in `ai_modules`.
 * Nothing was added to the database to hold it. The ids come from `/policies/options` and
 * from the index's own `module_ids`, never from a constant here: they differ per
 * deployment, and a hardcoded id would silently scope a policy to whatever module happened
 * to be at that id.
 *
 * WHY "WHO MAY OPERATE IT" IS SHOWN HERE AND NOT EDITED HERE
 *
 * A policy says what the AI may do. It does not say who may do it — that is RBAC, and in
 * HP Brain it is the signed-in role. Building a second place to grant it would be a second
 * authorization system, and the one thing worse than a permission nobody holds is two
 * answers to who holds it.
 *
 * So the panel below reads the caller's own resolved rights and names the key, because the
 * failure this replaces was a screen that said "ask an administrator for rights" without
 * anywhere to see whether you had them or what the key even was. It shows; it does not
 * grant.
 *
 * HP BRAIN PORT: ids are UUID strings; a shared platform row is recognised with
 * `isPlatformPolicy` (G2G tested `sub_institute_id === null`); retiring asks through
 * HP Brain's ConfirmationDialog instead of `window.confirm`. G2G's AiFieldAssistant (the
 * sparkle helper on the description field) has no HP Brain counterpart and is omitted.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Copy, KeyRound, Pencil, Plus, Save, ShieldCheck, SlidersHorizontal, Trash2, X } from 'lucide-react';

import { Button, ConfirmationDialog, Field, IconButton, Select, TextInput, Textarea } from '../../ui';
import { usePermissions } from './adapters/use-permission';
import {
  createAiPolicy,
  fetchAiPolicies,
  fetchAiPolicyOptions,
  isPlatformPolicy,
  retireAiPolicy,
  updateAiPolicy,
  type AiPolicyOptions,
  type AiPolicyRow,
} from '../../api/aiIntelligence/policies';
import { describeAiError } from '../../api/aiIntelligence/client';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackEmpty,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackNotice,
  AiStackPill,
  AiStackTableHead,
} from './ai-stack-chrome';
import { aiStackRbacKey, type AiStackModule } from './ai-stack-module';
import './aiStackScreens-a.css';

/** Scopes other than the module one, which this screen owns and never offers. */
const EXTRA_SCOPES_HINT =
  'Narrow it further from the central AI console if it should only apply to one department or position.';

interface FormState {
  id: string | null;
  /**
   * True when saving will fork a shared platform policy into this organisation's own copy.
   *
   * A platform policy belongs to no organisation — it is the example every organisation
   * resolves, owned by none of them. The backend refuses to edit one in place and writes a
   * copy instead; the form says so before the save rather than after, because "I edited
   * the shared policy" and "I forked it" are different things to be told afterwards. The
   * Prompts tab makes the same distinction for the same reason.
   */
  forks: boolean;
  name: string;
  description: string;
  policy_type: string;
  status: number;
  require_disclosure: number;
  require_acknowledgement: number;
  ai_detection_required: number;
  plagiarism_check_required: number;
  detection_provider: string;
  detection_threshold: string;
  rules: Record<string, boolean>;
  /** Scopes the operator did not set here — carried through a save untouched. */
  otherAssignments: Array<{ scope_type: string; scope_id: string | null; status: number }>;
}

function blankForm(options: AiPolicyOptions | null): FormState {
  return {
    id: null,
    forks: false,
    name: '',
    description: '',
    policy_type: options?.policy_types[0]?.value ?? 'ai_assisted',
    status: 1,
    // On by default. Anything a customer or a member of staff reads should say that a
    // machine drafted it.
    require_disclosure: 1,
    require_acknowledgement: 0,
    ai_detection_required: 0,
    plagiarism_check_required: 0,
    detection_provider: '',
    detection_threshold: '',
    rules: Object.fromEntries((options?.rule_catalogue ?? []).map((rule) => [rule.key, !!rule.default])),
    otherAssignments: [],
  };
}

function formFrom(row: AiPolicyRow): FormState {
  return {
    id: row.id,
    // A platform row belongs to no organisation. See the note on FormState.forks.
    forks: isPlatformPolicy(row),
    name: row.name,
    description: row.description ?? '',
    policy_type: row.policy_type,
    status: row.status,
    require_disclosure: row.require_disclosure,
    require_acknowledgement: row.require_acknowledgement,
    ai_detection_required: row.ai_detection_required,
    plagiarism_check_required: row.plagiarism_check_required,
    detection_provider: row.detection_provider ?? '',
    detection_threshold: row.detection_threshold?.toString() ?? '',
    rules: row.rules,
    // Saving replaces a policy's whole assignment set, so anything this screen does not
    // manage has to be handed back or editing a policy here would quietly drop the
    // department or position scope somebody set centrally.
    otherAssignments: row.assignments
      .filter((assignment) => assignment.scope_type !== 'module')
      .map((assignment) => ({
        scope_type: assignment.scope_type,
        scope_id: assignment.scope_id,
        status: assignment.status,
      })),
  };
}

export function AiStackPoliciesScreen({ module }: { module: AiStackModule }) {
  const [options, setOptions] = useState<AiPolicyOptions | null>(null);
  const [rows, setRows] = useState<AiPolicyRow[]>([]);
  /** The `ai_modules` ids this module resolves to. A save needs one; without any, it cannot. */
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [retiring, setRetiring] = useState<AiPolicyRow | null>(null);
  const [retireBusy, setRetireBusy] = useState(false);
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchAiPolicyOptions(), fetchAiPolicies(module.key)])
      .then(([nextOptions, index]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setRows(index.policies);
        // The index reports the ids it filtered on; options carries the same list for
        // every module. Either answers "which id is this module", and neither is hardcoded.
        setModuleIds(
          index.module_ids?.length
            ? index.module_ids
            : (nextOptions.modules ?? [])
                .filter((entry) => entry.key === module.key)
                .map((entry) => entry.id),
        );
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
  }, [token, module.key]);

  const patch = (changes: Partial<FormState>) =>
    setForm((current) => (current ? { ...current, ...changes } : current));

  const toggleRule = (key: string) =>
    setForm((current) =>
      current ? { ...current, rules: { ...current.rules, [key]: !(current.rules[key] ?? false) } } : current,
    );

  /**
   * The module scope every save writes.
   *
   * G2G preferred the institute's own `ai_modules` row by taking the highest numeric id.
   * UUIDs carry no such order, so HP Brain takes the id `/policies/options` offers for
   * this module key: the server has already chosen there (active rows only, the
   * organisation's own row over the platform one), and it is the one id the save
   * validation accepts. The index's `module_ids` is the fallback only.
   */
  const moduleScopeId =
    options?.modules.find((option) => option.key === module.key)?.id
    ?? (moduleIds.length ? moduleIds[moduleIds.length - 1] : null);

  const canSave = moduleScopeId !== null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || moduleScopeId === null) return;

    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() === '' ? null : form.description.trim(),
      policy_type: form.policy_type,
      status: form.status,
      require_disclosure: form.require_disclosure,
      require_acknowledgement: form.require_acknowledgement,
      ai_detection_required: form.ai_detection_required,
      plagiarism_check_required: form.plagiarism_check_required,
      detection_provider: form.detection_provider.trim() === '' ? null : form.detection_provider.trim(),
      detection_threshold: form.detection_threshold.trim() === '' ? null : Number(form.detection_threshold),
      rules: form.rules,
      // The module assignment is added by this screen, not chosen by the operator — it is
      // what makes the policy this module's policy at all.
      assignments: [
        { scope_type: 'module', scope_id: moduleScopeId, status: 1 },
        ...form.otherAssignments,
      ],
    };

    try {
      if (form.id === null) {
        await createAiPolicy(payload);
        setNotice(`${module.label} AI policy saved. It applies to the ${module.label} module only.`);
      } else {
        const result = await updateAiPolicy(form.id, payload);
        setNotice(
          result.action === 'forked' || form.forks
            ? 'Saved as this organisation’s own copy. The shared example policy is unchanged for every other organisation.'
            : `${module.label} AI policy updated.`,
        );
      }

      setForm(null);
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setSaving(false);
    }
  };

  const retire = async () => {
    if (!retiring) return;

    setRetireBusy(true);

    try {
      await retireAiPolicy(retiring.id);
      setNotice('Policy retired.');
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setRetireBusy(false);
      setRetiring(null);
    }
  };

  const ruleCatalogue = useMemo(() => options?.rule_catalogue ?? [], [options]);

  if (loading && !options) {
    return <AiStackLoading label={`Loading ${module.label} AI policies…`} />;
  }

  const openNew = () => {
    setForm(blankForm(options));
    setNotice('');
  };

  return (
    <section className="ais-a-section">
      <AiStackHeader
        icon={SlidersHorizontal}
        title={`${module.label} AI policies`}
        summary={`What the AI may be used for inside ${module.label}, who may operate it, and what it has to disclose. These policies apply to the ${module.label} module only.`}
        loading={loading}
        onRefresh={reload}
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={openNew}
            disabled={!canSave}
            title={canSave ? undefined : `${module.label} is not registered in ai_modules on this deployment.`}
          >
            New policy
          </Button>
        }
      />

      <AiStackHint>
        A policy saved here is scoped to {module.label} — it is stored against the {module.label} module and no
        other module reads it. {EXTRA_SCOPES_HINT}
      </AiStackHint>

      <div aria-live="polite" className="ais-a-live">
        {notice && <AiStackNotice>{notice}</AiStackNotice>}
      </div>
      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      <OperatorRightsPanel module={module} />

      {!canSave && !loading && (
        <AiStackError>
          {module.label} has no row in <span className="ais-a-mono">ai_modules</span> for this organisation, so a
          policy cannot be scoped to it. An administrator needs to register the {module.label} module before policies
          can be saved here.
        </AiStackError>
      )}

      {rows.length === 0 && !loading ? (
        <AiStackEmpty
          icon={ShieldCheck}
          title={`No ${module.label} AI policies yet`}
          action={
            canSave ? (
              <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={openNew}>
                New policy
              </Button>
            ) : undefined
          }
        >
          Until one exists, {module.label} AI runs under whatever the organisation-wide policies allow. A policy
          created here narrows that to {module.label}. {module.copy.centralRisk}
        </AiStackEmpty>
      ) : (
        <AiStackCard className="ais-a-card-clip">
          <div className="ais-table-wrap">
            <table className="ais-table ais-a-table--56">
              <AiStackTableHead
                columns={['Policy', 'Type', 'Disclosure', 'Detection', 'Allowed uses', 'Status', 'Actions']}
              />
              <tbody>
                {rows.map((policy) => {
                  const allowed = Object.entries(policy.rules).filter(([, enabled]) => enabled);
                  const platform = isPlatformPolicy(policy);

                  return (
                    <tr key={policy.id}>
                      <td>
                        <div className="ais-a-strong">{policy.name}</div>
                        {policy.description && <div className="ais-a-cell-desc">{policy.description}</div>}
                      </td>
                      <td className="ais-a-nowrap ais-a-cell-xs">
                        <div className="ais-a-cell-stack">
                          <span>{policy.policy_type}</span>
                          {policy.is_example ? <AiStackPill tone="blue">example</AiStackPill> : null}
                        </div>
                      </td>
                      <td className="ais-a-cell-xs">
                        {policy.require_disclosure ? 'Required' : 'Not required'}
                        {policy.require_acknowledgement ? <div className="ais-a-faint">+ acknowledgement</div> : null}
                      </td>
                      <td className="ais-a-cell-xs">
                        {policy.ai_detection_required || policy.plagiarism_check_required ? (
                          <>
                            <div>{policy.detection_provider ?? 'provider not set'}</div>
                            {policy.detection_threshold !== null && (
                              <div className="ais-a-faint">threshold {policy.detection_threshold}</div>
                            )}
                          </>
                        ) : (
                          <span className="ais-a-faint">Not required</span>
                        )}
                      </td>
                      <td>
                        {allowed.length ? (
                          <div className="ais-a-chips">
                            {allowed.map(([key]) => (
                              <span key={key} className="ais-a-chip">
                                {ruleCatalogue.find((rule) => rule.key === key)?.label ?? key}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="ais-a-cell-xs ais-a-faint">None permitted</span>
                        )}
                      </td>
                      <td>
                        <AiStackPill tone={policy.status ? 'green' : 'gray'}>
                          {policy.status ? 'active' : 'retired'}
                        </AiStackPill>
                      </td>
                      <td>
                        <div className="ais-a-actions">
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={platform ? <Copy size={14} aria-hidden="true" /> : <Pencil size={14} aria-hidden="true" />}
                            onClick={() => {
                              setForm(formFrom(policy));
                              setNotice('');
                            }}
                            aria-label={`${platform ? 'Customise' : 'Edit'} ${policy.name}`}
                          >
                            {platform ? 'Customise' : 'Edit'}
                          </Button>
                          {/* A shared example belongs to no organisation, so retiring it here
                              would retire it for all of them. The backend refuses; the
                              button is not offered rather than offered and rejected. */}
                          {policy.status && !platform ? (
                            <Button
                              size="sm"
                              variant="danger"
                              icon={<Trash2 size={14} aria-hidden="true" />}
                              onClick={() => setRetiring(policy)}
                              aria-label={`Retire ${policy.name}`}
                            >
                              Retire
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AiStackCard>
      )}

      {form && (
        <form onSubmit={submit} className="ais-a-panel" aria-labelledby={`${module.key}-policy-form-title`}>
          <div className="ais-a-panel-head">
            <h3 id={`${module.key}-policy-form-title`} className="ais-a-panel-title">
              {form.id === null
                ? `New ${module.label} AI policy`
                : form.forks
                  ? 'Customise for this organisation'
                  : `Edit ${module.label} AI policy`}
            </h3>
            <IconButton label="Close" size="sm" onClick={() => setForm(null)}>
              <X size={16} aria-hidden="true" />
            </IconButton>
          </div>

          {form.forks && (
            <p className="ais-a-callout ais-a-callout--info">
              <span>
                This is a shared example policy, read by every organisation. Saving writes{' '}
                <strong>this organisation its own copy</strong> — every other organisation keeps the original, and
                the copy is yours to edit or retire.
              </span>
            </p>
          )}

          <div className="ais-a-grid-2">
            <Field label="Module Name" required help={`This policy applies to ${module.label} only.`}>
              <TextInput value={module.label} readOnly className="ais-a-readonly" />
            </Field>

            <Field label="Policy name" required>
              <TextInput
                value={form.name}
                onChange={(event) => patch({ name: event.target.value })}
                required
                maxLength={191}
                placeholder={module.copy.policyNamePlaceholder}
              />
            </Field>
          </div>

          <div className="ais-a-grid-2">
            <Field label="Policy type" required>
              <Select value={form.policy_type} onChange={(event) => patch({ policy_type: event.target.value })}>
                {(options?.policy_types ?? []).map((policyType) => (
                  <option key={policyType.value} value={policyType.value}>
                    {policyType.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Status" help="Only an active policy is applied.">
              <Select value={String(form.status)} onChange={(event) => patch({ status: Number(event.target.value) })}>
                <option value="1">Active</option>
                <option value="0">Retired</option>
              </Select>
            </Field>
          </div>

          <Field label="What it permits, in plain words">
            <Textarea
              id={`${module.key}-policy-description`}
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
              rows={3}
              maxLength={2000}
            />
          </Field>

          <fieldset className="ais-a-fieldset">
            <legend>Disclosure</legend>
            <div className="ais-a-grid-toggles">
              <Toggle
                label="Require disclosure"
                hint={`An AI-assisted ${module.label} message says so.`}
                checked={form.require_disclosure === 1}
                onChange={(next) => patch({ require_disclosure: next ? 1 : 0 })}
              />
              <Toggle
                label="Require acknowledgement"
                hint="A person confirms they have read the disclosure."
                checked={form.require_acknowledgement === 1}
                onChange={(next) => patch({ require_acknowledgement: next ? 1 : 0 })}
              />
              <Toggle
                label="Require AI detection"
                checked={form.ai_detection_required === 1}
                onChange={(next) => patch({ ai_detection_required: next ? 1 : 0 })}
              />
              <Toggle
                label="Require plagiarism check"
                checked={form.plagiarism_check_required === 1}
                onChange={(next) => patch({ plagiarism_check_required: next ? 1 : 0 })}
              />
            </div>

            {(form.ai_detection_required === 1 || form.plagiarism_check_required === 1) && (
              <div className="ais-a-grid-2 ais-a-fieldset-extra">
                <Field label="Detection provider">
                  <TextInput
                    value={form.detection_provider}
                    onChange={(event) => patch({ detection_provider: event.target.value })}
                    maxLength={120}
                  />
                </Field>
                <Field label="Detection threshold">
                  <TextInput
                    value={form.detection_threshold}
                    onChange={(event) => patch({ detection_threshold: event.target.value })}
                    inputMode="decimal"
                    placeholder="0 – 100"
                  />
                </Field>
              </div>
            )}
          </fieldset>

          <fieldset className="ais-a-fieldset">
            <legend>Allowed AI uses in {module.label}</legend>
            {ruleCatalogue.length === 0 ? (
              <p className="ais-a-body">
                The rule catalogue came back empty, so there is nothing to permit or refuse yet.
              </p>
            ) : (
              <div className="ais-a-grid-toggles">
                {ruleCatalogue.map((rule) => (
                  <Toggle
                    key={rule.key}
                    label={rule.label}
                    checked={!!form.rules[rule.key]}
                    onChange={() => toggleRule(rule.key)}
                  />
                ))}
              </div>
            )}
          </fieldset>

          {form.otherAssignments.length > 0 && (
            <p className="ais-a-callout ais-a-callout--neutral">
              <span>
                This policy also carries {form.otherAssignments.length} scope
                {form.otherAssignments.length === 1 ? '' : 's'} set in the central AI console (
                {form.otherAssignments.map((assignment) => assignment.scope_type).join(', ')}). Saving here keeps them.
              </span>
            </p>
          )}

          <div className="ais-a-actions ais-a-actions--top">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!canSave}
              icon={saving ? undefined : <Save size={16} aria-hidden="true" />}
            >
              Save
            </Button>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <ConfirmationDialog
        open={retiring !== null}
        onCancel={() => setRetiring(null)}
        onConfirm={() => void retire()}
        title={retiring ? `Retire "${retiring.name}"?` : 'Retire policy?'}
        description={`${module.label} AI will stop applying it.`}
        confirmLabel="Retire"
        destructive
        loading={retireBusy}
      />
    </section>
  );
}

/**
 * Your own rights over this module's AI, and the key they are granted against.
 *
 * Read-only by design — see the note at the top of this file. It answers the two questions
 * a person actually has when a control is disabled: what am I allowed to do, and what is
 * the thing an administrator has to grant me.
 *
 * `undefined` is rendered as "not known yet" rather than as "no", because a permission
 * lookup that has not answered and one that answered no are different states, and showing
 * a red cross for the first is how a working account is told it is locked out.
 */
function OperatorRightsPanel({ module }: { module: AiStackModule }) {
  const moduleKey = aiStackRbacKey(module);
  const modules = useMemo(() => [moduleKey], [moduleKey]);
  const { permissions, loading, authenticated, error } = usePermissions(modules);

  const flags = permissions?.[moduleKey];

  const cells: Array<{ action: 'view' | 'create' | 'update' | 'delete'; label: string; hint: string }> = [
    { action: 'view', label: `See ${module.label} agents`, hint: 'Open Automations and read the run log.' },
    { action: 'create', label: 'Enable an agent', hint: `Switch on a ${module.label} agent for this organisation.` },
    { action: 'update', label: 'Run or pause an agent', hint: 'Run an agent, and pause or resume one.' },
    { action: 'delete', label: 'Remove an agent', hint: `Archive a ${module.label} agent.` },
  ];

  return (
    <AiStackCard>
      <AiStackCardHeading
        title={`Who may operate ${module.label} AI`}
        hint={`Granted through your HP Brain role against the "${moduleKey}" key, not here.`}
        actions={
          <span className="ais-a-keytag">
            <KeyRound size={14} aria-hidden="true" />
            {moduleKey}
          </span>
        }
      />

      <div className="ais-card-body">
        {error && <p className="ais-a-callout ais-a-callout--warn ais-a-rights-error">{error}</p>}

        <div className="ais-a-grid-4">
          {cells.map((cell) => {
            const value = loading || !authenticated ? undefined : (flags?.[cell.action] ?? false);

            return (
              <div key={cell.action} className="ais-a-right">
                <p className="ais-a-right-label">{cell.label}</p>
                <p className="ais-a-right-hint">{cell.hint}</p>
                <p className="ais-a-right-value">
                  {value === undefined ? (
                    <AiStackPill tone="gray">not known yet</AiStackPill>
                  ) : value ? (
                    <AiStackPill tone="green">you may</AiStackPill>
                  ) : (
                    <AiStackPill tone="amber">you may not</AiStackPill>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        <p className="ais-a-rights-foot">
          These flags decide what the Automations tab offers you. The backend checks the same key again on every
          create and every run, so a client that ignored them would gain nothing.
        </p>
      </div>
    </AiStackCard>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="ais-a-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="ais-minw0">
        {label}
        {hint && <span className="ais-a-toggle-hint">{hint}</span>}
      </span>
    </label>
  );
}
