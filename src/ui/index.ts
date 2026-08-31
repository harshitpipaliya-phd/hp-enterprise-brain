/**
 * Enterprise Brain UI primitives — public entry point.
 *
 * Import from '../../ui' rather than reaching into ./primitives, so the file
 * layout can change without touching every screen.
 *
 * Deliberately separate from components/rcl/, which holds DOMAIN widgets
 * (KasbaBadge, HypothesisRow, EvidenceLink). These are generic and know nothing
 * about the Brain's concepts.
 */
export * from './primitives';
export * from './LazyView';

/**
 * The page header system.
 *
 * Separate from primitives.tsx because it is not a primitive: it is the one
 * composition every screen in the product opens with, and it carries five
 * variants, an overflow menu and its own container-query responsive rules. It
 * is exported from here so a screen imports it the same way it imports Button.
 */
export * from './pageHeader';

/**
 * Charts and the three-layer reading.
 *
 * These two DO know about the Brain's concepts — a null that means "never
 * assessed", a confidence that governs belief, a Consequence layer that is
 * allowed to be empty. They live here rather than in components/rcl/ because
 * every screen needs them and none should reimplement them; the honesty rules
 * they encode only work if there is one implementation of each.
 */
export * from './charts';
export * from './layers';
