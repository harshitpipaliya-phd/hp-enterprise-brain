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
            background: '#2563eb',
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
        <div style={{ padding: 12, marginBottom: 16, background: '#fee2e2', color: '#b91c1c', borderRadius: 4 }}>
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
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{imp.status}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    {imp.processedRows} / {imp.totalRows}
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
