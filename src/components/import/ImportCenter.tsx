import React, { useState, useEffect } from 'react';
import { api } from '../../api/imports';
import ImportPreview from './ImportPreview';

interface ImportCenterProps {
  entityType: string;
  orgId: string;
}

export default function ImportCenter({ entityType, orgId }: ImportCenterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<string>('csv');
  const [activeImports, setActiveImports] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActiveImports();
  }, [orgId]);

  const loadActiveImports = async () => {
    try {
      const data = await api.getActiveImports(orgId);
      setActiveImports(data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewData(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.previewImport(orgId, {
        entityType,
        importType,
        fileName: file.name,
      });
      setPreviewData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.startImport(orgId, {
        entityType,
        importType,
        fileName: file?.name,
        preview: previewData,
      });
      setFile(null);
      setPreviewData(null);
      loadActiveImports();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Import Center</h2>

      <div style={{ marginBottom: 24, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3 style={{ marginBottom: 12 }}>New Import</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>File</label>
          <input
            type="file"
            onChange={handleFileChange}
            style={{ width: '100%', padding: 8 }}
          />
          {file && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--content-secondary)' }}>{file.name}</div>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Import Type</label>
          <select
            value={importType}
            onChange={(e) => setImportType(e.target.value)}
            style={{ width: '100%', padding: 8 }}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="xlsx">Excel</option>
          </select>
        </div>

        <button
          onClick={handlePreview}
          disabled={!file || loading}
          style={{
            padding: '8px 16px',
            background: 'var(--chart-1)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: !file || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Loading...' : 'Start Import'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: 'var(--feedback-error-surface)', color: 'var(--feedback-error-content)', borderRadius: 4 }}>
          {error}
        </div>
      )}

      {previewData && (
        <ImportPreview
          previewData={previewData}
          onConfirm={handleConfirm}
          onCancel={() => setPreviewData(null)}
        />
      )}

      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Active Imports</h3>
        {activeImports.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--content-secondary)' }}>No active imports</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>File</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Type</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Status</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {activeImports.map((imp) => (
                <tr key={imp.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{imp.fileName}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{imp.entityType}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}><ImportStatus status={imp.status} /></td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <ImportProgress status={imp.status} processed={Number(imp.processedRows ?? 0)} total={Number(imp.totalRows ?? 0)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/**
 * An import's status, said in words rather than shown as a raw enum.
 *
 * WHY THIS IS NOT COSMETIC. `queued` and `completed` rendered as bare lowercase
 * strings in the same column look equally final, and a queued job whose worker
 * is not running looks exactly like a finished one — which is how this
 * installation came to have a 388,401-row import sitting at 308,000 with nobody
 * aware it had stopped. Each state now says what it means for the DATA:
 * whether anything has been written yet, and whether more is coming.
 */
function ImportStatus({ status }: { status: string }) {
  const key = String(status ?? '').toLowerCase();

  const meta: Record<string, { label: string; detail: string; tone: string }> = {
    previewed: { label: 'Previewed', detail: 'Read and mapped. Nothing written yet.', tone: 'var(--content-secondary)' },
    queued: { label: 'Queued', detail: 'Accepted, not started. Needs a queue worker running.', tone: 'var(--content-secondary)' },
    processing: { label: 'Processing', detail: 'Writing rows now.', tone: 'var(--accent-intelligence-deep)' },
    completed: { label: 'Completed', detail: 'Every row written.', tone: 'var(--feedback-success-content, green)' },
    completed_with_errors: { label: 'Completed with errors', detail: 'Some rows were rejected — see the import log.', tone: 'var(--feedback-warning-content, darkorange)' },
    failed: { label: 'Failed', detail: 'Nothing usable was written.', tone: 'var(--feedback-error-content, crimson)' },
    cancelled: { label: 'Cancelled', detail: 'Stopped before completing.', tone: 'var(--content-tertiary)' },
  };

  const info = meta[key] ?? { label: status || 'Unknown', detail: '', tone: 'var(--content-secondary)' };

  return (
    <span title={info.detail}>
      <strong style={{ color: info.tone }}>{info.label}</strong>
      {info.detail && <small style={{ display: 'block', color: 'var(--content-tertiary)', fontSize: 11.5 }}>{info.detail}</small>}
    </span>
  );
}

/**
 * Progress that cannot be mistaken for completion.
 *
 * A queued job has processed zero rows, and "0 / 388,401" beside a bar at zero
 * is honest. A finished job shows its own total. The percentage is only drawn
 * when there is a total to divide by.
 */
function ImportProgress({ status, processed, total }: { status: string; processed: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : null;
  const running = ['processing', 'queued'].includes(String(status).toLowerCase());

  return (
    <span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {processed.toLocaleString()} / {total.toLocaleString()}
        {pct !== null && <> · {pct}%</>}
      </span>
      {pct !== null && (
        <span style={{ display: 'block', height: 5, marginTop: 4, borderRadius: 999, background: 'var(--surface-inset)', overflow: 'hidden' }}>
          <span style={{
            display: 'block', height: '100%', width: `${pct}%`, borderRadius: 999,
            background: running ? 'var(--accent-intelligence-deep)' : 'var(--content-tertiary)',
          }} />
        </span>
      )}
    </span>
  );
}
