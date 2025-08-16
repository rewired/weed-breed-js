export default async function renderStrainEditor(root) {
  root.innerHTML = `
    <div class="section">
      <header style="display:flex;justify-content:space-between;align-items:center">
        <strong>Strain Editor</strong>
        <button id="new-strain" class="btn">Neu</button>
      </header>
      <form id="strain-form" style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
        <label>ID <input id="strain-id" readonly></label>
        <label>Name* <input id="strain-name" required></label>
        <label>Parents
          <select id="strain-parents" multiple size="5"></select>
        </label>
        <label>Genotype*
          <div style="display:flex;gap:4px;">
            <input id="gen-sativa" type="number" step="0.01" placeholder="Sativa">
            <input id="gen-indica" type="number" step="0.01" placeholder="Indica">
            <input id="gen-ruderalis" type="number" step="0.01" placeholder="Ruderalis">
          </div>
        </label>
        <label>Resilience* <input id="strain-resilience" type="number" step="0.01"></label>
        <div id="message" style="color:var(--danger)"></div>
        <div><button type="submit" class="btn primary">Speichern</button></div>
      </form>
    </div>
    <div class="section">
      <header>Existing Strains</header>
      <ul id="strain-list" style="list-style:none;padding:0;display:flex;flex-direction:column;gap:4px;"></ul>
    </div>
  `;

  let currentId = null;

  async function loadList() {
    const res = await fetch('/api/strains');
    const data = await res.json();
    const list = document.getElementById('strain-list');
    const parents = document.getElementById('strain-parents');
    list.innerHTML = '';
    parents.innerHTML = '';
    data.forEach(s => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.textContent = s.name;
      btn.className = 'btn';
      btn.addEventListener('click', () => loadStrain(s.id));
      li.appendChild(btn);
      list.appendChild(li);
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      parents.appendChild(opt);
    });
  }

  function newStrain() {
    currentId = crypto.randomUUID();
    document.getElementById('strain-id').value = currentId;
    document.getElementById('strain-name').value = '';
    document.getElementById('strain-resilience').value = '';
    document.getElementById('gen-sativa').value = '';
    document.getElementById('gen-indica').value = '';
    document.getElementById('gen-ruderalis').value = '';
    Array.from(document.getElementById('strain-parents').options).forEach(o => o.selected = false);
  }

  async function loadStrain(id) {
    const res = await fetch(`/api/strains/${id}`);
    if (!res.ok) return;
    const s = await res.json();
    currentId = s.id;
    document.getElementById('strain-id').value = s.id || '';
    document.getElementById('strain-name').value = s.name || '';
    document.getElementById('strain-resilience').value = s.generalResilience ?? '';
    document.getElementById('gen-sativa').value = s.genotype?.sativa ?? '';
    document.getElementById('gen-indica').value = s.genotype?.indica ?? '';
    document.getElementById('gen-ruderalis').value = s.genotype?.ruderalis ?? '';
    const parentsSelect = document.getElementById('strain-parents');
    Array.from(parentsSelect.options).forEach(opt => {
      opt.selected = s.lineage?.parents?.includes(opt.value);
    });
  }

  document.getElementById('new-strain').addEventListener('click', () => {
    newStrain();
  });

  document.getElementById('strain-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('message');
    msg.style.color = 'var(--danger)';
    msg.textContent = '';
    const name = document.getElementById('strain-name').value.trim();
    const resilience = document.getElementById('strain-resilience').value;
    if (!name || resilience === '') {
      msg.textContent = 'Name und Resilience sind Pflichtfelder';
      return;
    }
    const strain = {
      id: currentId,
      name,
      generalResilience: Number(resilience),
      genotype: {
        sativa: Number(document.getElementById('gen-sativa').value) || 0,
        indica: Number(document.getElementById('gen-indica').value) || 0,
        ruderalis: Number(document.getElementById('gen-ruderalis').value) || 0,
      },
      lineage: {
        parents: Array.from(document.getElementById('strain-parents').selectedOptions).map(o => o.value),
      },
    };
    let url = '/api/strains';
    let method = 'POST';
    if (currentId && (await exists(`/api/strains/${currentId}`))) {
      url += `/${currentId}`;
      method = 'PUT';
    }
    const resp = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(strain) });
    if (resp.ok) {
      const saved = await resp.json();
      currentId = saved.id;
      document.getElementById('strain-id').value = saved.id;
      msg.style.color = 'var(--ok)';
      msg.textContent = 'Gespeichert';
      await loadList();
    } else {
      const err = await resp.json();
      msg.textContent = err.error || err.message || 'Fehler';
    }
  });

  async function exists(url) {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  }

  await loadList();
  newStrain();
}
