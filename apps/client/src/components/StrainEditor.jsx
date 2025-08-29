// apps/client/src/components/StrainEditor.jsx
// Minimal dev-only panel: list + textarea JSON + Save Draft + Publish.

import React, { useEffect, useMemo, useState } from 'react';

const apiBase =
  import.meta?.env?.VITE_API_BASE ||
  `${window.location.protocol}//${window.location.hostname}:3000`;

export default function StrainEditor({ open, onClose }) {
  const [items, setItems] = useState([]); // [{id,name,isPublished}]
  const [current, setCurrent] = useState(null); // { id, name }
  const [jsonText, setJsonText] = useState('');
  const [msg, setMsg] = useState('');

  async function listStrains() {
    const r = await fetch(`${apiBase}/api/strains`);
    return r.json();
  }
  async function loadStrain(id) {
    const r = await fetch(`${apiBase}/api/strains/${id}`);
    if (!r.ok) throw new Error('not found');
    return r.json();
  }
  async function saveDraft(id, body) {
    const r = await fetch(`${apiBase}/api/strains/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.ok;
  }
  async function publish(id) {
    const r = await fetch(`${apiBase}/api/strains/${id}/publish`, { method: 'POST' });
    return r.ok;
  }

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const items = await listStrains();
        if (!alive) return;
        setItems(items);
        // keep current if still present
        if (current && !items.find((x) => x.id === current.id)) {
          setCurrent(null);
          setJsonText('');
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSelect = async (it) => {
    setMsg('');
    setCurrent(it);
    try {
      const data = await loadStrain(it.id);
      setJsonText(JSON.stringify(data, null, 2));
    } catch {
      setJsonText('{}');
    }
  };

  const onSave = async () => {
    if (!current) return setMsg('Select a strain.');
    try {
      const body = JSON.parse(jsonText || '{}');
      const ok = await saveDraft(current.id, body);
      setMsg(ok ? 'Draft saved.' : 'Save failed.');
    } catch {
      setMsg('Invalid JSON.');
    }
  };

  const onPublish = async () => {
    if (!current) return setMsg('Select a strain.');
    const ok = await publish(current.id);
    setMsg(ok ? 'Published.' : 'Publish failed.');
    // refresh list to reflect (draft) labels
    try {
      const items = await listStrains();
      setItems(items);
    } catch {}
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1000px, 92vw)',
          background: '#1b1b1b',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '10px',
          boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
          padding: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, flex: 1 }}>Strain Editor (dev)</h3>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ marginBottom: '6px', opacity: 0.8 }}>Strains</div>
            <div
              style={{
                maxHeight: '45vh',
                overflow: 'auto',
                border: '1px solid #333',
                borderRadius: '6px',
              }}
            >
              <ul style={{ margin: 0, padding: '6px 8px', listStyle: 'none' }}>
                {items.map((it) => (
                  <li key={it.id} style={{ margin: '4px 0' }}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        onSelect(it);
                      }}
                      title={it.id}
                      style={{
                        color: '#9fd3ff',
                        textDecoration: 'none',
                      }}
                    >
                      {it.name} {it.isPublished ? '' : <em style={{ opacity: 0.6 }}>(draft)</em>}
                    </a>
                  </li>
                ))}
                {items.length === 0 && (
                  <li style={{ opacity: 0.65 }}>(no strains found)</li>
                )}
              </ul>
            </div>
          </div>

          <div style={{ flex: '3 1 520px' }}>
            <div style={{ marginBottom: '6px', opacity: 0.8 }}>
              {current ? `Editing: ${current.name}` : 'Editor'}
            </div>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%',
                height: '45vh',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: '12.5px',
                border: '1px solid #333',
                borderRadius: '6px',
                padding: '8px',
                background: '#0f0f10',
                color: '#eaeaea',
              }}
              placeholder="{ ... }"
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
              <button onClick={onSave} disabled={!current}>Save Draft</button>
              <button onClick={onPublish} disabled={!current}>Publish</button>
              <span style={{ opacity: 0.8 }}>{msg}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

