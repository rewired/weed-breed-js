export async function listStrains({ status, query } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (query) params.set('query', query);
  const res = await fetch(`/api/strains?${params.toString()}`);
  return res.json();
}

export async function getStrain(id) {
  const res = await fetch(`/api/strains?status=draft`);
  const list = await res.json();
  return list.find((s) => s.id === id);
}

export async function createStrain(data) {
  const res = await fetch('/api/strains', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function updateStrain(id, data) {
  const res = await fetch(`/api/strains/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function publishStrain(id, versionBump = 'patch') {
  const res = await fetch(`/api/strains/${id}/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ versionBump }),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}
