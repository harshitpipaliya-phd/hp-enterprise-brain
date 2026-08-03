
interface ImportErrorReportProps {
  errors: any[];
}

export default function ImportErrorReport({ errors }: ImportErrorReportProps) {
  const validErrors = Array.isArray(errors) ? errors : [];

  return (
    <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
      <h3 style={{ marginBottom: 12 }}>Error Report</h3>
      {validErrors.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--content-secondary)' }}>No errors reported</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Row</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Message</th>
            </tr>
          </thead>
          <tbody>
            {validErrors.map((err, idx) => (
              <tr key={idx}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', color: '#991b1b' }}>{err.rowNumber ?? idx + 1}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{err.message || JSON.stringify(err)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
