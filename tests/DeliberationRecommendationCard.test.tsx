import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeliberationWorkspace from '../src/components/workspace/DeliberationWorkspace';

/**
 * The Fee Intelligence card on the Deliberation screen, rendered against
 * RESPONSES CAPTURED FROM THE RUNNING BACKEND — following the convention
 * OrganizationIntelligenceScreens.test.tsx set, and for the same reason.
 *
 * WHAT THE FIXTURES ARE. tenant8-deliberation-overview.json is the real
 * GET /analytics/8/deliberation-overview for Lions, captured after RECOMMEND
 * ran for real against the fee cases. The recommendation it carries was written
 * by RecommendVerb from a live DeepSeek call over five real fee-ledger evidence
 * rows — not composed for this test.
 *
 * WHY THAT MATTERS HERE MORE THAN USUAL. This screen showed no model-authored
 * recommendation at all until the case-linkage fix, because RecommendVerb
 * writes a null reasoning_step_id. A hand-written fixture would have been
 * written to the shape the author expected and would have passed against the
 * broken grouping too. This one only contains a recommendation under a case
 * because the real backend really placed it there.
 *
 * The assertions are about the five fields the card contracts to show, and
 * about the citation being fetched only when a reader asks for it.
 */

const overview = JSON.parse(JSON.stringify(require('./fixtures/tenant8-deliberation-overview.json')));
const caseContext = JSON.parse(JSON.stringify(require('./fixtures/tenant8-recommendation-case-context.json')));

/** The real fee case the capture selected, and its real recommendation. */
const CASE_ID = '4ea40c6c-de38-4c88-aa2f-4aad985b059b';
const recommendation = overview.cases.detailsById[CASE_ID].recommendations[0];

const getDeliberationOverview = vi.fn();
const getRecommendationCaseContext = vi.fn();
const proposeRecommendationDecision = vi.fn();
const approveDecision = vi.fn();
const rejectDecision = vi.fn();

vi.mock('../src/api/intelligence', () => ({
  decisionIntelligenceApi: {
    getDeliberationOverview: (...args: unknown[]) => getDeliberationOverview(...args),
    getRecommendationCaseContext: (...args: unknown[]) => getRecommendationCaseContext(...args),
    proposeRecommendationDecision: (...args: unknown[]) => proposeRecommendationDecision(...args),
    approveDecision: (...args: unknown[]) => approveDecision(...args),
    rejectDecision: (...args: unknown[]) => rejectDecision(...args),
  },
}));

/**
 * Queries are scoped to the Fee Intelligence block on purpose. The
 * recommendation's title legitimately appears twice on this screen — once as a
 * Recommendation entry in the case timeline, which predates this work, and once
 * on the card. An unscoped getByText would be ambiguous, and resolving that by
 * asserting on the first match would silently start testing the timeline.
 */
async function card(): Promise<ReturnType<typeof within>> {
  await screen.findByText('Recommended action');
  const block = document.querySelector('.intel-reco-block');
  expect(block, 'the Fee Intelligence block should be rendered').not.toBeNull();
  return within(block as HTMLElement);
}

