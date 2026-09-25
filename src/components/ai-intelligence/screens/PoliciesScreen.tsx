import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

import {
  Alert, Button, Checkbox, ConfirmationDialog, Field, Select, StatusBadge, TextInput, Textarea,
} from '../../../ui';
import { AiApiError, describeAiError } from '../../../api/aiIntelligence/client';
import {
  createAiPolicy,
  fetchAiPolicyOptions,
  fetchAiPolicies,
  isPlatformPolicy,
  retireAiPolicy,
  updateAiPolicy,
  type AiPolicyIndex,
  type AiPolicyOptions,
  type AiPolicyPayload,
  type AiPolicyRow,
  type AiPolicyScopeTarget,
} from '../../../api/aiIntelligence/policies';
import { CapabilityShell } from '../CapabilityShell';
import { LoadingLine, Notice } from '../console-ui';
import './policies.css';

/**
 * AI Policies — what AI may be used for, where it applies, and what disclosure is
 * required. Ported from G2G's app/ai/policies/page.tsx.
 *
 * The one structural difference is where scopes come from: G2G listed its own
 * scope kinds; HP Brain renders whatever `/policies/options` returns in
 * `scope_types` and `scope_targets` (organisation, module, department and position
 * today), so a scope added on the server appears here with no change to this file.
 */

interface FormState {
  id: string | null;
  /** Set when the row being edited is a shared platform policy — a save forks it. */
  platform: boolean;
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
  assignments: Array<{ scope_type: string; scope_id: string; status: number }>;
}

const EMPTY_FORM: FormState = {
  id: null,
  platform: false,
  name: '',
  description: '',
  policy_type: 'ai_assisted',
  status: 1,
  require_disclosure: 0,
  require_acknowledgement: 0,
  ai_detection_required: 0,
  plagiarism_check_required: 0,
  detection_provider: '',
  detection_threshold: '',
  rules: {},
  assignments: [],
};

/**
 * Scope kinds that name the whole organisation rather than a row in it. G2G's was
 * `global`; HP Brain's is `organisation`. Either is accepted so a server that sends
 * the other spelling still gets the note rather than an empty picker.
 */
const WHOLE_ORGANISATION_SCOPES = new Set(['global', 'organisation', 'organization', 'tenant']);

export default function PoliciesScreen() {
  return (
    <CapabilityShell slug="policies">
      <PolicyManager />
    </CapabilityShell>
  );
}

