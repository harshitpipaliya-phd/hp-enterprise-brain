import { useState } from 'react';
import type { Capability } from './CapabilityApp';
import { api } from '../../api/capability';

interface Props {
  capabilities: Capability[];
  loading: boolean;
  onSelect: (cap: Capability) => void;
  onEdit: (cap: Capability) => void;
  onArchive: (cap: Capability) => void;
  onAssign: (cap: Capability) => void;
  tenantId: string;
}

export default function CapabilityList({ capabilities, loading, onSelect, onEdit, onArchive, onAssign, tenantId }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Capability[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const doSearch = async () => {
    if (!search.trim()) { setResults([]); return; }
    setSearching(true);
    setSearchError(null);
    try {
      const data = await api.searchCapabilities(tenantId, search);
      setResults(Array.isArray(data) ? data : []);
    } catch (e: any) {
      // A failed search used to render as an empty result set, which reads as
      // "no matches" rather than "the request failed".
      setSearchError(e.message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code..." style={{ flex: 1, padding: 8 }} />
        <button onClick={doSearch} disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
        <button onClick={() => { setSearch(''); setResults([]); setSearchError(null); }}>Clear</button>
      </div>
      {searchError && <div style={{ color: 'var(--status-crit)', marginBottom: 12 }}>Search failed: {searchError}</div>}
      {loading && <div>Loading...</div>}
      {!loading && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Code</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Name</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Category</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Type</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Version</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Status</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(search ? results : capabilities).map((cap) => (
              <tr key={cap.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{cap.capabilityCode}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); onSelect(cap); }}>{cap.name}</a>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{cap.category}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{cap.capabilityType}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>v{cap.version}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{cap.status}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>
                  <button onClick={() => onEdit(cap)}>Edit</button>
                  <button onClick={() => onAssign(cap)} style={{ marginLeft: 8 }}>Assign</button>
                  <button onClick={() => onArchive(cap)} style={{ marginLeft: 8 }}>Archive</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
