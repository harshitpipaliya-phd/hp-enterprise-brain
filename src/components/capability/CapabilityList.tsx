import { useMemo, useState } from 'react';
import { Archive, ArrowRight, Boxes, CircleGauge, Filter, Search, ShieldAlert, Tag, Target } from 'lucide-react';
import type { Capability } from './CapabilityApp';
import { api } from '../../api/capability';
import './CapabilityList.css';

interface Props { capabilities: Capability[]; loading: boolean; onSelect: (cap: Capability) => void; onEdit: (cap: Capability) => void; onArchive: (cap: Capability) => void; onAssign: (cap: Capability) => void; tenantId: string; }

export default function CapabilityList({ capabilities, loading, onSelect, onEdit, onArchive, onAssign, tenantId }: Props) {
<<<<<<< HEAD
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
=======
  const [search, setSearch] = useState(''); const [results, setResults] = useState<Capability[] | null>(null); const [type, setType] = useState('all'); const [criticality, setCriticality] = useState('all'); const [searching, setSearching] = useState(false); const [searchError, setSearchError] = useState<string | null>(null);
  const doSearch = async () => { if (!search.trim()) { setResults(null); return; } setSearching(true); setSearchError(null); try { setResults(await api.searchCapabilities(tenantId, search)); } catch (e:any) { setSearchError(e.message); setResults([]); } finally { setSearching(false); } };
  const visible = useMemo(() => (results ?? capabilities).filter((cap) => (type === 'all' || cap.capabilityType === type) && (criticality === 'all' || cap.criticality === criticality)), [results, capabilities, type, criticality]);
  const active = capabilities.filter((cap) => cap.status === 'active').length; const critical = capabilities.filter((cap) => cap.criticality === 'critical' || cap.criticality === 'high').length; const categories = new Set(capabilities.map((cap) => cap.category).filter(Boolean)).size;
  return <div className="cap-library">
    <header className="cap-library__hero"><div><span>Capability intelligence</span><h2>Build the capabilities your organization relies on</h2><p>Define, prioritize, and assign the skills, knowledge, and behaviours that power effective execution.</p></div><div className="cap-library__hero-mark"><Target size={34}/><strong>{capabilities.length}</strong><small>capabilities</small></div></header>
    <section className="cap-library__kpis"><Kpi icon={<Boxes/>} label="Total capabilities" value={capabilities.length} hint="In this organization"/><Kpi icon={<CircleGauge/>} label="Active" value={active} hint={`${Math.max(0, capabilities.length-active)} inactive or archived`}/><Kpi icon={<ShieldAlert/>} label="High criticality" value={critical} hint="High or critical priority"/><Kpi icon={<Tag/>} label="Categories" value={categories} hint="Capability domains"/></section>
    <section className="cap-library__workspace"><div className="cap-library__toolbar"><div className="cap-library__search"><Search size={17}/><input value={search} onChange={(e)=>{setSearch(e.target.value);if(!e.target.value)setResults(null)}} onKeyDown={(e)=>{if(e.key==='Enter')doSearch()}} placeholder="Search capability name or code"/></div><select value={type} onChange={(e)=>setType(e.target.value)}><option value="all">All types</option><option value="competency">Competency</option><option value="skill">Skill</option><option value="knowledge">Knowledge</option><option value="behaviour">Behaviour</option></select><select value={criticality} onChange={(e)=>setCriticality(e.target.value)}><option value="all">All criticality</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><button type="button" onClick={doSearch} disabled={searching}>{searching?'Searching…':'Search'}</button><button type="button" className="eb-pill-btn" onClick={()=>{setSearch('');setResults(null);setType('all');setCriticality('all');setSearchError(null)}}>Reset</button></div>{searchError&&<p className="cap-library__error">{searchError}</p>}<div className="cap-library__head"><div><span><Filter size={14}/> Capability registry</span><h3>{visible.length} {visible.length === 1 ? 'capability' : 'capabilities'}</h3></div></div>{loading?<div className="cap-library__empty">Loading capabilities…</div>:visible.length===0?<div className="cap-library__empty">No capabilities match the current filters.</div>:<div className="cap-library__grid">{visible.map((cap)=><article key={cap.id} className="cap-card"><div className="cap-card__top"><span className="cap-card__code">{cap.capabilityCode||'Uncoded'}</span><span className={`cap-card__criticality cap-card__criticality--${cap.criticality||'medium'}`}>{cap.criticality||'medium'}</span></div><button className="cap-card__title" onClick={()=>onSelect(cap)}><h3>{cap.name}</h3><ArrowRight size={17}/></button><p>{cap.description||'No description has been recorded for this capability.'}</p><div className="cap-card__meta"><span>{cap.category||'Uncategorised'}</span><span>{cap.capabilityType||'competency'}</span><span>{cap.difficulty||'intermediate'}</span></div><footer><span>Version {cap.version||1}</span><span className="cap-card__status">{cap.status||'active'}</span></footer><div className="cap-card__actions"><button className="eb-pill-btn" onClick={()=>onEdit(cap)}>Edit</button><button className="eb-pill-btn" onClick={()=>onAssign(cap)}>Assign</button><button className="cap-card__archive" onClick={()=>onArchive(cap)} aria-label={`Archive ${cap.name}`}><Archive size={15}/></button></div></article>)}</div>}</section>
  </div>;
>>>>>>> e20646f901d49b1a8f8cfe28b51a5a4def61aa61
}
function Kpi({icon,label,value,hint}:{icon:React.ReactNode;label:string;value:number;hint:string}) { return <article className="cap-kpi"><span>{icon}</span><em>{label}</em><strong>{value}</strong><small>{hint}</small></article>; }
