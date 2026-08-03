
interface ImportLogProps {
  logs: any[];
}

export default function ImportLog({ logs }: ImportLogProps) {
  const validLogs = Array.isArray(logs) ? logs : [];

  const getActionColor = (action: string) => {
    switch (action?.toLowerCase()) {
      case 'created':
        return '#dcfce7';
      case 'updated':
        return '#dbeafe';
      case 'skipped':
        return '#f3f4f6';
      case 'error':
        return '#fee2e2';
      case 'duplicate':
        return '#fef9c3';
      default:
        return '#f3f4f6';
    }
  };

  return (
    <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
      <h3 style={{ marginBottom: 12 }}>Import Log</h3>
      {validLogs.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--content-secondary)' }}>No logs available</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Row</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Action</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Message</th>
            </tr>
          </thead>
          <tbody>
            {validLogs.map((log, idx) => (
              <tr key={idx}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{log.rowNumber ?? idx + 1}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: getActionColor(log.action),
                    fontSize: 12,
                    textTransform: 'capitalize',
                  }}>
                    {log.action}
                  </span>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{log.message || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
