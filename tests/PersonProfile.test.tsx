import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import PersonIntelligence from '../src/components/workspace/PersonIntelligence';

/**
 * The person profile screen.
 *
 * The assertions here are almost all about ABSENCE, because that is what the
 * screen got wrong before. It rendered a fixed set of tiles and panels whose
 * values were `—` or `0` for every real tenant, and printed the API's own key
 * names into the empty states ("capabilityScores[] is empty"). So: with a person
 * the installation knows nothing about, nothing must claim a measured zero and
 * no response key may appear in the DOM; with a person it knows a lot about,
 * every figure on screen must be one the API sent.
 */

const getProfile = vi.fn();

vi.mock('../src/api/person', () => ({
  api: {
    getProfile: (...args: unknown[]) => getProfile(...args),
  },
}));

/** A student with fee records, as the school tenant actually stores them. */
function studentProfile(over: Record<string, unknown> = {}) {
  return {
    person: {
      id: '592', externalRef: 'STU-00001', firstName: 'Aanya', lastName: 'Sharma',
      displayName: 'Aanya Sharma', email: 'guardian@school.test', phone: '9000000001',
      gender: null, role: 'Student', jobTitle: null,
      departmentId: '1982', departmentName: 'Grade 12 A', joinedDate: null,
      status: 'active', createdDate: '2026-08-13 11:49:38', updatedDate: '2026-08-13 11:54:02',
      mappedFields: ['id', 'externalRef', 'firstName', 'lastName', 'email'],
    },
    organization: { id: '1000000', name: 'Sunrise International School', code: '76', industry: 'Education' },
    linkage: {
      available: true,
      rules: [{ column: 'subject_ref', label: 'Record subject', value: 'STU-00001', basis: 'exact match', records: 12 }],
      matched: [{ column: 'subject_ref', label: 'Record subject', value: 'STU-00001', basis: 'exact match', records: 12 }],
      records: 12,
      datasets: [{ dataset: 'school_fee', label: 'School fee', records: 12, firstSeen: '2025-07-10 00:00:00', lastSeen: '2026-06-10 00:00:00' }],
    },
    academic: {
      studentRef: 'STU-00001', admissionNo: 'ADM-2021-00001', class: '12', section: 'A',
      academicYear: '2025-26', campus: 'Main Campus', attendancePct: 95.2, examAveragePct: 66.8,
      classesOnRecord: 1, sectionsOnRecord: 1,
    },
    contacts: {
      guardians: [{
        firstName: 'Guardian 0001', lastName: null, relationship: 'Guardian',
        email: 'guardian@school.test', phone: '9000000001', isPrimaryContact: true, origin: 'fee_record',
      }],
    },
    finance: {
      currency: 'INR', records: 12, covered: 12, partial: false,
      billed: 220176, concession: 19020, net: 201156, paid: 186692,
      outstanding: 14464, overdue: 13575, collectedPct: 92.8,
      statusCounts: [{ name: 'Paid', count: 11 }, { name: 'Partially Paid', count: 1 }],
      components: [{ name: 'Tuition + Transport', net: 201156 }],
      methods: [{ name: 'Cash', count: 4 }],
      lastPayment: { date: '2026-06-12', amount: 16563, method: 'Cheque' },
      nextDueDate: '2025-07-10',
      invoices: [{
        reference: 'INV-202606-00001', period: '2026-06', component: 'Tuition + Transport',
        dueDate: '2026-06-10', net: 16763, paid: 16563, outstanding: 200,
        status: 'Paid', daysOverdue: 2, method: 'Cheque', paymentDate: '2026-06-12',
      }],
    },
    activity: {
      available: true,
      datasets: [{ dataset: 'school_fee', label: 'School fee', records: 12, firstSeen: '2025-07-10 00:00:00', lastSeen: '2026-06-10 00:00:00' }],
      records: [{
        id: 'r1', dataset: 'school_fee', datasetLabel: 'School fee', reference: 'INV-202606-00001',
        occurredAt: '2026-06-10 00:00:00', closedAt: null, status: 'Paid',
        category: 'Tuition + Transport', subCategory: 'Economy', amount: 16763, currency: 'INR',
        quantity: null, location: 'Grade 12 A', linkedBy: ['Record subject'],
        source: { file: 'fees.csv', row: 11, importJobId: 'job-1', importedAt: '2026-08-13 11:50:02' },
        detail: [{ label: 'Net fee amount', value: '16763' }],
      }],
      total: 12, shown: 12,
    },
    intelligence: emptyIntelligence(),
    timeline: {
      events: [{ at: '2026-06-10 00:00:00', kind: 'operational', title: 'Tuition + Transport', detail: 'Paid', source: 'School fee' }],
      total: 14, bounded: false,
    },
    audit: [],
    ...over,
  };
}

function emptyIntelligence() {
  return {
    capabilities: [],
    decisions: { total: 0, approved: 0, items: [] },
    executions: [],
    executionSuccessCount: 0,
    learnings: 0,
    signals: [],
    signalCount: 0,
    evidenceCount: 0,
    cases: [],
    score: { score: null, breakdown: { capabilityScore: null, decisionQuality: null, executionSuccess: null } },
  };
}

