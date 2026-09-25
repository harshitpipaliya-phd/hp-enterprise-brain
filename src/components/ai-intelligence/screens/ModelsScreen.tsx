/**
 * Model Management — the catalogue every model dropdown reads.
 *
 * Ported from G2G's app/ai/models/page.tsx. The console routes 'models' here rather
 * than to the generic CapabilityPage. The registry description and the live panel
 * are unchanged, by the shared `CapabilityShell`; the catalogue table and its
 * Add/Edit controls are added below.
 */

import { CapabilityShell } from '../CapabilityShell';
import { ModelManager } from './providers/ModelManager';
import './providers.css';

export default function ModelsScreen() {
  return (
    <CapabilityShell slug="models">
      <ModelManager />
    </CapabilityShell>
  );
}
