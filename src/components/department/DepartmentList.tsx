import type { Department } from './DepartmentApp';

interface Props {
  departments: Department[];
  loading: boolean;
  onSelect: (dept: Department) => void;
  onEdit: (dept: Department) => void;
  onArchive: (dept: Department) => void;
}

export default function DepartmentList({ departments, loading, onSelect, onEdit, onArchive }: Props) {
  if (loading) return <div>Loading...</div>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Name</th>
          <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Type</th>
          <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Head</th>
          <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Status</th>
          <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {departments.map((dept) => (
          <tr key={dept.id}>
            <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); onSelect(dept); }}>{dept.name}</a>
            </td>
            <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{dept.departmentType}</td>
            <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{dept.headId ?? '—'}</td>
            <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{dept.status}</td>
            <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>
              <button onClick={() => onEdit(dept)}>Edit</button>
              <button onClick={() => onArchive(dept)} style={{ marginLeft: 8 }}>Archive</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
