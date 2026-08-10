
interface ImportPreviewProps {
  previewData: any;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ImportPreview({ previewData, onConfirm, onCancel }: ImportPreviewProps) {
  const rows = Array.isArray(previewData?.rows) ? previewData.rows : [];

  const validCount = rows.filter((r: any) => r.status === 'valid').length;
  const invalidCount = rows.filter((r: any) => r.status === 'invalid').length;
  const duplicateCount = rows.filter((r: any) => r.status === 'duplicate').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return { bg: 'var(--feedback-success-surface)', text: 'var(--feedback-success-content)' };
      case 'invalid':
        return { bg: 'var(--feedback-error-surface)', text: 'var(--feedback-error-content)' };
      case 'duplicate':
        return { bg: 'var(--feedback-warning-surface)', text: 'var(--feedback-warning-content)' };
      default:
        return { bg: 'var(--surface-inset)', text: 'var(--content-primary)' };
    }
  };

  return (
    <div style={{ marginTop: 16, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
      <h3 style={{ marginBottom: 12 }}>Preview</h3>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ padding: 8, background: 'var(--surface-inset)', borderRadius: 4 }}>
          <strong>Total:</strong> {rows.length}
        </div>
        <div style={{ padding: 8, background: 'var(--feedback-success-surface)', borderRadius: 4, color: 'var(--feedback-success-content)' }}>
          <strong>Valid:</strong> {validCount}
        </div>
        <div style={{ padding: 8, background: 'var(--feedback-error-surface)', borderRadius: 4, color: 'var(--feedback-error-content)' }}>
          <strong>Invalid:</strong> {invalidCount}
        </div>
        <div style={{ padding: 8, background: 'var(--feedback-warning-surface)', borderRadius: 4, color: 'var(--feedback-warning-content)' }}>
          <strong>Duplicates:</strong> {duplicateCount}
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--content-secondary)' }}>No rows to preview</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Row</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Data</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, idx: number) => {
              const status = row.status || 'valid';
              const colors = getStatusColor(status);
              return (
                <tr key={idx}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.rowNumber ?? idx + 1}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <div>{JSON.stringify(row.data || row)}</div>
                    {row.errorMessage && (
                      <div style={{ color: 'var(--feedback-error-content)', fontSize: 12, marginTop: 2 }}>{row.errorMessage}</div>
                    )}
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: colors.bg,
                      color: colors.text,
                      fontSize: 12,
                      textTransform: 'capitalize',
                    }}>
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            background: 'var(--surface-inset)',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: '8px 16px',
            background: 'var(--chart-1)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Confirm Import
        </button>
      </div>
    </div>
  );
}
