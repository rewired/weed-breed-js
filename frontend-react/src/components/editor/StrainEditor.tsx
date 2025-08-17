import React, { useEffect, useState } from 'react';

interface Strain {
  id: string;
  name: string;
  generalResilience: number;
  genotype: { sativa: number; indica: number; ruderalis: number };
  lineage: { parents: string[] };
}

const emptyStrain: Strain = {
  id: '',
  name: '',
  generalResilience: 0,
  genotype: { sativa: 0, indica: 0, ruderalis: 0 },
  lineage: { parents: [] }
};

const StrainEditor: React.FC = () => {
  const [strains, setStrains] = useState<Strain[]>([]);
  const [current, setCurrent] = useState<Strain>(emptyStrain);

  useEffect(() => {
    loadList();
  }, []);

  async function loadList() {
    try {
      const res = await fetch('/api/strains');
      if (res.ok) {
        const data = await res.json();
        setStrains(data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadStrain(id: string) {
    try {
      const res = await fetch(`/api/strains/${id}`);
      if (res.ok) {
        const s = await res.json();
        setCurrent({
          id: s.id,
          name: s.name,
          generalResilience: s.generalResilience ?? 0,
          genotype: {
            sativa: s.genotype?.sativa ?? 0,
            indica: s.genotype?.indica ?? 0,
            ruderalis: s.genotype?.ruderalis ?? 0,
          },
          lineage: { parents: s.lineage?.parents ?? [] },
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  function newStrain() {
    setCurrent({ ...emptyStrain, id: crypto.randomUUID() });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const url = current.id ? `/api/strains/${current.id}` : '/api/strains';
    const method = current.id ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    });
    await loadList();
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Strain Editor</h2>
      <div style={{ display: 'flex', gap: '2rem' }}>
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label>
            ID
            <input value={current.id} readOnly />
          </label>
          <label>
            Name*
            <input value={current.name} onChange={e => setCurrent({ ...current, name: e.target.value })} required />
          </label>
          <label>
            Resilience*
            <input type="number" step="0.01" value={current.generalResilience} onChange={e => setCurrent({ ...current, generalResilience: Number(e.target.value) })} />
          </label>
          <div>
            Genotype*
            <div style={{ display: 'flex', gap: 4 }}>
              <input type="number" step="0.01" placeholder="Sativa" value={current.genotype.sativa} onChange={e => setCurrent({ ...current, genotype: { ...current.genotype, sativa: Number(e.target.value) } })} />
              <input type="number" step="0.01" placeholder="Indica" value={current.genotype.indica} onChange={e => setCurrent({ ...current, genotype: { ...current.genotype, indica: Number(e.target.value) } })} />
              <input type="number" step="0.01" placeholder="Ruderalis" value={current.genotype.ruderalis} onChange={e => setCurrent({ ...current, genotype: { ...current.genotype, ruderalis: Number(e.target.value) } })} />
            </div>
          </div>
          <label>
            Parents
            <select multiple size={5} value={current.lineage.parents} onChange={e => {
              const selected = Array.from(e.target.selectedOptions).map(o => o.value);
              setCurrent({ ...current, lineage: { parents: selected } });
            }}>
              {strains.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <div>
            <button type="submit">Save</button>
            <button type="button" onClick={newStrain}>New</button>
          </div>
        </form>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {strains.map(s => (
            <li key={s.id}>
              <button onClick={() => loadStrain(s.id)}>{s.name}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default StrainEditor;
