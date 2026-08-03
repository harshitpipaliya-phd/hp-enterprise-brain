interface Props {
  unit: any;
  onEdit: (unit: any) => void;
  onDelete: (unit: any) => void;
  onAddChild: (parentId: string) => void;
  children?: any[];
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export default function OrgUnitCard({ unit, onEdit, onDelete, onAddChild, children = [], expanded = false, onToggleExpand }: Props) {
  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: 4,
        padding: 12,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {children.length > 0 && (
            <button
              onClick={onToggleExpand}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
            >
              {expanded ? '▼' : '▶'}
            </button>
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{unit.name}</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {unit.unitType ?? 'Unit'} {unit.code ? `· ${unit.code}` : ''} {unit.head ? `· Head: ${unit.head}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onEdit(unit)} style={{ fontSize: 12 }}>Edit</button>
          <button onClick={() => onDelete(unit)} style={{ fontSize: 12, color: '#c00' }}>Delete</button>
          <button onClick={() => onAddChild(unit.id)} style={{ fontSize: 12 }}>Add Child</button>
        </div>
      </div>
    </div>
  );
}
