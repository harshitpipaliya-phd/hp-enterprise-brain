/**
 * What the user is currently looking at, as the backend Context Engine names it.
 *
 * A HINT, NEVER A CLAIM. Every value here is chosen by the browser and is worth
 * exactly nothing as evidence. The server re-resolves the object from its own
 * tenant — `ContextEngine` looks the id up by primary key AND tenant key, and
 * `EnsureTenantScope` pins the tenant to the verified token — so an id from
 * another organization, or one typed in by hand, resolves to
 * `object.present: false` and the conversation is recorded with no subject.
 * That is why no tenant appears in this type at all: there is nothing useful a
 * caller could put there.
 *
 * THE SCREEN NAMES AND THE ENTITY NAMES ARE NOT FREE TEXT. Both halves have to
 * match `App\Domain\Context\ScreenRegistry` and `EntityResolver::ENTITIES`
 * exactly, or the server answers `unknown_screen` / `unknown_object_type` and
 * resolves nothing. They are enumerated below rather than assembled from
 * strings at the call sites, so a screen that reports context either names a
 * pair that exists or fails to compile.
 */

/**
 * The screen identifiers this SPA reports, and the universal entity each one's
 * object is.
 *
 * Copied from ScreenRegistry::SCREENS — only the object-bearing entries. The
 * registry also declares the tenant-wide screens (home, signals, analytics…)
 * bound to nothing; those are absent here because a screen with no object
 * reports no context, which this module expresses as `null` rather than as an
 * entry.
 */
export const SCREEN_ENTITY = {
  'person-profile': 'Person',
  'student-profile': 'Student',
  'department-profile': 'OrganizationUnit',
  'organization-profile': 'Organization',
} as const;

export type ContextScreen = keyof typeof SCREEN_ENTITY;

export type ContextObjectType = (typeof SCREEN_ENTITY)[ContextScreen];

/** One resolved-on-screen object, as reported upward by the screen showing it. */
export interface ScreenObject {
  screen: ContextScreen;
  /** A primary key in the tenant's own source table. Always a string here. */
  objectId: string;
  objectType: ContextObjectType;
}

/**
 * A screen object for one id, or null when there is nothing selected.
 *
 * Takes the screen and derives the type from it, so the pairing can never be
 * mismatched by a call site — `screenObject('person-profile', id)` cannot
 * produce `objectType: 'OrganizationUnit'`.
 *
 * An empty or absent id yields null. A screen showing a list has no object, and
 * reporting `objectId: ''` would make the server answer `object_not_found`
 * about a row nobody asked for.
 */
export function screenObject(
  screen: ContextScreen,
  objectId: string | number | null | undefined,
): ScreenObject | null {
  const id = objectId === null || objectId === undefined ? '' : String(objectId).trim();

  if (id === '') return null;

  return { screen, objectId: id, objectType: SCREEN_ENTITY[screen] };
}

/**
 * The three context fields for a conversation-session request body.
 *
 * Returns `{}` when there is no object, so the request is byte-identical to the
 * one this app sent before context existed. That is what keeps "opened from the
 * home screen" behaving exactly as it always has rather than sending three
 * nulls the server would have to interpret.
 */
export function contextPayload(object: ScreenObject | null | undefined): Partial<ScreenObject> {
  return object ? { screen: object.screen, objectId: object.objectId, objectType: object.objectType } : {};
}

/**
 * Whether two reports describe the same object.
 *
 * Used to avoid re-reporting an unchanged selection on every render pass. It
 * compares all three fields: department 2050 and person 2050 are different
 * objects in this system — the ids genuinely collide — so an id-only
 * comparison would treat a Department → Person move as no change and leave the
 * Assistant holding the wrong subject.
 */
export function sameScreenObject(a: ScreenObject | null, b: ScreenObject | null): boolean {
  if (a === null || b === null) return a === b;

  return a.screen === b.screen && a.objectId === b.objectId && a.objectType === b.objectType;
}
