import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck, FileArchive, FileCode2, FileImage, FileJson, FileSpreadsheet, FileText, ListChecks, Radio, RefreshCw, SearchCheck, ShieldCheck, UploadCloud, Wand2 } from 'lucide-react';
import { CANONICAL_FIELDS, REQUIRED_FIELDS, ingestionApi } from '../../api/ingestion';
import type { CanonicalField, CommitResponse, DataSourceRow, IngestionPreview } from '../../api/ingestion';
import { ApiError } from '../../api/client';
import { useToast } from '../Toast';
import type { View } from '../../App';
import './IngestionWorkspace.css';

const ACCEPTED = '.csv,.xls,.xlsx,.pdf,.doc,.docx,.txt,.json,.xml,.html,.htm,.md,.markdown,.zip,.sql,.png,.jpg,.jpeg';

/**
 * The steps this engine actually performs, in the order it performs them.
 *
 * WHAT WAS HERE BEFORE: a six-stage strip reading Extract → Clean → Detect
 * Schema → Relationships → Embeddings → AI Insights, lit progressively as the
 * user moved through the form. Three of those six stages do not exist. Nothing
 * in this codebase computes an embedding, infers a relationship graph or
 * generates an AI insight during ingestion; `upload()` parses the file and
 * proposes a field map, and `commit()` writes Signals and Evidence. So the strip
 * showed a user their file passing through an embedding stage that was never
 * reached, and lit "AI Insights" green on a commit that produced none.
 *
 * These six are the six the code runs, and each one names the thing the user
 * does or sees at that point.
 */
const STEPS = [
  { id: 'choose', label: 'Choose a file', icon: <UploadCloud />, detail: 'Pick the file and name the source it belongs to.' },
  { id: 'preview', label: 'Preview', icon: <SearchCheck />, detail: 'We read the file and show you its columns and first rows.' },
  { id: 'map', label: 'Map fields', icon: <Wand2 />, detail: 'Tell us which of your columns holds each piece of information.' },
  { id: 'validate', label: 'Validate', icon: <ShieldCheck />, detail: 'Required fields must be mapped before anything is written.' },
  { id: 'commit', label: 'Import', icon: <ClipboardCheck />, detail: 'Rows are written as Signals with their Evidence attached.' },
  { id: 'result', label: 'Result', icon: <ListChecks />, detail: 'How many rows were imported, skipped or rejected.' },
];

