import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ExecutionCenter from '../src/components/workspace/ExecutionCenter';

const getExecutionOverview = vi.fn();
const definitions = vi.fn();
const createMeasurementPlan = vi.fn();
const createExecution = vi.fn();
const transition = vi.fn();
const rollback = vi.fn();
const captureOutcome = vi.fn();

vi.mock('../src/api/intelligence', () => ({
  api: {
    captureOutcome: (...args: unknown[]) => captureOutcome(...args),
  },
  decisionIntelligenceApi: {
    getExecutionOverview: (...args: unknown[]) => getExecutionOverview(...args),
  },
}));

vi.mock('../src/api/eso', () => ({
  esoApi: {
    definitions: (...args: unknown[]) => definitions(...args),
    createMeasurementPlan: (...args: unknown[]) => createMeasurementPlan(...args),
    create: (...args: unknown[]) => createExecution(...args),
    transition: (...args: unknown[]) => transition(...args),
    rollback: (...args: unknown[]) => rollback(...args),
  },
}));

const baseOverview = {
  organization: { name: 'Lions' },
  summary: {
    approvedDecisions: 1,
    queuedExecutions: 0,
    runningExecutions: 0,
    completedExecutions: 1,
    failedExecutions: 0,
    rolledBackExecutions: 0,
    outcomeMeasurementRate: null,
    successRate: null,
  },
  pipeline: [
    { label: 'Approved', count: 1 },
    { label: 'Queued', count: 0 },
    { label: 'Running', count: 0 },
    { label: 'Completed', count: 1 },
    { label: 'Outcome Measured', count: 0 },
  ],
  executionQueue: {
    total: 1,
    items: [{
      id: 'decision-1',
      decision: 'Run targeted fee collection follow-up',
      caseId: 'case-12345678',
      recommendationId: 'recommendation-1',
      owner: 'manager',
      recommendation: {
        id: 'recommendation-1',
        title: 'Run targeted fee collection follow-up',
        priority: 'high',
        confidence: 0.91,
        esoId: 'eso-1',
        citationEvidenceIds: ['evidence-1'],
      },
    }],
  },
  activeExecutions: {
    items: [{
      id: 'execution-1',
      decisionId: 'decision-1',
      execution: 'execution-1',
      decision: 'Run targeted fee collection follow-up',
      owner: 'manager',
      status: 'completed',
      progress: 1,
      started: '2026-08-13 10:00:00',
      durationDays: 0,
      risk: 'normal',
      outcomeStatus: 'Outcome not measured',
      outcome: null,
      citationEvidenceIds: ['evidence-1'],
    }],
    total: 1,
  },
  bottlenecks: { primary: { label: 'Completed executions without outcomes', count: 1 }, items: [] },
  predictedVsRealized: { items: [] },
  funnel: [],
  outcomeLoop: [],
};

describe('Execution Center Step 6 flow', () => {
  beforeEach(() => {
    getExecutionOverview.mockReset().mockResolvedValue(baseOverview);
    definitions.mockReset().mockResolvedValue({
      definitions: [{ id: 'eso-1', name: 'Targeted fee collection follow-up', esoCode: 'ESO-FEE' }],
    });
    createMeasurementPlan.mockReset().mockResolvedValue({ id: 'plan-1' });
    createExecution.mockReset().mockResolvedValue({ id: 'execution-2' });
    transition.mockReset().mockResolvedValue({});
    rollback.mockReset().mockResolvedValue({});
    captureOutcome.mockReset().mockResolvedValue({ id: 'outcome-1' });
  });

  it('creates a measurement plan before starting a governed execution', async () => {
    render(<ExecutionCenter tenantId="8" />);

    await screen.findByText('Approved decisions waiting for action');
    fireEvent.change(screen.getAllByPlaceholderText('collection rate')[0], {
      target: { value: 'collection_rate' },
    });
    fireEvent.change(screen.getByDisplayValue('14'), {
      target: { value: '21' },
    });
    fireEvent.click(screen.getByText('Plan and start'));

    await waitFor(() => expect(createMeasurementPlan).toHaveBeenCalledWith({
      decisionId: 'decision-1',
      baselineMetric: 'collection_rate',
      baselineValue: undefined,
      targetValue: undefined,
      metricUnit: undefined,
      measurementWindowDays: 21,
    }));
    expect(createExecution).toHaveBeenCalledWith({
      decisionId: 'decision-1',
      esoDefinitionId: 'eso-1',
      executorType: 'human',
    });
  });

  it('records a completed execution outcome with cited evidence', async () => {
    render(<ExecutionCenter tenantId="8" />);

    await screen.findByText('execution-1');
    fireEvent.change(screen.getAllByPlaceholderText('collection rate')[1], {
      target: { value: 'collection_rate' },
    });
    fireEvent.change(screen.getByDisplayValue('0.7'), {
      target: { value: '0.82' },
    });
    fireEvent.change(screen.getAllByRole('spinbutton', { name: /Value/i })[2], {
      target: { value: '0.74' },
    });
    fireEvent.click(screen.getByText('Record outcome'));

    await waitFor(() => expect(captureOutcome).toHaveBeenCalledWith({
      tenantId: '8',
      decisionId: 'decision-1',
      result: 'partial',
      metrics: { collection_rate: 0.74 },
      evidenceIds: ['evidence-1'],
      feedback: undefined,
      confidence: 0.82,
    }));
  });
});
