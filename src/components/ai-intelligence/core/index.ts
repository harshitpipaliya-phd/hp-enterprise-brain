/**
 * Lookups over the AI capability registry.
 *
 * Consumers import from here, never from `registry.ts` directly, so the shape of the
 * data can change without touching every screen that reads it.
 */

export {
  AI_CAPABILITIES,
  type AiCapability,
  type CapabilityStatus,
  type ConsumptionState,
  type SolutionConsumption,
} from './registry'

export {
  SOLUTIONS,
  SOLUTION_IDS,
  SOLUTION_ID_HEADER,
  getSolution,
  type Solution,
  type SolutionId,
  type SolutionKind,
} from './solutions'

import { AI_CAPABILITIES, type AiCapability, type CapabilityStatus } from './registry'
import type { SolutionId } from './solutions'

/**
 * One capability by id, or `undefined`.
 *
 * Unknown ids return undefined rather than throwing: a screen whose capability was
 * renamed should stop claiming it exists, not take the page down with it.
 */
export function getCapability(id: string): AiCapability | undefined {
  return AI_CAPABILITIES.find((capability) => capability.id === id)
}

/** One capability by its URL segment. This is what `/ai/<slug>` resolves through. */
export function getCapabilityBySlug(slug: string): AiCapability | undefined {
  const wanted = slug.trim().toLowerCase()
  return AI_CAPABILITIES.find((capability) => capability.slug === wanted)
}

/**
 * The console sub-route a capability opens: its own management screen where it has
 * one, otherwise its slug, which the console renders as the shared capability page.
 */
export function capabilityRoute(capability: AiCapability): string {
  return capability.route ?? capability.slug
}

/** Capabilities a given product consumes today, in registry order. */
export function capabilitiesForSolution(solutionId: SolutionId): AiCapability[] {
  return AI_CAPABILITIES.filter((capability) => capability.solutions[solutionId].today !== 'no')
}

/** How many capabilities are in each state. Used for the console's summary line. */
export function capabilityStatusCounts(): Record<CapabilityStatus, number> {
  const counts: Record<CapabilityStatus, number> = {
    live: 0,
    'in-progress': 0,
    'coming-soon': 0,
  }
  for (const capability of AI_CAPABILITIES) counts[capability.status] += 1
  return counts
}

const STATUS_LABELS: Record<CapabilityStatus, string> = {
  live: 'Live',
  'in-progress': 'In progress',
  'coming-soon': 'Coming soon',
}

/**
 * The one word each state is described with.
 *
 * Kept here so a badge, a table cell and a page header cannot word the same state
 * three different ways — the consistency is the point of a shared package.
 */
export function capabilityStatusLabel(status: CapabilityStatus): string {
  return STATUS_LABELS[status]
}