const FIELD_LABELS: Record<CanonicalField, { name: string; help: string }> = {
  title: { name: 'Title', help: 'Names the signal, and is used to detect duplicates.' },
  state: { name: 'Category', help: 'How the signal is classified.' },
  owner: { name: 'Owner', help: 'Who is accountable for this row.' },
  evidence_text: { name: 'Evidence text', help: 'The supporting detail stored with the signal.' },
  evidence_timestamp: { name: 'Observed at', help: 'When this was observed, used for freshness.' },
  external_ref: { name: 'Source reference', help: 'A stable id in your system, so re-imports match.' },
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
  if (code === 'unreadable_upload') return `Could not read the file — ${detail}`;
  if (code === 'incomplete_field_map') return `Validation failed — ${detail}`;
  if (code === 'database_unavailable') return `Database unavailable — ${detail}`;
  if (code === 'source_unavailable') return `Import failed — ${detail}`;
  if (code === 'job_not_previewed') return `Import failed — ${detail}`;

  // A 422 with field errors is validation, whatever stage we thought we were in.
  if (api?.status === 422) return `Validation failed — ${detail}`;
  if (api?.status === 401 || api?.status === 403) return `Not authorised — ${detail}`;

  const stage = assumedStage === 'ingestion' ? 'Import failed' : 'Upload failed';

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

export default function IngestionWorkspace({ tenantId, onNavigate }: { tenantId: string; onNavigate?: (view: View) => void }) {
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [sources, setSources] = useState<DataSourceRow[]>([]);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState('');
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
        setSourcesError(e?.message ?? 'Could not load previously used sources.');
      });
    return () => { cancelled = true; };
  }, [tenantId]);

  const fileKind = useMemo(() => {
    const ext = file?.name.split('.').pop()?.toUpperCase() || 'FILE';
    if (['CSV', 'XLS', 'XLSX'].includes(ext)) return { ext, icon: <FileSpreadsheet />, label: 'spreadsheet' };
    if (['JSON'].includes(ext)) return { ext, icon: <FileJson />, label: 'structured document' };
    if (['XML', 'HTML', 'HTM', 'SQL'].includes(ext)) return { ext, icon: <FileCode2 />, label: 'structured text' };
    if (['PNG', 'JPG', 'JPEG'].includes(ext)) return { ext, icon: <FileImage />, label: 'image' };
    if (['ZIP'].includes(ext)) return { ext, icon: <FileArchive />, label: 'archive' };
    return { ext, icon: <FileText />, label: 'document' };
  }, [file]);

  const missingRequired = useMemo(
    () => REQUIRED_FIELDS.filter((field) => !map[field]),
    [map],
  );

  const profile = useMemo(() => {
    if (!preview) return null;
    return {
      mapped: CANONICAL_FIELDS.filter((field) => map[field]).length,
      duplicateHeaders: preview.headers.length - new Set(preview.headers).size,
      committable: missingRequired.length === 0,
    };
  }, [map, missingRequired, preview]);

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
      for (const field of CANONICAL_FIELDS) seeded[field] = normalizedPreview.suggested_map?.[field] ?? '';
      setJobId(data.job_id);
      setPreview(normalizedPreview);
      setMap(seeded);
      setPhase('previewed');
      showToast('info', `Read ${normalizedPreview.row_count.toLocaleString()} row${normalizedPreview.row_count === 1 ? '' : 's'}. Nothing has been imported yet.`);
    } catch (e: any) {
      setPhase('idle');
      showToast('error', describeStageFailure(e));
    }
  };

  const autoMap = () => {
    if (!preview) return;
    const next: Record<string, string> = {};
    for (const field of CANONICAL_FIELDS) next[field] = preview.suggested_map?.[field] ?? '';
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
      showToast(
        'success',
        data.status === 'queued'
          ? `${(data.total_rows ?? preview?.row_count ?? 0).toLocaleString()} rows queued for import.`
          : `Imported ${data.committed.toLocaleString()} signals.`,
      );
    } catch (e: any) {
      setPhase('previewed');
      showToast('error', describeStageFailure(e, 'ingestion'));
    }
  };

  // Which of the six steps the user has reached. Derived from the phase the
  // engine is actually in, so no step lights up before its work has run.
  const activeStep = phase === 'committed'
    ? 5
    : phase === 'committing'
      ? 4
      : phase === 'previewed'
        ? (profile?.committable ? 3 : 2)
        : phase === 'uploading'
          ? 1
          : 0;

  return (
    <div className="ingestion-page">
      <section className="ingestion-hero">
        <div>
          <h1>Ingestion Engine</h1>
          <p>
            Bring this organization&apos;s data in from a file. Every row you import becomes a Signal with its
            Evidence attached, which is what the rest of the workspace reasons over. Nothing is written until
            you have seen the preview and confirmed the field mapping.
          </p>
        </div>
      </section>

      <section className="ingestion-pipeline" aria-label="Import steps">
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            className="ingestion-pipeline-step"
            data-active={index <= activeStep ? 'true' : undefined}
            data-current={index === activeStep ? 'true' : undefined}
          >
            <span>{step.icon}</span>
            <strong>{index + 1}. {step.label}</strong>
            <small>{step.detail}</small>
          </div>
        ))}
      </section>

      <div className="ingestion-layout">
        <section className="ingestion-card ingestion-upload-card">
          <div className="ingestion-card-head">
            <div>
              <span>Step 1</span>
              <h2>Choose a file</h2>
            </div>
            <button className="eb-pill-btn" onClick={reset} disabled={phase === 'uploading' || phase === 'committing'}>
              <RefreshCw size={14} /> Start over
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
            <strong>{file ? file.name : 'Drop a file here, or click to browse'}</strong>
            <small>
              {file
                ? `${fileKind.ext} ${fileKind.label} · ${(file.size / 1024).toFixed(1)} KB`
                : 'CSV, Excel, PDF, Word, JSON, XML, HTML, Markdown, SQL, images and ZIP archives'}
            </small>
          </button>

          <label className="ingestion-source-field">
            <span>Source name</span>
            <input
              list="ingestion-source-ids"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              placeholder="monthly-fee-export"
            />
            <datalist id="ingestion-source-ids">
              {sources.map((source) => <option key={source.source_key} value={source.source_key}>{source.display_name}</option>)}
            </datalist>
            <small>
              Groups this file with previous imports of the same kind, so a saved field mapping can be reused.
              {sources.length > 0 ? ` ${sources.length} source${sources.length === 1 ? '' : 's'} already used here.` : ''}
            </small>
          </label>

          {sourcesError && <p className="ingestion-warning">{sourcesError} You can still type a new source name.</p>}

          <button className="ingestion-primary" onClick={upload} disabled={!file || !sourceId.trim() || phase === 'uploading' || phase === 'committing'}>
            {phase === 'uploading' ? 'Reading the file…' : 'Upload and preview'}
            <ArrowRight size={16} />
          </button>
        </section>

        <section className="ingestion-card">
          <div className="ingestion-card-head">
            <div>
              <span>Step 2</span>
              <h2>What we found in the file</h2>
            </div>
            {preview && <span className="ingestion-status">Nothing imported yet</span>}
          </div>

          {!preview ? (
            <div className="ingestion-empty">
              <SearchCheck size={30} />
              <strong>No file read yet</strong>
              <p>Upload a file and this panel will show how many rows and columns it holds, what kind of data it looks like, and how complete each column is.</p>
            </div>
          ) : (
            <div className="ingestion-analysis">
              <div className="ingestion-profile">
                <div><strong>{preview.row_count.toLocaleString()}</strong><span>Rows in the file</span></div>
                <div><strong>{preview.headers.length}</strong><span>Columns found</span></div>
                <div><strong>{profile?.mapped ?? 0} / {CANONICAL_FIELDS.length}</strong><span>Fields mapped</span></div>
                <div><strong>{profile?.duplicateHeaders ?? 0}</strong><span>Repeated column names</span></div>
              </div>

              {preview.schema && (
                <>
                  <div className="ingestion-schema-summary">
                    <div>
                      <span>Looks like</span>
                      <strong>{preview.schema.dataset_type || 'Unrecognised'}</strong>
                    </div>
                    <div>
                      <span>Subject area</span>
                      <strong>{preview.schema.domain || 'Unrecognised'}</strong>
                    </div>
                    <div>
                      <span>How sure</span>
                      <strong>{Math.round((preview.schema.confidence ?? 0) * 100)}%</strong>
                    </div>
                  </div>

                  {schemaColumns.length > 0 && (
                    <div className="ingestion-column-list">
                      {schemaColumns.map(([name, column]) => (
                        <article key={name}>
                          <div>
                            <strong>{name}</strong>
                            <span>{column.inferred_type}</span>
                          </div>
                          <small>{column.unique_count.toLocaleString()} distinct values · {Math.round(column.null_fraction * 100)}% empty</small>
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
              <span>Step 3</span>
              <h2>Map your columns to the fields we store</h2>
            </div>
            <button className="eb-pill-btn" onClick={autoMap}><Wand2 size={14} /> Use suggested mapping</button>
          </div>

          <div className="ingestion-mapping-grid">
            {CANONICAL_FIELDS.map((field) => {
              const required = REQUIRED_FIELDS.includes(field);
              const missing = required && !map[field];
              return (
                <label key={field} data-missing={missing ? 'true' : undefined}>
                  <span>
                    {FIELD_LABELS[field].name}{required ? ' (required)' : ''}
                    <small>{FIELD_LABELS[field].help}</small>
                  </span>
                  <select value={map[field] ?? ''} onChange={(event) => setMap((current) => ({ ...current, [field]: event.target.value }))}>
                    <option value="">Not mapped</option>
                    {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              );
            })}
          </div>

          <div className="ingestion-validation-row">
            <label>
              <input type="checkbox" checked={saveMap} onChange={(event) => setSaveMap(event.target.checked)} />
              Remember this mapping for the next file from this source
            </label>
            <span data-ok={profile?.committable ? 'true' : undefined}>
              {profile?.committable
                ? 'All required fields are mapped. You can import.'
                : `Map ${missingRequired.map((f) => FIELD_LABELS[f].name).join(' and ')} before importing.`}
            </span>
          </div>
        </section>
      )}

      {preview && (
        <section className="ingestion-card">
          <div className="ingestion-card-head">
            <div>
              <span>Steps 4 and 5</span>
              <h2>Check the first rows, then import</h2>
            </div>
            {preview.sync_type && <span className="ingestion-status">{preview.sync_type}</span>}
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
            <p>
              Importing writes one Signal per row, with the mapped evidence text attached to it. Rows that
              already exist under the same source reference are skipped rather than duplicated.
            </p>
            <button className="ingestion-primary" onClick={commit} disabled={!profile?.committable || phase === 'committing'}>
              {phase === 'committing' ? 'Importing…' : `Import ${preview.row_count.toLocaleString()} rows`}
              <CheckCircle2 size={16} />
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="ingestion-card ingestion-result">
          <div>
            <span>Step 6</span>
            <h2>
              {result.status === 'queued'
                ? `${(result.total_rows ?? 0).toLocaleString()} rows queued for import`
                : `${result.committed.toLocaleString()} imported`}
            </h2>
            <p>
              {result.status === 'queued'
                ? result.message ?? 'This file is large enough to import in the background. It will keep going after you leave this page.'
                : `${result.skipped.toLocaleString()} skipped as already present, ${result.errors.toLocaleString()} rejected.`}
            </p>
          </div>
          {result.status !== 'queued' && result.committed > 0 && onNavigate && (
            <button className="ingestion-primary" onClick={() => onNavigate('signals')}>
              <Radio size={16} /> View the imported signals
            </button>
          )}
        </section>
      )}
    </div>
  );
}
