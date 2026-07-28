import { useState } from 'react';
import type { Person } from './PersonApp';
import { api } from '../../api/person';

interface Props {
  people: Person[];
  loading: boolean;
  onSelect: (person: Person) => void;
  onEdit: (person: Person) => void;
  onArchive: (person: Person) => void;
  tenantId: string;
}

export default function PersonList({ people, loading, onSelect, onEdit, onArchive, tenantId }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = async () => {
    if (!search.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await api.searchPeople(tenantId, search);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or employee ID..." style={{ flex: 1, padding: 8 }} />
        <button onClick={doSearch} disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
        <button onClick={() => { setSearch(''); setResults([]); }}>Clear</button>
      </div>
      {loading && <div>Loading...</div>}
      {!loading && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Name</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Employee ID</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Email</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Department</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Status</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(search ? results : people).map((person) => (
              <tr key={person.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); onSelect(person); }}>{person.displayName || `${person.firstName} ${person.lastName}`}</a>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{person.employeeId}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{person.email}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{person.departmentId ?? '—'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{person.status}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>
                  <button onClick={() => onEdit(person)}>Edit</button>
                  <button onClick={() => onArchive(person)} style={{ marginLeft: 8 }}>Archive</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