describe('Deliberation workspace — Fee Intelligence card', () => {
  beforeEach(() => {
    getDeliberationOverview.mockReset().mockResolvedValue(overview);
    getRecommendationCaseContext.mockReset().mockResolvedValue(caseContext);
    proposeRecommendationDecision.mockReset().mockResolvedValue({
      id: 'decision-from-real-rec',
      status: 'proposed',
    });
    approveDecision.mockReset().mockResolvedValue({
      id: 'decision-from-real-rec',
      status: 'approved',
    });
    rejectDecision.mockReset().mockResolvedValue({
      id: 'decision-from-real-rec',
      status: 'rejected',
    });
  });

  it('renders the real recommendation with the fields the card contracts to show', async () => {
    render(<DeliberationWorkspace tenantId="8" />);

    const feeCard = await card();

    // The title, verbatim from what the model wrote and the verb stored.
    expect(feeCard.getByText('Multiple fee receipts lack collector information')).toBeInTheDocument();
    expect(feeCard.getByText(recommendation.category)).toBeInTheDocument();   // investigate
    expect(feeCard.getByText(recommendation.priority)).toBeInTheDocument();   // medium
    expect(feeCard.getByText(recommendation.status)).toBeInTheDocument();     // pending
    expect(feeCard.getByText('Confidence: 95%')).toBeInTheDocument();         // 0.95, formatted

    // These are the real values, asserted literally so a fixture recapture that
    // changed them cannot pass silently.
    expect(recommendation.category).toBe('investigate');
    expect(recommendation.priority).toBe('medium');
    expect(recommendation.status).toBe('pending');
    expect(recommendation.confidence).toBe(0.95);
  });

  it('shows the model rationale stored with the recommendation', async () => {
    render(<DeliberationWorkspace tenantId="8" />);

    await screen.findByText('Recommended action');
    expect(screen.getAllByText(recommendation.description).length).toBeGreaterThan(0);
    expect(recommendation.description).toContain('no collector recorded');
  });

  it('does not fetch the citation until the reader asks for it', async () => {
    render(<DeliberationWorkspace tenantId="8" />);

    await card();

    expect(getRecommendationCaseContext).not.toHaveBeenCalled();
  });

  it('fetches and shows the real cited evidence when the card is opened', async () => {
    render(<DeliberationWorkspace tenantId="8" />);

    const feeCard = await card();
    fireEvent.click(feeCard.getByText('Multiple fee receipts lack collector information'));

    await waitFor(() => expect(getRecommendationCaseContext).toHaveBeenCalledWith('8', recommendation.id));

    // Five real fee-ledger evidence rows, listed by the ids the recommendation
    // actually cited.
    expect(caseContext.groundedOn).toHaveLength(5);
    expect(await feeCard.findByText(`Cited evidence: ${caseContext.groundedOn.length}`)).toBeInTheDocument();

    for (const evidenceId of caseContext.groundedOn) {
      expect(feeCard.getByText(evidenceId)).toBeInTheDocument();
    }

    // The provenance path, verbatim from the endpoint — the reader can see how
    // the recommendation was tied to this case rather than taking it on trust.
    expect(feeCard.getByText(caseContext.resolution.via)).toBeInTheDocument();
  });

  it('records a real recommendation decision through the API contract', async () => {
    const withDecision = JSON.parse(JSON.stringify(overview));
    withDecision.cases.detailsById[CASE_ID].decisions = [{
      id: 'decision-from-real-rec',
      status: 'proposed',
      recommendationId: recommendation.id,
      recommendationTitle: recommendation.title,
      owner: 'manager',
      ageDays: 0,
      createdDate: '2026-08-13 00:00:00',
      approvedDate: null,
    }];
    withDecision.decisionQueue.items = [{
      id: 'decision-from-real-rec',
      decision: recommendation.title,
      caseId: CASE_ID,
      recommendationId: recommendation.id,
      recommendation: recommendation.title,
      confidence: recommendation.confidence,
      priority: recommendation.priority,
      owner: 'manager',
      ageDays: 0,
      status: 'proposed',
    }];
    withDecision.decisionQueue.total = 1;

    getDeliberationOverview.mockResolvedValueOnce(overview).mockResolvedValueOnce(withDecision);

    render(<DeliberationWorkspace tenantId="8" />);

    const feeCard = await card();
    fireEvent.click(feeCard.getByText('Send to governance'));

    await waitFor(() =>
      expect(proposeRecommendationDecision).toHaveBeenCalledWith('8', recommendation.id, recommendation.description),
    );
    expect(await screen.findByText('Decision decision-from-real-rec is proposed and waiting for governance review.')).toBeInTheDocument();
    expect(await screen.findByText('decision-from-real-rec')).toBeInTheDocument();
  });

  it('approves a queued decision through the gated decision endpoint', async () => {
    const withDecision = JSON.parse(JSON.stringify(overview));
    withDecision.decisionQueue.items = [{
      id: 'decision-from-real-rec',
      decision: recommendation.title,
      caseId: CASE_ID,
      recommendationId: recommendation.id,
      recommendation: recommendation.title,
      confidence: recommendation.confidence,
      priority: recommendation.priority,
      owner: 'analyst',
      ageDays: 0,
      status: 'proposed',
    }];
    withDecision.decisionQueue.total = 1;
    getDeliberationOverview.mockResolvedValue(withDecision);

    render(<DeliberationWorkspace tenantId="8" />);

    await screen.findByText('Decision Queue');
    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() =>
      expect(approveDecision).toHaveBeenCalledWith('8', 'decision-from-real-rec', {}),
    );
    expect(await screen.findByText('Decision decision-from-real-rec is now approved.')).toBeInTheDocument();
  });

  it('rejects a queued decision only with a governance note', async () => {
    const withDecision = JSON.parse(JSON.stringify(overview));
    withDecision.decisionQueue.items = [{
      id: 'decision-from-real-rec',
      decision: recommendation.title,
      caseId: CASE_ID,
      recommendationId: recommendation.id,
      recommendation: recommendation.title,
      confidence: recommendation.confidence,
      priority: recommendation.priority,
      owner: 'analyst',
      ageDays: 0,
      status: 'proposed',
    }];
    withDecision.decisionQueue.total = 1;
    getDeliberationOverview.mockResolvedValue(withDecision);

    render(<DeliberationWorkspace tenantId="8" />);

    await screen.findByText('Decision Queue');
    fireEvent.click(screen.getByText('Reject'));

    expect(await screen.findByText('A rejection note must be at least 10 characters.')).toBeInTheDocument();
    expect(rejectDecision).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(`Governance note for ${recommendation.title}`), {
      target: { value: 'Declined after reviewing the cited evidence.' },
    });
    fireEvent.click(screen.getByText('Reject'));

    await waitFor(() =>
      expect(rejectDecision).toHaveBeenCalledWith('8', 'decision-from-real-rec', {
        note: 'Declined after reviewing the cited evidence.',
      }),
    );
    expect(await screen.findByText('Decision decision-from-real-rec is now rejected.')).toBeInTheDocument();
  });

  it('reports a citation that could not be loaded instead of rendering an empty card', async () => {
    getRecommendationCaseContext.mockRejectedValue(new Error('recommendation_not_found'));

    render(<DeliberationWorkspace tenantId="8" />);

    const feeCard = await card();
    fireEvent.click(feeCard.getByText('Multiple fee receipts lack collector information'));

    expect(await feeCard.findByText('recommendation_not_found')).toBeInTheDocument();
  });

  it('says so plainly when a case has produced no recommendation', async () => {
    const withoutRecommendations = JSON.parse(JSON.stringify(overview));
    withoutRecommendations.cases.detailsById[CASE_ID].recommendations = [];
    getDeliberationOverview.mockResolvedValue(withoutRecommendations);

    render(<DeliberationWorkspace tenantId="8" />);

    expect(
      await screen.findByText('Nothing has been recommended for this case yet.'),
    ).toBeInTheDocument();
  });
});
