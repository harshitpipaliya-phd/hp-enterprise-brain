import { useEffect, useMemo, useState } from 'react';

import { Spinner } from '../../ui';
import { fetchModuleProfile, type ModuleProfile } from '../../api/aiStack/profile';
import { describeAiError } from '../../api/aiIntelligence/client';
import { AiStackTabs } from './ai-stack-host';
import { AI_STACK_MODULES } from './modules';
import { AiStackProfileProvider } from './profile-context';
import { AiStackError } from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';

/**
 * The lazily loaded half of the frame: resolves a module key to its descriptor, loads
 * that module's live AI Stack profile, and hosts the nine shared tabs for it. Loaded
 * only when an administrator opens a module's AI Stack, so no module screen pays for
 * it otherwise.
 *
 * THE PROFILE IS FETCHED HERE, ONCE, AND NEVER GUESSED AT BELOW
 *
 * `GET /ai-intelligence/modules/{key}/profile` is the tenant-scoped catalogue this AI
 * Stack used to compile in: which read-only data sources this module has, what
 * arguments each accepts, which of them are actually available for this tenant right
 * now, and the agent presets an administrator has published for it. Every tab reads it
 * through `useAiStackProfile()` rather than a descriptor's static `report.filters` or
 * `presets` — see `profile-context.tsx`. Nothing below this component renders until
 * the profile has loaded, so no tab has to handle a missing profile itself.
 *
 * `profile.module.label` — the tenant's own name for this module, when it differs from
 * the platform default — takes over the descriptor's compiled-in `label` for every
 * heading rendered underneath, by way of the `AiStackModule` handed to `AiStackTabs`.
 */
export default function ModuleAiStackPanel({ moduleKey }: { moduleKey: string }) {
  const descriptor = AI_STACK_MODULES[moduleKey];

  const [profile, setProfile] = useState<ModuleProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (!descriptor) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchModuleProfile(moduleKey)
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describeAiError(cause, `The ${descriptor.label} AI Stack profile could not be read.`));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleKey, descriptor, token]);

  // The tenant's own label, when the profile carries one, replacing the descriptor's
  // compiled-in default for every heading rendered underneath.
  const effectiveModule: AiStackModule | null = useMemo(() => {
    if (!descriptor || !profile) return null;
    return profile.module.label ? { ...descriptor, label: profile.module.label } : descriptor;
  }, [descriptor, profile]);

  if (!descriptor) {
    // Only reachable if moduleViews.ts names a key with no descriptor — a build-time
    // mistake, surfaced plainly rather than as an empty tab strip.
    return <p role="alert">No AI Stack is defined for “{moduleKey}”.</p>;
  }

  if (loading && !profile) {
    return <Spinner label={`Loading the ${descriptor.label} AI Stack profile…`} />;
  }

  if (error || !profile || !effectiveModule) {
    return (
      <AiStackError onRetry={() => setToken((value) => value + 1)}>
        {error ?? `The ${descriptor.label} AI Stack profile could not be read.`}
      </AiStackError>
    );
  }

  return (
    <AiStackProfileProvider profile={profile}>
      <AiStackTabs module={effectiveModule} />
    </AiStackProfileProvider>
  );
}
