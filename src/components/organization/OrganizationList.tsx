import type { Organization } from '../../App';

interface Props {
  organizations: Organization[];
  loading: boolean;
  onSelect: (org: Organization) => void;
  onEdit: (org: Organization) => void;
  onArchive: (org: Organization) => void;
}

export default function OrganizationList({ organizations, loading, onSelect, onEdit, onArchive }: Props) {
  if (loading) return <div>Loading...</div>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Name</th>
          <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Code</th>
          <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Industry</th>
          <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Country</th>
          <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Status</th>
          <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {organizations.map((org) => (
          <tr key={org.id}>
            <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); onSelect(org); }}>{org.name}</a>
            </td>
            <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{org.orgCode}</td>
            <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{org.industry}</td>
            <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{org.country}</td>
            <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{org.status}</td>
            <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>
              <button onClick={() => onEdit(org)}>Edit</button>
              <button onClick={() => onArchive(org)} style={{ marginLeft: 8 }}>Archive</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