/** Someone the installation has an ERP row for and nothing else. */
function bareProfile() {
  return {
    person: {
      id: '591', externalRef: null, firstName: 'Priya', lastName: 'Nair',
      displayName: 'Priya Nair', email: null, phone: null, gender: null,
      role: 'Admin', jobTitle: null, departmentId: null, departmentName: null,
      joinedDate: null, status: 'active', createdDate: '2026-08-13 07:29:55',
      updatedDate: '2026-08-13 07:29:55', mappedFields: ['id', 'firstName'],
    },
    organization: { id: '1000000', name: 'Sunrise International School', code: '76', industry: 'Education' },
    linkage: { available: true, rules: [], matched: [], records: 0, datasets: [] },
    academic: null,
    contacts: { guardians: [] },
    finance: null,
    activity: { available: true, datasets: [], records: [], total: 0, shown: 0 },
    intelligence: emptyIntelligence(),
    timeline: { events: [], total: 0, bounded: false },
    audit: [],
  };
}

async function renderProfile(payload: unknown, props: Record<string, unknown> = {}) {
  getProfile.mockResolvedValue(payload);
  await act(async () => {
    render(<PersonIntelligence tenantId="1000000" personId="592" {...props} />);
  });
  await waitFor(() => expect(getProfile).toHaveBeenCalled());
}

describe('Person profile', () => {
  beforeEach(() => { getProfile.mockReset(); });

  it('reads the person from the tenant and person it was given', async () => {
    await renderProfile(studentProfile());
    expect(getProfile).toHaveBeenCalledWith('1000000', '592');
  });

  it('shows the person, their role, class section and organization', async () => {
    await renderProfile(studentProfile());

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Aanya Sharma');
    // getAllByText throughout: these values are shown as a header badge AND in
    // the profile field list, which is deliberate, so uniqueness is not the
    // property under test.
    expect(screen.getAllByText('Student').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Grade 12 A').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sunrise International School/).length).toBeGreaterThan(0);
  });

  it('shows only the figures the API sent, in the currency the record used', async () => {
    await renderProfile(studentProfile());

    // Outstanding, from finance.outstanding — formatted, never recomputed.
    expect(screen.getAllByText(/14,464/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('92.8%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('95.2%').length).toBeGreaterThan(0);
    // And nothing the API did not send: 201156 - 186692 is 14464, but a screen
    // that derived it would also happily derive a figure the engine disagrees
    // with. Only the sent value appears.
    expect(screen.queryByText(/220,176/)).toBeNull();
  });

  /**
   * THE REGRESSION THIS FILE EXISTS FOR. Response key names must never reach the
   * DOM, in an empty state or anywhere else.
   */
  it('never prints an API key name or a bare em-dash tile', async () => {
    await renderProfile(bareProfile());

    const body = document.body.textContent ?? '';

    for (const leak of ['capabilityScores', 'executionHistory', 'recentActivity', 'individualScore', 'twin', '[]']) {
      expect(body).not.toContain(leak);
    }
  });

  it('says nothing has been recorded rather than showing a zero, for a person with no data', async () => {
    await renderProfile(bareProfile());

    expect(screen.getByText(/Nothing measurable has been recorded for Priya Nair yet/)).toBeTruthy();
    // No fee tab at all: a fees section that can only ever be empty is noise.
    expect(screen.queryByRole('tab', { name: /Fees/ })).toBeNull();
  });

  it('omits profile fields the source system does not hold', async () => {
    await renderProfile(bareProfile());

    // The bare person has no email, phone, reference or department.
    expect(screen.queryByText('Email')).toBeNull();
    expect(screen.queryByText('Reference')).toBeNull();
    expect(screen.queryByText('Department')).toBeNull();
    // What it does hold is still shown.
    expect(screen.getByText('Full name')).toBeTruthy();
  });

  it('offers a fees tab only when fee records exist', async () => {
    await renderProfile(studentProfile());
    expect(screen.getByRole('tab', { name: /Fees & payments/ })).toBeTruthy();
  });

  it('explains what would fill the intelligence section rather than showing empty counters', async () => {
    await renderProfile(bareProfile());

    act(() => { screen.getByRole('tab', { name: /Intelligence/ }).click(); });

    expect(screen.getByText(/No intelligence has been generated for Priya Nair yet/)).toBeTruthy();
    expect(screen.getByText(/when a capability is assigned to them and assessed/)).toBeTruthy();
  });

  it('renders each attachment rule so a reader can see why a record is here', async () => {
    await renderProfile(studentProfile());

    expect(screen.getByText('Record subject')).toBeTruthy();
    expect(screen.getAllByText('STU-00001').length).toBeGreaterThan(0);
    expect(screen.getByText('exact match')).toBeTruthy();
  });

  it('only offers actions it was given a handler for', async () => {
    await renderProfile(studentProfile());
    expect(screen.queryByRole('button', { name: /Edit contact details/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Archive/ })).toBeNull();

    getProfile.mockReset();
    const onEdit = vi.fn();
    await renderProfile(studentProfile(), { onEdit, onArchive: vi.fn(), onBack: vi.fn(), backLabel: 'Back to People' });

    expect(screen.getByRole('button', { name: '← Back to People' })).toBeTruthy();
    act(() => { screen.getByRole('button', { name: /Edit contact details/ }).click(); });
    expect(onEdit).toHaveBeenCalled();
  });

  it('re-reads the person when Refresh is pressed', async () => {
    await renderProfile(studentProfile());
    expect(getProfile).toHaveBeenCalledTimes(1);

    await act(async () => { screen.getByRole('button', { name: 'Refresh' }).click(); });

    expect(getProfile).toHaveBeenCalledTimes(2);
  });

  it('surfaces a load failure instead of rendering an empty person', async () => {
    getProfile.mockRejectedValue(new Error('network down'));
    await act(async () => {
      render(<PersonIntelligence tenantId="1000000" personId="592" />);
    });
    await waitFor(() => expect(screen.getByText(/network down/)).toBeTruthy());
  });
});
