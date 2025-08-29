// apps/client/public/js/strainEditor.js
const SHOW = (import.meta?.env?.VITE_SHOW_STRAIN_EDITOR ?? 'true') === 'true';
const apiBase = import.meta?.env?.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:3000`;

if (SHOW) {
  // Add a nav link (right side) and a hidden panel; keep layout intact
  const nav = document.querySelector('[data-top-nav]') || document.querySelector('nav') || document.body;
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = 'Strain Editor';
  link.style.marginLeft = '1rem';
  link.dataset.devOnly = 'true';
  nav.appendChild(link);

  const panel = document.createElement('section');
  panel.id = 'strain-editor';
  panel.style.border = '1px solid #444';
  panel.style.padding = '8px';
  panel.style.marginTop = '12px';
  panel.hidden = true;
  panel.innerHTML = `
    <div style="display:flex; gap:12px;">
      <div style="flex:1; min-width:220px;">
        <h3>Strains</h3>
        <ul id="strain-list" style="max-height:280px; overflow:auto; border:1px solid #333; padding:6px;"></ul>
      </div>
      <div style="flex:3;">
        <h3 id="strain-title">Editor</h3>
        <textarea id="strain-json" style="width:100%; height:260px; font-family:monospace;"></textarea>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button id="btn-save-draft">Save Draft</button>
          <button id="btn-publish">Publish</button>
          <span id="strain-msg" style="opacity:.8"></span>
        </div>
      </div>
    </div>`;
  (document.querySelector('#app') || document.body).appendChild(panel);

  let currentId = null;

  async function listStrains() {
    const res = await fetch(`${apiBase}/api/strains`);
    return res.json();
  }
  async function loadStrain(id) {
    const res = await fetch(`${apiBase}/api/strains/${id}`);
    if (!res.ok) throw new Error('Not found');
    return res.json();
  }
  function setMsg(t) { const el = document.getElementById('strain-msg'); if (el) el.textContent = t; }

  async function refreshList() {
    const ul = document.getElementById('strain-list');
    ul.innerHTML = '';
    const items = await listStrains();
    items.forEach(({ id, name, isPublished }) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#'; a.textContent = `${name} ${isPublished ? '' : '(draft)'}`;
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        currentId = id;
        const json = await loadStrain(id);
        document.getElementById('strain-title').textContent = `Editor – ${name}`;
        document.getElementById('strain-json').value = JSON.stringify(json, null, 2);
        setMsg('');
      });
      li.appendChild(a); ul.appendChild(li);
    });
  }

  link.addEventListener('click', async (e) => {
    e.preventDefault();
    panel.hidden = !panel.hidden;
    if (!panel.hidden) await refreshList();
  });

  document.getElementById('btn-save-draft').addEventListener('click', async () => {
    if (!currentId) return setMsg('Select a strain first.');
    try {
      const body = JSON.parse(document.getElementById('strain-json').value || '{}');
      const res = await fetch(`${apiBase}/api/strains/${currentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Save failed');
      setMsg('Draft saved.');
    } catch (err) { setMsg('Invalid JSON or save error.'); }
  });

  document.getElementById('btn-publish').addEventListener('click', async () => {
    if (!currentId) return setMsg('Select a strain first.');
    const res = await fetch(`${apiBase}/api/strains/${currentId}/publish`, { method: 'POST' });
    if (res.ok) { setMsg('Published.'); await refreshList(); } else { setMsg('Publish failed.'); }
  });
}
