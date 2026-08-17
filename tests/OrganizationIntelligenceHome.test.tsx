import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OrganizationIntelligenceHome from '../src/components/workspace/OrganizationIntelligenceHome';

const getHomeMetrics = vi.fn();

vi.mock('../src/api/intelligence', () => ({
  api: {
    getHomeMetrics: (...args: unknown[]) => getHomeMetrics(...args),
  },
}));

const organization = {
  id: 'org-1000000',
  tenantId: '1000000',
  name: 'Sunrise International School',
  logo: '',
  status: 'active',
};

describe('Organization intelligence home', () => {
  beforeEach(() => {
    getHomeMetrics.mockReset().mockResolvedValue({
      tenantId: '1000000',
      erp: {
        activePeople: 0,
        activeDepartments: 0,
        peopleWithoutDepartment: 0,
        departmentsWithoutManager: 0,
        peopleWithoutProfile: 0,
      },
      intelligence: {
        openSignals: 2,
        highSignals: 0,
        pendingRecommendations: 0,
        openDecisions: 0,
      },
      pipeline: {
        stage: 'cases_opened',
        blocker: 'Cases exist; hypothesis and recommendation generation are intentionally not started from this product workflow.',
        nextAction: 'Review the cases and cited evidence in the Deliberation workspace.',
        counts: {
          operationalRecords: 15000,
          signals: 2,
          firedRuleKeys: 2,
          cases: 2,
          hypotheses: 0,
          recommendations: 0,
          decisions: 0,
          executions: 0,
          outcomes: 0,
          learnings: 0,
        },
        review: {
          firedRuleKeys: 2,
          approvedRuleKeys: 0,
          unclassifiedRuleKeys: 2,
          unclassified: ['fee_collector_concentration', 'people_without_department'],
        },
      },
      domainIntelligence: {
        fees: {
          dataset: 'school_fee',
          availability: {
            dueDate: false,
            reminderHistory: false,
            attendance: true,
            academicPerformance: true,
            paymentMethod: true,
          },
          overview: {
            records: 15000,
            students: 5000,
            departments: 3,
            classes: 12,
            sections: 42,
            totalBilled: 109455700,
            totalConcession: 0,
            totalNet: 109455700,
            totalCollected: 92382000,
            totalOutstanding: 17073700,
            collectionRate: 0.844,
            defaulters: 1250,
            criticalRiskStudents: 200,
            averagePaymentDelayDays: null,
          },
          analytics: {
            byDepartment: [{ name: 'Secondary School', records: 9000, net: 70000000, collected: 56000000, outstanding: 14000000, collectionRate: 0.8 }],
            byClass: [{ name: 'Grade 7', records: 1200, net: 12000000, collected: 9000000, outstanding: 3000000, collectionRate: 0.75 }],
            byFeeType: [{ name: 'Tuition Fee', records: 8000, net: 80000000, collected: 70000000, outstanding: 10000000, collectionRate: 0.875 }],
            byPaymentMethod: [{ name: 'UPI', records: 5000, net: 40000000, collected: 36000000, outstanding: 4000000, collectionRate: 0.9 }],
            byScholarship: [{ name: 'Merit', records: 727, net: 4400000, collected: 3340000, outstanding: 1060000, collectionRate: 0.759 }],
            riskLevelRows: [{ name: 'High', count: 6, share: 0.0004 }, { name: 'Medium', count: 4335, share: 0.289 }],
            riskLevelStudents: [{ name: 'High', count: 6, share: 0.0019 }, { name: 'Medium', count: 2403, share: 0.757 }],
          },
          priorityRecovery: [{
            studentRef: 'SIS10632',
            className: 'Grade 6',
            section: 'A',
            outstanding: 22900,
            collectionRate: 0.5138,
            riskScore: 95,
            riskBand: 'Critical',
            sourceRiskLevel: 'High',
            riskFactors: ['Outstanding amount is at least INR 20,000.', 'Exam average is below 60%.'],
            recommendedAction: 'Escalate to Accounts Team with source receipts attached.',
          }],
          defaulters: [{
            studentRef: 'SIS11308',
            className: 'Grade 12',
            section: 'A',
            outstanding: 18000,
            collectionRate: 0.2167,
            overdueRecords: 1,
            partialRecords: 1,
            averageAttendancePct: 72,
            averageExamPct: 58,
            daysOverdue: null,
            riskScore: 55,
            riskBand: 'Orange',
            sourceRiskLevel: 'Medium',
            riskFactors: ['Outstanding amount is at least INR 10,000.', 'Attendance is below 75%.'],
            recommendedAction: 'Schedule targeted follow-up before escalation.',
          }],
          dataQuality: {
            missingStudentRef: 0,
            negativeOutstanding: 0,
            paidWithOutstandingMismatch: 0,
            duplicateReceipts: 0,
          },
          trace: { table: 'hpbrain_operational_records', dataset: 'school_fee', recordCount: 15000 },
        },
      },
      attention: [],
      dataFreshness: { erp: 'live', brain: '2026-08-13 12:00:00' },
    });
  });

  it('shows the real pipeline blocker inside the existing organization home', async () => {
    render(<OrganizationIntelligenceHome organization={organization as any} onNavigate={vi.fn()} />);

    expect(await screen.findByText('Enterprise Brain Pipeline')).toBeInTheDocument();
    expect(screen.getByText('15,000')).toBeInTheDocument();
    expect(screen.getByText('Current stage: cases opened')).toBeInTheDocument();
    expect(screen.getByText('Cases exist; hypothesis and recommendation generation are intentionally not started from this product workflow.')).toBeInTheDocument();
    expect(screen.getByText('Unclassified rule keys: fee_collector_concentration, people_without_department')).toBeInTheDocument();
    expect(screen.getByText('School Fee Intelligence')).toBeInTheDocument();
    expect(screen.getByText('INR 109,455,700')).toBeInTheDocument();
    expect(screen.getByText('INR 17,073,700')).toBeInTheDocument();
    expect(screen.getByText('Secondary School')).toBeInTheDocument();
    expect(screen.getByText('Merit')).toBeInTheDocument();
    expect(screen.getByText('Student Risk Bands')).toBeInTheDocument();
    expect(screen.getByText('Priority recovery queue')).toBeInTheDocument();
    expect(screen.getByText('SIS10632')).toBeInTheDocument();
    expect(screen.getByText('Source: hpbrain_operational_records / school_fee, 15,000 records. Due dates are not present, so days overdue is not calculated. Reminder history is not present, so reminder recommendations are not generated.')).toBeInTheDocument();
  });
});
