import { createContext, useContext } from 'react';

import type { ModuleProfile } from '../../api/aiStack/profile';

/**
 * The loaded `ModuleProfile` for whichever module's AI Stack is currently open.
 *
 * `ModuleAiStackPanel` fetches the profile once per module open and provides it here;
 * every tab screen underneath reads it with `useAiStackProfile()` instead of a
 * descriptor's compiled-in `label`, `report.filters` or `presets`. The provider only
 * ever renders once the profile has loaded — see `ModuleAiStackPanel` — so a screen
 * calling `useAiStackProfile()` is guaranteed a real, tenant-scoped profile rather than
 * a nullable value every call site would have to guard.
 */
const AiStackProfileContext = createContext<ModuleProfile | null>(null);

export function AiStackProfileProvider({
  profile,
  children,
}: {
  profile: ModuleProfile;
  children: React.ReactNode;
}) {
  return <AiStackProfileContext.Provider value={profile}>{children}</AiStackProfileContext.Provider>;
}

/**
 * The current module's live profile — its identity, read-only data sources, the MCP
 * tools those sources are to a tool agent, and its agent presets.
 *
 * Throws when called outside `AiStackProfileProvider`, which every AI Stack tab screen
 * renders beneath. That is a programming error to surface loudly, not a case to guard
 * with a fallback — a screen reading `undefined` here would otherwise have to invent
 * the very data this profile exists to stop it inventing.
 */
export function useAiStackProfile(): ModuleProfile {
  const profile = useContext(AiStackProfileContext);

  if (profile === null) {
    throw new Error('useAiStackProfile() was called outside an AiStackProfileProvider.');
  }

  return profile;
}
