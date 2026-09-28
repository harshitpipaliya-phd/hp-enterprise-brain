import { useEffect, useState } from 'react';
import { BriefcaseBusiness, Building2, Contact, Plus, ShieldCheck, UserCheck, X } from 'lucide-react';
import type { Person } from './PersonApp';
import { api } from '../../api/person';
import { api as departmentApi } from '../../api/department';
import './PersonList.css';

interface Props {
  tenantId: string;
  orgId: string;
  organizationName: string;
  onCreated: (person: Person) => void;
  onCancel: () => void;
}

export default function PersonCreate({ tenantId, orgId, organizationName, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({
    employeeId: '',
    userName: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    departmentId: '',
    roleId: '',
    designation: '',
    joiningDate: '',
    employmentStatus: '1',
  });

  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Quick Add Department Modal state
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });
  const [savingDept, setSavingDept] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [deptSuccessNotice, setDeptSuccessNotice] = useState<string | null>(null);

  const loadOptions = async (selectDeptId?: string) => {
    try {
      const options = await api.getOptions(tenantId);
      const depts = options.departments || [];
      const roleList = options.roles || [];
      setDepartments(depts);
      setRoles(roleList);

      setForm((prev) => {
        let updated = { ...prev };
        if (selectDeptId) {
          updated.departmentId = selectDeptId;
        }
        if (!updated.roleId && roleList.length > 0) {
          const empRole = roleList.find((r) => r.name.toLowerCase().includes('employee')) || roleList[0];
          updated.roleId = empRole.id;
        }
        return updated;
      });
    } catch (e: any) {
      console.error('Failed to load options:', e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingReferences(true);
    loadOptions().finally(() => {
      if (!cancelled) setLoadingReferences(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, orgId]);

  const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name.trim()) return;

    setDeptError(null);
    setSavingDept(true);
    try {
      const newDept = await departmentApi.createDepartment(tenantId, {
        name: deptForm.name.trim(),
        description: deptForm.description.trim() || null,
      });

      setShowDeptModal(false);
      setDeptForm({ name: '', description: '' });
      setDeptSuccessNotice(`Department "${newDept.name}" created and selected.`);
      await loadOptions(String(newDept.id));
    } catch (err: any) {
      setDeptError(err.message || 'Unable to create the department.');
    } finally {
      setSavingDept(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.employeeId.trim()) {
      setError('Employee ID is required.');
      return;
    }
    if (!form.firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!form.lastName.trim()) {
      setError('Last name is required.');
      return;
    }
    if (!form.email.trim()) {
      setError('Work email is required.');
      return;
    }

    setSaving(true);
    try {
      const person = await api.createPerson(tenantId, {
        employeeId: form.employeeId.trim(),
        userName: form.userName.trim() || form.employeeId.trim(),
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        gender: form.gender || null,
        birthDate: form.dateOfBirth || null,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        roleId: form.roleId ? Number(form.roleId) : null,
        designation: form.designation.trim() || null,
        joiningDate: form.joiningDate || null,
        status: Number(form.employmentStatus),
      });

      onCreated(person);
    } catch (e: any) {
      setError(e.message || 'Unable to create this person.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="people-create">
      <form className="people-create__layout" onSubmit={submit}>
        <div className="people-create__form">
          {error && (
            <div className="people-alert" role="alert">
              {error}
            </div>
          )}

          {deptSuccessNotice && (
            <div className="people-success-banner" role="status">
              {deptSuccessNotice}
            </div>
          )}

          <Section
            icon={<Contact size={18} />}
            title="Personal information"
            description="Core personal and contact details used across the organization."
          >
            <Field label="First name" required>
              <input
                required
                autoFocus
                value={form.firstName}
                onChange={(e) => update({ firstName: e.target.value })}
                placeholder="e.g. Jane"
              />
            </Field>

            <Field label="Middle name">
              <input
                value={form.middleName}
                onChange={(e) => update({ middleName: e.target.value })}
                placeholder="Optional"
              />
            </Field>

            <Field label="Last name" required>
              <input
                required
                value={form.lastName}
                onChange={(e) => update({ lastName: e.target.value })}
                placeholder="e.g. Doe"
              />
            </Field>

            <Field label="Work email" required>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => update({ email: e.target.value })}
                placeholder="jane.doe@organization.org"
              />
            </Field>

            <Field label="Phone / Contact number">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update({ phone: e.target.value })}
                placeholder="e.g. +1 555-0199"
              />
            </Field>

            <Field label="Gender">
              <select value={form.gender} onChange={(e) => update({ gender: e.target.value })}>
                <option value="">Not specified</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <Field label="Date of birth">
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => update({ dateOfBirth: e.target.value })}
              />
            </Field>
          </Section>

          <Section
            icon={<BriefcaseBusiness size={18} />}
            title="Organization & Department"
            description="Assign the person to a department and define their role in the organization."
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="people-dept-header-row">
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--content-secondary)' }}>
                  Department
                </span>
                <button
                  type="button"
                  className="people-dept-add-link"
                  onClick={() => setShowDeptModal(true)}
                >
                  <Plus size={13} aria-hidden="true" /> Add Department
                </button>
              </div>

              {departments.length === 0 ? (
                <div className="people-dept-empty-box">
                  <p>
                    No active departments found for this organization. You can create one now without losing your entered person details.
                  </p>
                  <button
                    type="button"
                    className="u-btn u-btn-primary"
                    style={{ fontSize: 13, padding: '6px 12px', whiteSpace: 'nowrap' }}
                    onClick={() => setShowDeptModal(true)}
                  >
                    <Plus size={14} aria-hidden="true" /> Add Department
                  </button>
                </div>
              ) : (
                <Field label="" required={false}>
                  <select
                    value={form.departmentId}
                    disabled={loadingReferences}
                    onChange={(e) => update({ departmentId: e.target.value })}
                  >
                    <option value="">Select a department…</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.code ? `(${d.code})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            <Field label="System Role / Profile" required>
              <select
                value={form.roleId}
                disabled={loadingReferences || roles.length === 0}
                onChange={(e) => update({ roleId: e.target.value })}
              >
                {roles.length === 0 && <option value="">Default Profile (Employee)</option>}
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Designation / Job title">
              <input
                value={form.designation}
                onChange={(e) => update({ designation: e.target.value })}
                placeholder="e.g. Senior Teacher, Operations Lead"
              />
            </Field>
          </Section>

          <Section
            icon={<UserCheck size={18} />}
            title="Employment & Account details"
            description="System identification, joining timeline, and account status."
          >
            <Field label="Employee ID" required>
              <input
                required
                value={form.employeeId}
                onChange={(e) => update({ employeeId: e.target.value })}
                placeholder="e.g. EMP-1042"
              />
            </Field>

            <Field label="System Username">
              <input
                value={form.userName}
                onChange={(e) => update({ userName: e.target.value })}
                placeholder={form.employeeId ? `Default: ${form.employeeId}` : 'e.g. jdoe'}
              />
            </Field>

            <Field label="Joining date">
              <input
                type="date"
                value={form.joiningDate}
                onChange={(e) => update({ joiningDate: e.target.value })}
              />
            </Field>

            <Field label="Employment status">
              <select
                value={form.employmentStatus}
                onChange={(e) => update({ employmentStatus: e.target.value })}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </Field>
          </Section>

          <footer className="people-create__footer">
            <button
              type="button"
              className="eb-pill-btn"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="u-btn u-btn-primary"
              disabled={saving || !form.employeeId.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
            >
              {saving ? 'Saving Person…' : 'Save Person'}
            </button>
          </footer>
        </div>

        <aside className="people-create__aside">
          <section>
            <Building2 size={18} />
            <div>
              <h3>Organization-scoped</h3>
              <p>This person is created directly under {organizationName} with verified tenant isolation.</p>
            </div>
          </section>
          <section>
            <ShieldCheck size={18} />
            <div>
              <h3>Secure credentials</h3>
              <p>A secure temporary password will be generated upon creation for initial access.</p>
            </div>
          </section>
        </aside>
      </form>

      {/* Quick Add Department Modal */}
      {showDeptModal && (
        <div className="people-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dept-modal-title">
          <div className="people-modal-card">
            <div className="people-modal-header">
              <h3 id="dept-modal-title">Add Department</h3>
              <button
                type="button"
                className="people-modal-close"
                onClick={() => {
                  setShowDeptModal(false);
                  setDeptError(null);
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDepartment}>
              <div className="people-modal-body">
                {deptError && <div className="people-alert" role="alert">{deptError}</div>}
                
                <label className="people-create__field">
                  <span>Department name <b>Required</b></span>
                  <input
                    autoFocus
                    required
                    maxLength={255}
                    placeholder="e.g. Science & Mathematics"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </label>

                <label className="people-create__field">
                  <span>Purpose and responsibilities</span>
                  <textarea
                    rows={3}
                    placeholder="Describe the department's responsibilities or services."
                    value={deptForm.description}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 10px',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-xs)',
                      background: 'var(--surface-ground)',
                      color: 'var(--content-primary)',
                      font: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </label>
              </div>

              <div className="people-modal-footer">
                <button
                  type="button"
                  className="eb-pill-btn"
                  disabled={savingDept}
                  onClick={() => {
                    setShowDeptModal(false);
                    setDeptError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="u-btn u-btn-primary"
                  disabled={savingDept || !deptForm.name.trim()}
                >
                  {savingDept ? 'Creating…' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="people-create__section">
      <header>
        <span>{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </header>
      <div className="people-create__fields">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="people-create__field">
      {label ? (
        <span>
          {label}
          {required && <b>Required</b>}
        </span>
      ) : null}
      {children}
    </label>
  );
}
