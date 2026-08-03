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
