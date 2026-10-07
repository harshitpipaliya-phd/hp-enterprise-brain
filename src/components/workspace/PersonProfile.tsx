import { Fragment, useState } from 'react';
import { Users } from 'lucide-react';
import { personProfileApi } from '../../api/personProfile';
import type { PersonProfile as PersonProfileData, PersonProfileNarrative } from '../../api/personProfile';
import { Panel, Button, Spinner, ErrorState, ConsequenceEmpty } from '../../ui';
import { useTheme } from '../../hooks/useTheme';

/**
 * Phase 7.5 — "tell me about this person" across K-12, G2G and Enterprise
 * Brain. profile() is pure aggregation (no model call); narrative() explains
 * it, grounded only in what profile() returned — same retrieval/generation
 * split as every other Graph RAG screen in this project.
 *
 * Self-contained by design: the identity crosswalk (Phase 7.4) only has 66
 * confirmed links out of 73 proposed, so most lookups will honestly show
 * "not yet confirmed" for the K-12 section — this is correct behaviour, not
 * a bug, and the screen says so rather than hiding the section.
 */
export default function PersonProfile({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [g2gUserId, setG2gUserId] = useState('');
  const [data, setData] = useState<PersonProfileData | PersonProfileNarrative | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (withNarrative: boolean) => {
    if (!g2gUserId.trim()) {
      setError('Enter a G2G user id first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = withNarrative
        ? await personProfileApi.getNarrative(tenantId, g2gUserId.trim())
        : await personProfileApi.getProfile(tenantId, g2gUserId.trim());
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load this person.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    padding: 10, borderRadius: 6, border: `1px solid ${theme.border}`,
    backgroundColor: theme.surface, color: theme.text, width: 160,
  };

  const section = (title: string, produces: string, s?: { found: boolean; reason?: string; [k: string]: unknown }) => {
    if (!s) return null;
    if (!s.found) {
      return (
        <Panel title={title}>
          <ConsequenceEmpty missing={s.reason ?? 'No record found.'} produces={produces} />
        </Panel>
      );
    }
    const fields = Object.entries(s).filter(([k]) => k !== 'found' && k !== 'reason');
    return (
      <Panel title={title}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', rowGap: 6, columnGap: 12, fontSize: 13 }}>
          {fields.map(([k, v]) => (
            <Fragment key={k}>
              <div style={{ color: theme.textMuted }}>{k}</div>
              <div style={{ color: theme.text }}>
                {Array.isArray(v) ? JSON.stringify(v) : String(v ?? '—')}
              </div>
            </Fragment>
          ))}
        </div>
      </Panel>
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Users size={22} />
        <h1 style={{ fontSize: 18, fontWeight: 600, color: theme.text, margin: 0 }}>
          Person Profile — across K-12, G2G and Enterprise Brain
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 12, color: theme.textMuted, display: 'block', marginBottom: 4 }}>G2G user ID</label>
          <input
            value={g2gUserId}
            onChange={(e) => setG2gUserId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup(false)}
            placeholder="e.g. 1608"
            style={inputStyle}
          />
        </div>
        <Button onClick={() => lookup(false)} disabled={loading}>Look up</Button>
        <Button variant="secondary" onClick={() => lookup(true)} disabled={loading}>Look up + explain</Button>
      </div>

      {loading && <Spinner label="Looking up this person across all three products" />}
      {error && <ErrorState message={error} onRetry={() => lookup(false)} />}

      {data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {'narrative' in data && data.narrative && (
            <Panel title="Summary">
              <p style={{ color: theme.text, fontSize: 13, margin: 0 }}>{data.narrative}</p>
            </Panel>
          )}
          {'narrative' in data && !data.narrative && data.narrativeStatus && data.narrativeStatus !== 'ok' && (
            <Panel title="Summary">
              <ConsequenceEmpty missing={`Narrative unavailable (${data.narrativeStatus}).`} produces="a plain-language summary" />
            </Panel>
          )}

          {section('G2G (employee record, HR/competency platform)', 'name, email, employee id, competency ratings on file', data.g2g)}
          {section('Enterprise Brain (capability assignments)', 'capabilities assigned to this person', data.eb)}
          {section('K-12 (student/staff record)', 'name and email from the matched K-12 identity', data.k12)}
        </div>
      )}
    </div>
  );
}
