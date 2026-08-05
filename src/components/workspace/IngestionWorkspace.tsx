import { useState, useEffect } from 'react';
import {
  ingestionApi, CANONICAL_FIELDS, REQUIRED_FIELDS,
} from '../../api/ingestion';
import type {
  CanonicalField, CommitResponse, DataSourceRow, IngestionPreview,
} from '../../api/ingestion';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../Toast';

/**
 * Ingestion — upload a CSV, approve the mapping, commit.
 *
 * THREE SECTIONS, ONE SCREEN. Source, then preview, then result, revealed in
 * place as each step completes. Splitting them across views would mean the
 * mapping a reviewer approved and the sample rows they approved it against
 * could not be on screen together, which is the only thing that makes the
 * approval meaningful.
 *
 * THE SUGGESTED MAP IS SHOWN AS A PROPOSAL, NEVER APPLIED SILENTLY. The server
 * matches it from column-name substrings and is wrong often enough to matter,
 * so it seeds the dropdowns and the reviewer confirms every row before the
 * Commit button will do anything.
 */

const NOT_MAPPED = '';

/** What each canonical field becomes once committed. */
const FIELD_HELP: Record<CanonicalField, string> = {
  title: 'Names the Signal, and is its deduplication key.',
  state: 'Becomes the Signal classification, in the source’s own words.',
  owner: 'Recorded on the Signal as who the row belongs to.',
  evidence_text: 'Creates one Evidence row per source row that has any.',
  evidence_timestamp: 'When the Evidence was observed.',
  external_ref: 'A stable id in the source, kept for traceability.',
};

type Phase = 'idle' | 'previewed' | 'committed';

