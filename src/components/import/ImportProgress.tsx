
interface ImportProgressProps {
  job: any;
}

export default function ImportProgress({ job }: ImportProgressProps) {
  const total = Number(job.totalRows ?? 0);
  const processed = Number(job.processedRows ?? 0);
  const success = Number(job.successCount ?? 0);
  const errors = Number(job.errorCount ?? 0);
  const duplicates = Number(job.duplicateCount ?? 0);
  const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
      <h3 style={{ marginBottom: 12 }}>Import Progress</h3>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--content-secondary)' }}>{processed} / {total} rows</span>
          <span style={{ fontSize: 12, color: 'var(--content-secondary)' }}>{progress}%</span>
        </div>
        <div style={{ width: '100%', height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#2563eb' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ padding: 12, background: '#dcfce7', borderRadius: 4, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#166534' }}>{success}</div>
          <div style={{ fontSize: 12, color: '#166534' }}>Success</div>
        </div>
        <div style={{ padding: 12, background: '#fee2e2', borderRadius: 4, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#991b1b' }}>{errors}</div>
          <div style={{ fontSize: 12, color: '#991b1b' }}>Errors</div>
        </div>
        <div style={{ padding: 12, background: '#fef9c3', borderRadius: 4, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#854d0e' }}>{duplicates}</div>
          <div style={{ fontSize: 12, color: '#854d0e' }}>Duplicates</div>
        </div>
      </div>
    </div>
  );
}
