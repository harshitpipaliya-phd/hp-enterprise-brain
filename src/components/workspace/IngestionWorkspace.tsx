import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Bot, CheckCircle2, Database, FileArchive, FileCode2, FileImage, FileJson, FileSpreadsheet, FileText, GitBranch, Layers3, RefreshCw, SearchCheck, Sparkles, UploadCloud, Wand2 } from 'lucide-react';
import { CANONICAL_FIELDS, REQUIRED_FIELDS, ingestionApi } from '../../api/ingestion';
import type { CanonicalField, CommitResponse, DataSourceRow, IngestionPreview } from '../../api/ingestion';
import { ApiError } from '../../api/client';
import { useToast } from '../Toast';
import './IngestionWorkspace.css';

const ACCEPTED = '.csv,.xls,.xlsx,.pdf,.doc,.docx,.txt,.json,.xml,.html,.htm,.md,.markdown,.zip,.sql,.png,.jpg,.jpeg';
const NOT_MAPPED = '';

const FILE_GROUPS = [
  { label: 'Sheets', exts: ['CSV', 'XLS', 'XLSX'], icon: <FileSpreadsheet /> },
  { label: 'Documents', exts: ['PDF', 'DOC', 'DOCX', 'TXT', 'MD'], icon: <FileText /> },
  { label: 'Structured', exts: ['JSON', 'XML', 'HTML', 'SQL'], icon: <FileJson /> },
  { label: 'Media + Archives', exts: ['PNG', 'JPG', 'ZIP'], icon: <FileArchive /> },
];

const PIPELINE = [
  { id: 'extract', label: 'Extract', icon: <UploadCloud /> },
  { id: 'clean', label: 'Clean', icon: <Wand2 /> },
  { id: 'schema', label: 'Detect Schema', icon: <Database /> },
  { id: 'relationships', label: 'Relationships', icon: <GitBranch /> },
  { id: 'embeddings', label: 'Embeddings', icon: <Layers3 /> },
  { id: 'insights', label: 'AI Insights', icon: <Bot /> },
];

const FIELD_HELP: Record<CanonicalField, string> = {
  title: 'Signal title and deduplication key.',
  state: 'Signal classification from the source.',
  owner: 'Owner or accountable party.',
  evidence_text: 'Evidence content created with the signal.',
  evidence_timestamp: 'Observation timestamp.',
  external_ref: 'Stable source reference.',
};

type Phase = 'idle' | 'uploading' | 'previewed' | 'committing' | 'committed';

/**
 * Name the STAGE that failed, not just the fact that something did.
 *
 * The engine has five places a file can die and they need different actions
 * from the user: the browser never delivered it, the server refused it, the
 * parser could not read it, the database rejected the rows, or the database was
 * unreachable. Reporting all five as "Upload failed" — which is what this did —
 * sent people to check their file when the actual fault was a PHP limit, and to
 * check the server when the actual fault was a malformed row.
 *
 * The server already distinguishes these in its `error` code; this maps them to
 * a stage the user can act on and otherwise passes the server's own sentence
 * through unchanged, because it is more specific than anything invented here.
 */
