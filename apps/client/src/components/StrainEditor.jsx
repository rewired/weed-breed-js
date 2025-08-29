// apps/client/src/components/StrainEditor.jsx
// Dev-only panel: list + (Editor/Validation/Diff) tabs, with AJV validation and JSON diff.

import React, { useEffect, useMemo, useState } from 'react';
import Ajv from 'ajv';
import * as jdp from 'jsondiffpatch';
import {
  listStrains, loadStrain, saveStrainDraft, publishStrain
} from '@/lib/simApi.js';
import schema from '@/schemas/strain.schema.json';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });
const validate = ajv.compile(schema);

export default function StrainEditor({ open, onClose }) {
  const [items, setItems] = useState([]); // list
  const [filter, setFilter] = useState('');
  const [current, setCurrent] = useState(null); // {id,name,isPublished}
  const [loadedJson, setLoadedJson] = useState(null); // baseline
  const [text, setText] = useState('');
  const [errors, setErrors] = useState([]);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('editor'); // 'editor' | 'validation' | 'diff'
  const [dirty, setDirty] = useState(false);

  // load list on open
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const list = await listStrains();
        if (!alive) return;
        setItems(list);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [open]);

  // parse & validate
  const parsed = useMemo(() => {
    try {
      const obj = JSON.parse(text || '{}');
      return { obj, ok: true };
    } catch {
      return { obj: null, ok: false };
    }
  }, [text]);

  useEffect(() => {
    if (!open) return;
    if (!parsed.ok) { setErrors([{ instancePath: '', message: 'Invalid JSON' }]); return; }
    const ok = validate(parsed.obj);
    setErrors(ok ? [] : (validate.errors || []));
  }, [open, parsed]);

  const delta = useMemo(() => {
    if (!loadedJson || !parsed.ok) return null;
    try {
      return jdp.diff(loadedJson, parsed.obj) || null;
    } catch { return null; }
  }, [loadedJson, parsed]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return items;
    return items.filter(x => x.name?.toLowerCase().includes(f) || x.id?.toLowerCase().includes(f));
  }, [items, filter]);

  // Actions
  const selectStrain = async (it) => {
    setMsg('');
    setCurrent(it); setDirty(false);
    try {
      const json = await loadStrain(it.id);
      setLoadedJson(json);
      setText(JSON.stringify(json, null, 2));
      setTab('editor');
    } catch {
      setLoadedJson({});
      setText('{}');
      setTab('editor');
    }
  };

  const prettify = () => {
    if (!parsed.ok) return;
    setText(JSON.stringify(parsed.obj, null, 2));
    setDirty(true);
  };

  const importFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result || ''));
      setDirty(true);
    };
    reader.readAsText(file);
  };

  const exportFile = () => {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const fn = `${current?.id || 'strain'}.json`;
    a.download = fn;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveDraft = async () => {
    if (!current || !parsed.ok) { setMsg('Invalid JSON or no selection'); return; }
    const ok = await saveStrainDraft(current.id, parsed.obj);
    setMsg(ok ? 'Draft saved.' : 'Save failed.');
    if (ok) { setLoadedJson(parsed.obj); setDirty(false); }
  };

  const publish = async () => {
    if (!current) return setMsg('Select a strain.');
    if (errors.length > 0) return setMsg('Fix validation errors first.');
    const ok = await publishStrain(current.id);
    setMsg(ok ? 'Published (server creates backup).' : 'Publish failed.');
    // refresh list to update (draft) flag
    try { setItems(await listStrains()); } catch {}
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true"
         style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000 }}
         onClick={() => {
           if (dirty && !confirm('Unsaved changes. Close anyway?')) return;
           onClose?.();
         }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(1100px, 95vw)', margin: '8vh auto', background: '#1b1b1b', color: '#fff',
        border: '1px solid #333', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,.35)', padding: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>Strain Editor (dev)</h3>
          <button onClick={() => {
            if (dirty && !confirm('Unsaved changes. Close anyway?')) return;
            onClose?.();
          }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          {/* Left: list */}
          <div style={{ flex: '1 1 260px' }}>
            <input placeholder="Filter…" value={filter}
                   onChange={(e) => setFilter(e.target.value)}
                   style={{ width: '100%', marginBottom: 6, padding: 6, borderRadius: 6, border: '1px solid #333', background:'#111', color:'#eee' }}/>
            <div style={{ border: '1px solid #333', borderRadius: 6, maxHeight: '50vh', overflow: 'auto' }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 8 }}>
                {filtered.map(it => (
                  <li key={it.id} style={{ margin: '4px 0' }}>
                    <a href="#"
                       onClick={(e) => { e.preventDefault(); selectStrain(it); }}
                       style={{ color: '#9fd3ff', textDecoration: 'none' }}>
                      {it.name}{' '}
                      {it.isPublished ? <span style={{ opacity:.6 }}>(published)</span> : <em style={{ opacity:.6 }}>(draft)</em>}
                    </a>
                  </li>
                ))}
                {filtered.length === 0 && <li style={{ opacity:.6 }}>(no strains)</li>}
              </ul>
            </div>
          </div>

          {/* Right: tabs + editor */}
          <div style={{ flex: '3 1 600px' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <TabButton label="Editor" active={tab==='editor'} onClick={() => setTab('editor')} />
              <TabButton label={`Validation${errors.length ? ` (${errors.length})` : ''}`} active={tab==='validation'} onClick={() => setTab('validation')} />
              <TabButton label="Diff" active={tab==='diff'} onClick={() => setTab('diff')} />
              <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                <input id="strain-import" type="file" accept="application/json"
                       onChange={(e) => { const f=e.target.files?.[0]; if (f) importFile(f); e.currentTarget.value=''; }}
                       style={{ display:'none' }}/>
                <button onClick={() => document.getElementById('strain-import').click()} disabled={!current}>Import</button>
                <button onClick={exportFile} disabled={!current}>Export</button>
                <button onClick={prettify} disabled={!parsed.ok}>Prettify</button>
                <button onClick={saveDraft} disabled={!current || !parsed.ok}>Save Draft</button>
                <button onClick={publish} disabled={!current || errors.length>0}>Publish</button>
              </div>
            </div>

            {tab === 'editor' && (
              <textarea value={text} onChange={(e)=>{ setText(e.target.value); setDirty(true); }}
                        spellCheck={false}
                        style={{
                          width:'100%', height:'50vh', marginTop:8,
                          fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,"Liberation Mono","Courier New", monospace',
                          fontSize:'12.5px', border:'1px solid #333', borderRadius:6, padding:8, background:'#0f0f10', color:'#eaeaea'
                        }}/>
            )}

            {tab === 'validation' && (
              <div style={{ marginTop:8, border:'1px solid #333', borderRadius:6, padding:8, background:'#0f0f10' }}>
                {errors.length === 0 ? (
                  <div style={{ color:'#20c997' }}>No validation errors.</div>
                ) : (
                  <ul>
                    {errors.map((e, i) => (
                      <li key={i}><code>{e.instancePath || '(root)'}</code>: {e.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'diff' && (
              <pre style={{
                marginTop:8, border:'1px solid #333', borderRadius:6, padding:8,
                background:'#0f0f10', color:'#eaeaea', maxHeight:'50vh', overflow:'auto'
              }}>{delta ? JSON.stringify(delta, null, 2) : '(no changes)'}</pre>
            )}

            <div style={{ marginTop:8, opacity:.8 }}>{msg}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 10px',
      borderRadius: 8,
      border: `1px solid ${active ? '#68a2ff' : '#333'}`,
      background: active ? '#1f2a3a' : '#151515',
      color: '#eaeaea'
    }}>
      {label}
    </button>
  );
}
