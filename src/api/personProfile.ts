import { request } from './client';

/**
 * Phase 7.5 — cross-product GraphRAG: "tell me about this person" across
 * K-12, G2G and Enterprise Brain. Backed by
 * PersonProfileController::profile()/narrative() in hpbrain_backend, built
 * on the Phase 7.4 identity crosswalk (cross_product_identity_links).
 */

export interface PersonProfileSection {
  found: boolean;
  reason?: string;
  [key: string]: unknown;
}

export interface PersonProfile {
  g2g: PersonProfileSection;
  eb: PersonProfileSection;
  k12: PersonProfileSection;
}

export interface PersonProfileNarrative extends PersonProfile {
  narrative: string | null;
  narrativeStatus: string;
}

export const personProfileApi = {
  getProfile: (tenantId: string, g2gUserId: string) =>
    request(`/person/${tenantId}/${g2gUserId}/profile`) as Promise<PersonProfile>,
  getNarrative: (tenantId: string, g2gUserId: string) =>
    request(`/person/${tenantId}/${g2gUserId}/narrative`) as Promise<PersonProfileNarrative>,
};