function describeStageFailure(e: unknown, assumedStage: 'upload' | 'ingestion' = 'upload'): string {
  const api = e instanceof ApiError ? e : null;
  const body = (api?.responseJson ?? {}) as { error?: string; message?: string };
  const code = body.error ?? '';
  const detail = (e as { message?: string })?.message ?? 'No further detail was returned.';

  // Server-side upload preconditions — the file never became readable.
  const uploadCodes = [
    'file_exceeds_php_limit',
    'file_exceeds_form_limit',
    'upload_incomplete',
    'no_file_received',
    'missing_temp_directory',
    'temp_directory_not_writable',
    'upload_blocked_by_extension',
    'storage_failed',
  ];

  if (uploadCodes.includes(code)) return `Upload failed — ${detail}`;
  if (code === 'unreadable_upload') return `Parsing failed — ${detail}`;
  if (code === 'incomplete_field_map') return `Validation failed — ${detail}`;
  if (code === 'database_unavailable') return `Database unavailable — ${detail}`;
  if (code === 'source_unavailable') return `Ingestion failed — ${detail}`;
  if (code === 'job_not_previewed') return `Ingestion failed — ${detail}`;

  // A 422 with field errors is validation, whatever stage we thought we were in.
  if (api?.status === 422) return `Validation failed — ${detail}`;
  if (api?.status === 401 || api?.status === 403) return `Not authorised — ${detail}`;

  const stage = assumedStage === 'ingestion' ? 'Ingestion failed' : 'Upload failed';

  return api ? `${stage} (${api.status}) — ${detail}` : `${stage} — ${detail}`;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function normalizePreview(value: unknown): IngestionPreview {
  const raw = asRecord(value);
  const sampleRows = Array.isArray(raw.sample_rows)
    ? raw.sample_rows.map((row) => asRecord(row))
    : Array.isArray(raw.sampleRows)
      ? raw.sampleRows.map((row) => asRecord(row))
      : [];

  return {
    row_count: Number(raw.row_count ?? raw.rowCount ?? 0),
    headers: Array.isArray(raw.headers) ? raw.headers.map(String) : [],
    suggested_map: asRecord(raw.suggested_map ?? raw.suggestedMap) as Partial<Record<CanonicalField, string>>,
    unmapped_fields: Array.isArray(raw.unmapped_fields) ? raw.unmapped_fields.map(String) : [],
    committable: Boolean(raw.committable),
    sample_rows: sampleRows,
    sync_type: String(raw.sync_type ?? raw.syncType ?? ''),
    fetched_at: String(raw.fetched_at ?? raw.fetchedAt ?? ''),
  };
}

export default function IngestionWorkspace({ tenantId }: { tenantId: string }) {
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [sources, setSources] = useState<DataSourceRow[]>([]);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'merge' | 'replace' | 'new_dataset'>('append');
  const [phase, setPhase] = useState<Phase>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<IngestionPreview | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [saveMap, setSaveMap] = useState(true);
  const [result, setResult] = useState<CommitResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    ingestionApi.listSources(tenantId)
      .then((rows) => {
        if (cancelled) return;
        setSources(Array.isArray(rows) ? rows : []);
        setSourcesError(null);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setSources([]);
        setSourcesError(e?.message ?? 'Could not load saved ingestion sources.');
      });
    return () => { cancelled = true; };
  }, [tenantId]);

  const fileKind = useMemo(() => {
    const ext = file?.name.split('.').pop()?.toUpperCase() || 'FILE';
    if (['CSV', 'XLS', 'XLSX'].includes(ext)) return { ext, icon: <FileSpreadsheet />, label: 'tabular dataset' };
    if (['JSON'].includes(ext)) return { ext, icon: <FileJson />, label: 'structured document' };
    if (['XML', 'HTML', 'HTM', 'SQL'].includes(ext)) return { ext, icon: <FileCode2 />, label: 'structured text' };
    if (['PNG', 'JPG', 'JPEG'].includes(ext)) return { ext, icon: <FileImage />, label: 'image asset' };
    if (['ZIP'].includes(ext)) return { ext, icon: <FileArchive />, label: 'archive' };
    return { ext, icon: <FileText />, label: 'document' };
  }, [file]);

  const profile = useMemo(() => {
    if (!preview) return null;
    const requiredMapped = REQUIRED_FIELDS.filter((field) => map[field]).length;
    const mapped = CANONICAL_FIELDS.filter((field) => map[field]).length;
    const duplicateHeaders = preview.headers.length - new Set(preview.headers).size;
    return {
      requiredMapped,
      mapped,
      duplicateHeaders,
      quality: Math.round((mapped / CANONICAL_FIELDS.length) * 100),
      committable: REQUIRED_FIELDS.every((field) => !!map[field]),
    };
  }, [map, preview]);

  const schemaColumns = useMemo(() => {
    if (!preview?.schema?.columns) return [];
    return Object.entries(preview.schema.columns).slice(0, 8);
  }, [preview]);

  const reset = () => {
    setFile(null);
    setPhase('idle');
    setJobId(null);
    setPreview(null);
    setMap({});
    setResult(null);
  };

  const setSelectedFile = (next: File | null) => {
    setFile(next);
    setResult(null);
    setPreview(null);
    setJobId(null);
    setPhase('idle');
    if (next && !sourceId.trim()) {
      setSourceId(next.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  const upload = async () => {
    if (!file || !sourceId.trim()) return;
    setPhase('uploading');
    try {
      const data = await ingestionApi.upload(file, sourceId.trim());
      const normalizedPreview = normalizePreview(data.preview);
      const seeded: Record<string, string> = {};
      for (const field of CANONICAL_FIELDS) seeded[field] = normalizedPreview.suggested_map?.[field] ?? NOT_MAPPED;
      setJobId(data.job_id);
      setPreview(normalizedPreview);
      setMap(seeded);
      setPhase('previewed');
      showToast('info', `Previewed ${normalizedPreview.row_count} row${normalizedPreview.row_count === 1 ? '' : 's'}.`);
    } catch (e: any) {
      setPhase('idle');
      showToast('error', describeStageFailure(e));
    }
  };

  const autoMap = () => {
    if (!preview) return;
    const next: Record<string, string> = {};
    for (const field of CANONICAL_FIELDS) next[field] = preview.suggested_map?.[field] ?? NOT_MAPPED;
    setMap(next);
  };

  const commit = async () => {
    if (!jobId || !profile?.committable) return;
    setPhase('committing');
    try {
      const payload: Partial<Record<CanonicalField, string>> = {};
      for (const field of CANONICAL_FIELDS) if (map[field]) payload[field] = map[field];
      const data = await ingestionApi.commit(tenantId, jobId, payload, saveMap);
      setResult(data);
      setPhase('committed');
      showToast('success', data.status === 'queued' ? `Queued ${data.total_rows ?? preview?.row_count ?? 0} rows for commit.` : `Committed ${data.committed} signals.`);
    } catch (e: any) {
      setPhase('previewed');
      showToast('error', describeStageFailure(e, 'ingestion'));
    }
  };

  const activeStep = phase === 'idle' ? -1 : phase === 'uploading' ? 1 : phase === 'previewed' ? 3 : phase === 'committing' ? 4 : 5;

  return (
    <div className="ingestion-page">
      <section className="ingestion-hero">
        <div>
          <span className="ingestion-eyebrow">Universal AI Ingestion Engine</span>
          <h1>Turn operational files into trusted intelligence.</h1>
          <p>Preview source structure, validate mappings, detect quality gaps, and commit only reviewed signals and evidence.</p>
        </div>
        <div className="ingestion-ai-chip">
          <Sparkles size={18} />
          DeepSeek-ready extraction pipeline
        </div>
      </section>

      <section className="ingestion-format-grid">
        {FILE_GROUPS.map((group) => (
          <article key={group.label}>
            <span>{group.icon}</span>
            <strong>{group.label}</strong>
            <small>{group.exts.join(' / ')}</small>
          </article>
        ))}
      </section>

      <section className="ingestion-pipeline" aria-label="AI ingestion pipeline">
        {PIPELINE.map((step, index) => (
          <div key={step.id} className="ingestion-pipeline-step" data-active={index <= activeStep ? 'true' : undefined}>
            <span>{step.icon}</span>
            <strong>{step.label}</strong>
          </div>
        ))}
      </section>

      <div className="ingestion-layout">
        <section className="ingestion-card ingestion-upload-card">
          <div className="ingestion-card-head">
            <div>
              <span>Source intake</span>
              <h2>Upload workspace</h2>
            </div>
            <button className="eb-pill-btn" onClick={reset} disabled={phase === 'uploading' || phase === 'committing'}>
              <RefreshCw size={14} /> Reset
            </button>
          </div>

          <button
            className="ingestion-dropzone"
            data-dragging={dragging ? 'true' : undefined}
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              setSelectedFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <input ref={fileInput} type="file" accept={ACCEPTED} onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
            <span className="ingestion-drop-icon">{fileKind.icon}</span>
            <strong>{file ? file.name : 'Drop a file or browse'}</strong>
            <small>{file ? `${fileKind.ext} ${fileKind.label} - ${(file.size / 1024).toFixed(1)} KB` : 'CSV, XLSX, PDF, DOCX, JSON, XML, HTML, Markdown, SQL, images and archives'}</small>
          </button>

          <div className="ingestion-form-grid">
            <label>
              <span>Source ID</span>
              <input list="ingestion-source-ids" value={sourceId} onChange={(event) => setSourceId(event.target.value)} placeholder="finance-monthly-upload" />
              <datalist id="ingestion-source-ids">
                {sources.map((source) => <option key={source.source_key} value={source.source_key}>{source.display_name}</option>)}
              </datalist>
            </label>
            <label>
              <span>Import mode</span>
              <select value={importMode} onChange={(event) => setImportMode(event.target.value as typeof importMode)}>
                <option value="append">Append</option>
                <option value="merge">Merge</option>
                <option value="replace">Replace</option>
                <option value="new_dataset">Create New Dataset</option>
              </select>
            </label>
          </div>

          {sourcesError && <p className="ingestion-warning">{sourcesError}. You can still type a source id.</p>}

          <button className="ingestion-primary" onClick={upload} disabled={!file || !sourceId.trim() || phase === 'uploading' || phase === 'committing'}>
            {phase === 'uploading' ? 'Analyzing source...' : 'Upload and preview'}
            <ArrowRight size={16} />
          </button>
        </section>

        <section className="ingestion-card">
          <div className="ingestion-card-head">
            <div>
              <span>AI analysis</span>
              <h2>Schema profile</h2>
            </div>
            {preview && <span className="ingestion-status">Preview only</span>}
          </div>

          {!preview ? (
            <div className="ingestion-empty">
              <SearchCheck size={30} />
              <strong>No source analyzed yet</strong>
              <p>The pipeline will show schema, duplicate header checks, mapping quality, and sample rows after upload.</p>
            </div>
          ) : (
            <div className="ingestion-analysis">
              <div className="ingestion-profile">
                <div><strong>{preview.row_count}</strong><span>Rows detected</span></div>
                <div><strong>{preview.headers.length}</strong><span>Fields detected</span></div>
                <div><strong>{profile?.quality ?? 0}%</strong><span>Auto-map coverage</span></div>
                <div><strong>{profile?.duplicateHeaders ?? 0}</strong><span>Duplicate headers</span></div>
              </div>

              {preview.schema && (
                <>
                  <div className="ingestion-schema-summary">
                    <div>
                      <span>Dataset</span>
                      <strong>{preview.schema.dataset_type}</strong>
                    </div>
                    <div>
                      <span>Domain</span>
                      <strong>{preview.schema.domain}</strong>
                    </div>
                    <div>
                      <span>Confidence</span>
                      <strong>{Math.round(preview.schema.confidence * 100)}%</strong>
                    </div>
                  </div>

                  {preview.schema.primary_key_candidates.length > 0 && (
                    <div className="ingestion-schema-block">
                      <span>Primary key candidates</span>
                      <div className="ingestion-chip-row">
                        {preview.schema.primary_key_candidates.map((candidate) => <code key={candidate}>{candidate}</code>)}
                      </div>
                    </div>
                  )}

                  {schemaColumns.length > 0 && (
                    <div className="ingestion-column-list">
                      {schemaColumns.map(([name, column]) => (
                        <article key={name}>
                          <div>
                            <strong>{name}</strong>
                            <span>{column.inferred_type}</span>
                          </div>
                          <small>{column.unique_count} unique, {Math.round(column.null_fraction * 100)}% empty</small>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {preview && (
        <section className="ingestion-card">
          <div className="ingestion-card-head">
            <div>
              <span>Mapping studio</span>
              <h2>Auto mapping and validation</h2>
            </div>
            <button className="eb-pill-btn" onClick={autoMap}><Wand2 size={14} /> Auto Mapping</button>
          </div>

          <div className="ingestion-mapping-grid">
            {CANONICAL_FIELDS.map((field) => {
              const required = REQUIRED_FIELDS.includes(field);
              const missing = required && !map[field];
              return (
                <label key={field} data-missing={missing ? 'true' : undefined}>
                  <span>
                    {field}{required ? ' *' : ''}
                    <small>{FIELD_HELP[field]}</small>
                  </span>
                  <select value={map[field] ?? NOT_MAPPED} onChange={(event) => setMap((current) => ({ ...current, [field]: event.target.value }))}>
                    <option value={NOT_MAPPED}>Not mapped</option>
                    {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              );
            })}
          </div>

          <div className="ingestion-validation-row">
            <label>
              <input type="checkbox" checked={saveMap} onChange={(event) => setSaveMap(event.target.checked)} />
              Save mapping for this source
            </label>
            <span>{profile?.committable ? 'Required fields mapped' : `Map ${REQUIRED_FIELDS.filter((field) => !map[field]).join(' and ')} before commit`}</span>
          </div>
        </section>
      )}

      {preview && (
        <section className="ingestion-card">
          <div className="ingestion-card-head">
            <div>
              <span>Preview</span>
              <h2>Sample records</h2>
            </div>
            <span className="ingestion-status">{preview.sync_type}</span>
          </div>
          <div className="ingestion-preview-table">
            <table>
              <thead>
                <tr>{preview.headers.map((header) => <th key={header}>{header}</th>)}</tr>
              </thead>
              <tbody>
                {preview.sample_rows.map((row, index) => (
                  <tr key={index}>
                    {preview.headers.map((header) => <td key={header}>{String(row[header] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ingestion-commit-row">
            <p>Mode: <strong>{importMode.replace('_', ' ')}</strong>. Current backend commits reviewed rows into Signals and Evidence; dataset/table creation remains a governed backend workflow.</p>
            <button className="ingestion-primary" onClick={commit} disabled={!profile?.committable || phase === 'committing'}>
              {phase === 'committing' ? 'Committing...' : `Commit ${preview.row_count} rows`}
              <CheckCircle2 size={16} />
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="ingestion-card ingestion-result">
          <div>
            <span>{result.status === 'queued' ? 'Queued' : 'Completed'}</span>
            <h2>{result.status === 'queued' ? `${result.total_rows ?? 0} rows queued` : `${result.committed} committed, ${result.errors} errors, ${result.skipped} skipped`}</h2>
            <p>{result.status === 'queued' ? result.message ?? 'Track this import job from the import center.' : `Job ${jobId}. Created signal ids are shown for traceability.`}</p>
          </div>
          <div className="ingestion-signal-list">
            {result.signal_ids.length > 0 ? result.signal_ids.map((id) => <code key={id}>{id}</code>) : <span>No signal ids returned yet.</span>}
          </div>
        </section>
      )}
    </div>
  );
}
