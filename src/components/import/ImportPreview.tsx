
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
        return { bg: '#dcfce7', text: '#166534' };
      case 'invalid':
        return { bg: '#fee2e2', text: '#991b1b' };
      case 'duplicate':
        return { bg: '#fef9c3', text: '#854d0e' };
      default:
        return { bg: '#f3f4f6', text: '#374151' };
    }
  };

  return (
    <div style={{ marginTop: 16, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
      <h3 style={{ marginBottom: 12 }}>Preview</h3>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ padding: 8, background: '#f9fafb', borderRadius: 4 }}>
          <strong>Total:</strong> {rows.length}
        </div>
        <div style={{ padding: 8, background: '#dcfce7', borderRadius: 4, color: '#166534' }}>
          <strong>Valid:</strong> {validCount}
        </div>
        <div style={{ padding: 8, background: '#fee2e2', borderRadius: 4, color: '#991b1b' }}>
          <strong>Invalid:</strong> {invalidCount}
        </div>
        <div style={{ padding: 8, background: '#fef9c3', borderRadius: 4, color: '#854d0e' }}>
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
                      <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 2 }}>{row.errorMessage}</div>
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
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
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
            background: '#2563eb',
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