export default function IngestionWorkspace({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const { showToast } = useToast();

  const [sources, setSources] = useState<DataSourceRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<IngestionPreview | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [saveMap, setSaveMap] = useState(true);
  const [result, setResult] = useState<CommitResponse | null>(null);

  useEffect(() => {
    // A tenant with no configured sources is normal on a first run, so a
    // failure here is not worth a toast — the field stays free text either way.
    ingestionApi.listSources(tenantId).then(setSources).catch(() => setSources([]));
  }, [tenantId]);

  const reset = () => {
    setFile(null);
    setPhase('idle');
    setJobId(null);
    setPreview(null);
    setMap({});
    setResult(null);
  };

  const upload = async () => {
    if (!file || !sourceId.trim()) return;
    setUploading(true);
    try {
      const data = await ingestionApi.upload(file, sourceId.trim());
      const suggested = data.preview.suggested_map ?? {};

      // Seeded from the fixed canonical list, not from the keys of the
      // response — see the note in api/ingestion.ts about camelCase aliases.
      const seeded: Record<string, string> = {};
      for (const field of CANONICAL_FIELDS) {
        seeded[field] = suggested[field] ?? NOT_MAPPED;
      }

      setJobId(data.job_id);
      setPreview(data.preview);
      setMap(seeded);
      setPhase('previewed');
      showToast('info', `Previewed ${data.preview.row_count} rows. Nothing written yet.`);
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setUploading(false);
    }
  };

  const commit = async () => {
    if (!jobId) return;
    setCommitting(true);
    try {
      // Only bound fields are sent. An empty string would bind the canonical
      // field to a column named '', which matches nothing and would quietly
      // produce a Signal missing the value the reviewer thought they mapped.
      const payload: Partial<Record<CanonicalField, string>> = {};
      for (const field of CANONICAL_FIELDS) {
        if (map[field]) payload[field] = map[field];
      }

      const data = await ingestionApi.commit(tenantId, jobId, payload, saveMap);
      setResult(data);
      setPhase('committed');
      showToast('success', `Committed ${data.committed} signals.`);
    } catch (e: any) {
      // The preview stays on screen: a rejected commit is usually a mapping
      // to correct and retry, not a reason to make the user upload again.
      showToast('error', e.message);
    } finally {
      setCommitting(false);
    }
  };

  const committable = REQUIRED_FIELDS.every((f) => !!map[f]);

  const card = {
    padding: 16,
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.surface,
    marginBottom: 16,
  } as const;

  const control = {
    padding: 8,
    borderRadius: 6,
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.bg,
    color: theme.text,
  } as const;

  const cell = {
    padding: 8,
    borderBottom: `1px solid ${theme.border}`,
    fontSize: 12,
    textAlign: 'left',
  } as const;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1000, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header style={{ marginBottom: 16 }}>
        <h1>Ingestion</h1>
        <p style={{ color: theme.textMuted, fontSize: 13 }}>
          Upload a CSV, review the field mapping, then commit it as Signals and Evidence.
        </p>
      </header>

      {/* ---- 1 · Source ------------------------------------------------- */}
      <section style={card}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>1 · Source</h3>

        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: theme.textMuted }}>CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              disabled={phase !== 'idle'}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ ...control, padding: 6 }}
            />
            {file && (
              <span style={{ fontSize: 12, color: theme.textMuted }}>
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </span>
            )}
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: theme.textMuted }}>Source id</span>
            <input
              list="ingestion-source-ids"
              placeholder="internal-upload-example-csv"
              value={sourceId}
              disabled={phase !== 'idle'}
              onChange={(e) => setSourceId(e.target.value)}
              style={control}
            />
            <datalist id="ingestion-source-ids">
              {sources.map((s) => (
                <option key={s.source_key} value={s.source_key}>{s.display_name}</option>
              ))}
            </datalist>
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              Re-using a known source id loads the mapping saved for it.
            </span>
          </label>

          <div>
            <button onClick={upload} disabled={!file || !sourceId.trim() || uploading || phase !== 'idle'}>
              {uploading ? 'Uploading…' : 'Upload & preview'}
            </button>
          </div>
        </div>
      </section>

      {/* ---- 2 · Preview ------------------------------------------------ */}
      {preview && phase !== 'committed' && (
        <section style={card}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>2 · Preview</h3>
          <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 0 }}>
            job {jobId?.slice(0, 8)}… · {preview.row_count} rows · {preview.sync_type}
          </p>

          <p style={{ fontSize: 12, padding: 10, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg }}>
            The suggested mapping is matched from column names. It is wrong often
            enough to matter — check every row before committing. Nothing has been
            written yet.
          </p>

          <h4 style={{ marginBottom: 8 }}>Field mapping</h4>
          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            {CANONICAL_FIELDS.map((field) => {
              const required = REQUIRED_FIELDS.includes(field);
              const missing = required && !map[field];

              return (
                <label key={field} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>
                    {field}{required && <span style={{ color: theme.textMuted }}> *</span>}
                    <span style={{ display: 'block', fontSize: 11, color: theme.textMuted }}>
                      {FIELD_HELP[field]}
                    </span>
                  </span>
                  <select
                    value={map[field] ?? NOT_MAPPED}
                    onChange={(e) => setMap((m) => ({ ...m, [field]: e.target.value }))}
                    style={{ ...control, borderColor: missing ? '#b91c1c' : theme.border }}
                  >
                    <option value={NOT_MAPPED}>— not mapped —</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 0 }}>
            * required before this batch can be committed.
          </p>

          <h4 style={{ marginBottom: 8 }}>
            Sample rows ({Math.min(preview.sample_rows.length, 3)} of {preview.row_count})
          </h4>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} style={{ ...cell, color: theme.textMuted, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample_rows.slice(0, 3).map((row, i) => (
                  <tr key={i}>
                    {/* Keyed off headers, not off the row's own keys: client.ts
                        adds camelCase aliases to every parsed object, so a
                        column named first_name arrives twice. */}
                    {preview.headers.map((h) => (
                      <td key={h} style={cell}>{String(row[h] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 12 }}>
            <input type="checkbox" checked={saveMap} onChange={(e) => setSaveMap(e.target.checked)} />
            Save this mapping for future uploads of this source
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} disabled={committing}>Start over</button>
            <button onClick={commit} disabled={!committable || committing}>
              {committing ? 'Committing…' : `Commit ${preview.row_count} rows`}
            </button>
            {!committable && (
              <span style={{ fontSize: 12, color: theme.textMuted, alignSelf: 'center' }}>
                Map {REQUIRED_FIELDS.filter((f) => !map[f]).join(' and ')} first.
              </span>
            )}
          </div>
        </section>
      )}

      {/* ---- 3 · Result -------------------------------------------------- */}
      {result && phase === 'committed' && (
        <section style={card}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>3 · Result</h3>

          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            <Stat label="Committed" value={result.committed} theme={theme} />
            <Stat label="Errors" value={result.errors} theme={theme} />
            <Stat label="Skipped" value={result.skipped} theme={theme} />
          </div>

          {result.errors > 0 && (
            <p style={{ fontSize: 12, color: theme.textMuted }}>
              Failed rows are recorded per row in the import log for job {jobId?.slice(0, 8)}….
            </p>
          )}

          <h4 style={{ marginBottom: 8 }}>
            Created signals
            {result.committed > result.signal_ids.length && (
              <span style={{ fontWeight: 'normal', fontSize: 12, color: theme.textMuted }}>
                {' '}(first {result.signal_ids.length} of {result.committed})
              </span>
            )}
          </h4>
          {result.signal_ids.length === 0 ? (
            <p style={{ fontSize: 13, color: theme.textMuted }}>No signals were created.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {result.signal_ids.map((id) => (
                <code key={id} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: `1px solid ${theme.border}`, color: theme.textMuted }}>
                  {id}
                </code>
              ))}
            </div>
          )}

          <button onClick={reset}>Ingest another file</button>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, theme }: { label: string; value: number; theme: { textMuted: string } }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