function PolicyManager() {
  const [options, setOptions] = useState<AiPolicyOptions | null>(null);
  const [index, setIndex] = useState<AiPolicyIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [retiring, setRetiring] = useState<AiPolicyRow | null>(null);
  const [retireBusy, setRetireBusy] = useState(false);

  const formHeadingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchAiPolicyOptions(), fetchAiPolicies()])
      .then(([nextOptions, nextIndex]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setIndex(nextIndex);
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
  }, [reloadToken]);

  // The form opens below the table. Focus moves to its heading so a keyboard or
  // screen-reader user lands where the form is rather than on the button they left.
  const formKey = form ? form.id ?? 'new' : null;
  useEffect(() => {
    if (formKey !== null) {
      formHeadingRef.current?.focus();
      formHeadingRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    }
  }, [formKey]);

  const defaultPolicyType = (): string => {
    const types = options?.policy_types ?? [];
    return types.some((type) => type.value === EMPTY_FORM.policy_type)
      ? EMPTY_FORM.policy_type
      : types[0]?.value ?? EMPTY_FORM.policy_type;
  };

  const openAdd = () => {
    setForm({
      ...EMPTY_FORM,
      policy_type: defaultPolicyType(),
      rules: Object.fromEntries((options?.rule_catalogue ?? []).map((rule) => [rule.key, !!rule.default])),
      assignments: [],
    });
    setNotice(null);
    setError(null);
    setFieldErrors({});
  };

  const openEdit = (row: AiPolicyRow) => {
    setForm({
      id: row.id,
      platform: isPlatformPolicy(row),
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
      rules: row.rules ?? {},
      assignments: (row.assignments ?? []).map((assignment) => ({
        scope_type: assignment.scope_type,
        scope_id: assignment.scope_id ?? '',
        status: assignment.status,
      })),
    });
    setNotice(null);
    setError(null);
    setFieldErrors({});
  };

  const closeForm = () => {
    setForm(null);
    setFieldErrors({});
  };

  const patchForm = (changes: Partial<FormState>) =>
    setForm((current) => (current ? { ...current, ...changes } : current));

  const addAssignment = () => {
    const firstScope = options?.scope_types[0]?.value ?? '';
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        assignments: [...current.assignments, { scope_type: firstScope, scope_id: '', status: 1 }],
      };
    });
  };

  const removeAssignment = (position: number) => {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        assignments: current.assignments.filter((_, itemIndex) => itemIndex !== position),
      };
    });
  };

  const updateAssignment = (position: number, field: 'scope_type' | 'scope_id' | 'status', value: string | number) => {
    setForm((current) => {
      if (!current) return current;
      const nextAssignments = [...current.assignments];
      nextAssignments[position] = {
        ...nextAssignments[position],
        [field]: value,
        // Changing the scope clears the target: a department id left behind on a
        // position assignment would point at nothing, or at whichever row happened
        // to share it — an assignment nobody made.
        ...(field === 'scope_type' ? { scope_id: '' } : {}),
      };
      return { ...current, assignments: nextAssignments };
    });
  };

  const toggleRule = (key: string) => {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        rules: {
          ...current.rules,
          [key]: !(current.rules[key] ?? false),
        },
      };
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload: AiPolicyPayload = {
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
      assignments: form.assignments
        .map((assignment) => ({
          scope_type: assignment.scope_type,
          // Ids are UUID strings in HP Brain — sent as they came, never coerced.
          scope_id: assignment.scope_id.trim() === '' ? null : assignment.scope_id,
          status: assignment.status,
        }))
        .filter((assignment) => assignment.scope_type),
    };

    try {
      if (form.id === null) {
        await createAiPolicy(payload);
        setNotice('Policy saved.');
      } else {
        const result = await updateAiPolicy(form.id, payload);
        setNotice(
          result?.action === 'forked'
            ? 'Saved as this organisation’s own copy of the platform policy. It takes precedence here, and the shared policy is unchanged for everyone else.'
            : 'Policy updated.',
        );
      }

      closeForm();
      load();
    } catch (cause) {
      setError(describeAiError(cause));
      if (cause instanceof AiApiError) {
        const next: Record<string, string> = {};
        for (const [key, messages] of Object.entries(cause.fieldErrors ?? {})) {
          if (Array.isArray(messages) && messages[0]) next[key] = messages[0];
        }
        setFieldErrors(next);
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmRetire = async () => {
    if (!retiring) return;
    setRetireBusy(true);

    try {
      await retireAiPolicy(retiring.id);
      setNotice('Policy retired.');
      load();
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setRetireBusy(false);
      setRetiring(null);
    }
  };

  const scopeOptions = useMemo(() => options?.scope_types ?? [], [options]);

  if (loading && !index) {
    return <LoadingLine>Loading AI policies…</LoadingLine>;
  }

  if (error && !index) {
    return (
      <div className="aii-stack">
        <Notice icon="error" title="AI policies could not be loaded">{error}</Notice>
        <div>
          <Button size="sm" onClick={load} icon={<RefreshCw size={14} aria-hidden="true" />}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const policies = index?.policies ?? [];

  return (
    <section className="aii-stack">
      <header className="aii-row aii-row--between">
        <div>
          <h2 className="aii-card-title pol-section-title">AI policy management</h2>
          <p className="aii-card-desc">
            Define what AI can be used for, where it applies, and what disclosure is required.
          </p>
        </div>
        <div className="aii-row">
          <Button
            size="sm"
            onClick={load}
            icon={<RefreshCw size={14} className={loading ? 'aii-spin' : undefined} aria-hidden="true" />}
          >
            Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={openAdd} icon={<Plus size={14} aria-hidden="true" />}>
            Add policy
          </Button>
        </div>
      </header>

      <div aria-live="polite" aria-atomic="true">
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      {/* The error state above this component's return only renders before the first
          successful load. Without this banner a failed Save or Retire set the error and
          showed nothing at all — the row stayed on screen and the administrator had
          no way to know the write had been refused. Shown in the form instead while
          the form is open, next to the fields it is about. */}
      {error && index && !form && <Alert tone="danger">{error}</Alert>}

      <div className="aii-table-wrap">
        <table className="aii-table aii-table--wide">
          <caption className="u-sr-only">AI policies</caption>
          <thead>
            <tr>
              <th scope="col">Policy</th>
              <th scope="col">Type</th>
              <th scope="col">Scope</th>
              <th scope="col">Disclosure</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 && (
              <tr>
                <td colSpan={6} className="pol-empty-cell">
                  No AI policies yet. Add one to say what AI may be used for here.
                </td>
              </tr>
            )}

            {policies.map((policy) => {
              const platform = isPlatformPolicy(policy);
              return (
                <tr key={policy.id}>
                  <td>
                    <div className="pol-name">{policy.name}</div>
                    <div className="aii-card-sub">{policy.description ?? 'No description provided.'}</div>
                  </td>
                  <td className="aii-muted">
                    <div className="aii-row">
                      <span>{policyTypeLabel(options, policy.policy_type)}</span>
                      {/* A platform policy is shared by every organisation. Marked here
                          rather than only refused on save, so nobody spends an edit on
                          a row the API is going to decline. */}
                      {platform ? (
                        <span
                          className="pol-platform"
                          title="A platform policy shared by every organisation. Create your own to override it."
                        >
                          <Lock size={10} aria-hidden="true" />
                          Platform
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="aii-muted">
                    {policy.assignments?.length ? `${policy.assignments.length} assignments` : 'Global'}
                  </td>
                  <td className="aii-muted">{policy.require_disclosure ? 'Required' : 'Not required'}</td>
                  <td>
                    <StatusBadge tone={policy.status ? 'success' : 'neutral'}>
                      {policy.status ? 'Active' : 'Retired'}
                    </StatusBadge>
                  </td>
                  <td>
                    {policy.editable ? (
                      <div className="aii-row">
                        <Button
                          size="sm"
                          onClick={() => openEdit(policy)}
                          icon={<Pencil size={14} aria-hidden="true" />}
                          aria-label={`Edit ${policy.name}`}
                        >
                          Edit
                        </Button>
                        {policy.status === 1 && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setRetiring(policy)}
                            icon={<Trash2 size={14} aria-hidden="true" />}
                            aria-label={`Retire ${policy.name}`}
                          >
                            Retire
                          </Button>
                        )}
                      </div>
                    ) : (
                      // The API refuses these too — this is the explanation, not the
                      // control. It says what to do instead, because "read only" on its
                      // own leaves an administrator with no next step: the answer is to
                      // write their own, which then takes precedence over this one.
                      <span
                        className="aii-small aii-muted"
                        title="Shared by every organisation. Add your own policy to override it — an organisation policy takes precedence."
                      >
                        Shared — read only
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form && (
        <section className="aii-card" aria-labelledby="pol-form-title">
          <div className="aii-row aii-row--between">
            <h3 id="pol-form-title" ref={formHeadingRef} tabIndex={-1} className="pol-form-title">
              {form.id === null ? 'Add policy' : 'Edit policy'}
            </h3>
            <Button size="sm" variant="ghost" onClick={closeForm}>Close</Button>
          </div>

          <form className="aii-form pol-form" onSubmit={submit}>
            <div aria-live="polite" aria-atomic="true">
              {error && <Alert tone="danger" title="The policy was not saved">{error}</Alert>}
            </div>

            {form.platform && (
              <Alert tone="info">
                This is a platform policy every organisation uses. Saving writes a copy owned by this
                organisation, which takes precedence here and leaves the shared one untouched.
              </Alert>
            )}

            <div className="aii-form-grid">
              <Field label="Policy name" required error={fieldErrors.name}>
                <TextInput
                  value={form.name}
                  onChange={(event) => patchForm({ name: event.target.value })}
                  required
                />
              </Field>

              <Field label="Policy type" error={fieldErrors.policy_type}>
                <Select
                  value={form.policy_type}
                  onChange={(event) => patchForm({ policy_type: event.target.value })}
                >
                  {(options?.policy_types ?? []).map((policyType) => (
                    <option key={policyType.value} value={policyType.value}>
                      {policyType.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Status" error={fieldErrors.status}>
                <Select
                  value={form.status}
                  onChange={(event) => patchForm({ status: Number(event.target.value) })}
                >
                  <option value={1}>Active</option>
                  <option value={0}>Retired</option>
                </Select>
              </Field>
            </div>

            <Field label="Description" error={fieldErrors.description}>
              <Textarea
                value={form.description}
                onChange={(event) => patchForm({ description: event.target.value })}
                rows={4}
              />
            </Field>

            <div className="aii-form-grid">
              <Field label="Detection provider" error={fieldErrors.detection_provider}>
                <TextInput
                  value={form.detection_provider}
                  onChange={(event) => patchForm({ detection_provider: event.target.value })}
                  placeholder="Turnitin / Copyleaks"
                />
              </Field>

              <Field label="Detection threshold" error={fieldErrors.detection_threshold}>
                <TextInput
                  value={form.detection_threshold}
                  inputMode="decimal"
                  onChange={(event) => patchForm({ detection_threshold: event.target.value })}
                  placeholder="0.00"
                />
              </Field>
            </div>

            <div className="aii-form-grid">
              <div className="pol-check-card">
                <Checkbox
                  checked={form.require_disclosure === 1}
                  onChange={(event) => patchForm({ require_disclosure: event.target.checked ? 1 : 0 })}
                  label="Require disclosure"
                />
              </div>
              <div className="pol-check-card">
                <Checkbox
                  checked={form.require_acknowledgement === 1}
                  onChange={(event) => patchForm({ require_acknowledgement: event.target.checked ? 1 : 0 })}
                  label="Require acknowledgement"
                />
              </div>
              <div className="pol-check-card">
                <Checkbox
                  checked={form.ai_detection_required === 1}
                  onChange={(event) => patchForm({ ai_detection_required: event.target.checked ? 1 : 0 })}
                  label="Require AI detection"
                />
              </div>
              <div className="pol-check-card">
                <Checkbox
                  checked={form.plagiarism_check_required === 1}
                  onChange={(event) => patchForm({ plagiarism_check_required: event.target.checked ? 1 : 0 })}
                  label="Require plagiarism check"
                />
              </div>
            </div>

            <div role="group" aria-labelledby="pol-rules-title" className="pol-group">
              <div className="aii-row aii-row--between">
                <h4 id="pol-rules-title" className="pol-group-title">Rules</h4>
                <span className="aii-small aii-muted">Toggle allowed AI use categories</span>
              </div>

              <div className="aii-form-grid pol-group-body">
                {(options?.rule_catalogue ?? []).map((rule) => (
                  <div key={rule.key} className="pol-check-card pol-check-card--raised">
                    <Checkbox
                      checked={!!form.rules[rule.key]}
                      onChange={() => toggleRule(rule.key)}
                      label={rule.label}
                    />
                  </div>
                ))}
              </div>
              {fieldErrors.rules && <p className="u-error" role="alert">{fieldErrors.rules}</p>}
            </div>

            <div role="group" aria-labelledby="pol-assignments-title" className="pol-group">
              <div className="aii-row aii-row--between">
                <h4 id="pol-assignments-title" className="pol-group-title">Assignments</h4>
                <Button
                  size="sm"
                  onClick={addAssignment}
                  disabled={scopeOptions.length === 0}
                  icon={<Plus size={14} aria-hidden="true" />}
                >
                  Add scope
                </Button>
              </div>

              <div className="pol-group-body pol-assignments">
                {form.assignments.length === 0 && (
                  <p className="pol-dashed">
                    No scope-specific assignments yet. The policy will apply globally by default.
                  </p>
                )}

                {form.assignments.map((assignment, position) => (
                  <div key={position} className="pol-assignment">
                    <Select
                      aria-label={`Scope ${position + 1} type`}
                      value={assignment.scope_type}
                      onChange={(event) => updateAssignment(position, 'scope_type', event.target.value)}
                    >
                      {/* A stored scope the server no longer lists stays selectable,
                          so opening an old policy does not silently rewrite it. */}
                      {!scopeOptions.some((scope) => scope.value === assignment.scope_type) && (
                        <option value={assignment.scope_type}>{assignment.scope_type}</option>
                      )}
                      {scopeOptions.map((scope) => (
                        <option key={scope.value} value={scope.value}>
                          {scope.label}
                        </option>
                      ))}
                    </Select>

                    {/* The rows that scope can actually name, from the server.
                        A free-text id box was what this was, and an id typed by hand
                        is an assignment that silently matches nothing — the policy
                        then looks assigned and governs no one. */}
                    <ScopeTargetField
                      label={`Scope ${position + 1} target`}
                      scopeType={assignment.scope_type}
                      value={assignment.scope_id}
                      targets={options?.scope_targets ?? {}}
                      onChange={(next) => updateAssignment(position, 'scope_id', next)}
                    />

                    <Select
                      aria-label={`Scope ${position + 1} status`}
                      value={assignment.status}
                      onChange={(event) => updateAssignment(position, 'status', Number(event.target.value))}
                    >
                      <option value={1}>Active</option>
                      <option value={0}>Disabled</option>
                    </Select>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeAssignment(position)}
                      aria-label={`Remove scope ${position + 1}`}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {fieldErrors.assignments && <p className="u-error" role="alert">{fieldErrors.assignments}</p>}
              </div>
            </div>

            <div className="aii-form-actions">
              <Button onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                icon={<ShieldCheck size={16} aria-hidden="true" />}
              >
                {saving ? 'Saving…' : form.id === null ? 'Save policy' : 'Update policy'}
              </Button>
            </div>
          </form>
        </section>
      )}

      <ConfirmationDialog
        open={retiring !== null}
        onCancel={() => setRetiring(null)}
        onConfirm={() => void confirmRetire()}
        title={retiring ? `Retire the ${retiring.name} policy?` : 'Retire policy?'}
        confirmLabel="Retire"
        destructive
        loading={retireBusy}
      />
    </section>
  );
}

/**
 * The target picker for one assignment.
 *
 * A whole-organisation scope names nothing, so the field is a note rather than a
 * control. A scope the server returned no rows for is the same situation for a
 * different reason: this deployment has none of that thing, and offering an empty
 * dropdown would invite someone to assign a policy to nothing.
 */
function ScopeTargetField({
  label,
  scopeType,
  value,
  targets,
  onChange,
}: {
  label: string;
  scopeType: string;
  value: string;
  targets: Record<string, AiPolicyScopeTarget[]>;
  onChange: (next: string) => void;
}) {
  const options = targets[scopeType] ?? [];

  if (WHOLE_ORGANISATION_SCOPES.has(scopeType) && options.length === 0) {
    return <span className="pol-scope-note">Applies to the whole organisation.</span>;
  }

  if (options.length === 0) {
    return <span className="pol-scope-note">Nothing of this kind exists here yet.</span>;
  }

  return (
    <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose…</option>
      {options.map((target) => (
        <option key={target.id} value={String(target.id)}>
          {target.label}
        </option>
      ))}
    </Select>
  );
}

/** A policy type's label, falling back to its stored value when the list has moved on. */
function policyTypeLabel(options: AiPolicyOptions | null, value: string): string {
  return options?.policy_types.find((type) => type.value === value)?.label ?? value;
}
