/**
 * AI Providers — description, live rows, and the controls that change them.
 *
 * Ported from G2G's app/ai/providers/page.tsx. The console routes 'providers' here
 * rather than to the generic CapabilityPage. Everything that page shows is still
 * shown, by the shared `CapabilityShell`; this file only adds the management section
 * underneath.
 */

import { CapabilityShell } from '../CapabilityShell';
import { ConfigurationManager } from './providers/ConfigurationManager';
import './providers.css';

export default function ProvidersScreen() {
  return (
    <CapabilityShell slug="providers">
      <ConfigurationManager />
    </CapabilityShell>
  );
}
