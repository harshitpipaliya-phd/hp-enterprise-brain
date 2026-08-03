interface Props {
  reporter: any;
  reportee: any;
  type?: string;
}

export default function ReportingLine({ reporter, reportee, type }: Props) {
  const rx = reporter.x ?? 0;
  const ry = reporter.y ?? 0;
  const px = reportee.x ?? 0;
  const py = reportee.y ?? 0;


  const color = type === 'dotted' ? '#888' : '#333';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        style={{
          position: 'absolute',
          left: rx - 4,
          top: ry - 4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#333',
        }}
      />
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <line
          x1={rx}
          y1={ry}
          x2={px}
          y2={py}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray={type === 'dotted' ? '4 4' : 'none'}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: px - 4,
          top: py - 4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#333',
        }}
      />
    </div>
  );
}
