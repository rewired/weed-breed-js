// apps/client/src/lib/simApi.js
// REST + WS helpers with relative defaults; resilient in dev.

// --- Base URLs (configurable)
const serverUrl = (import.meta?.env?.VITE_SERVER_URL ?? 'http://localhost:7071').trim().replace(/\/$/, '');
const apiBase = serverUrl;

// --- Health
export async function health() {
  const r = await fetch(`${apiBase}/healthz`);
  return r.json();
}

// --- Sim state & control
export async function getState() {
  const r = await fetch(`${apiBase}/api/sim/state`);
  if (!r.ok) throw new Error('sim/state failed');
  return r.json();
}
export async function start(speed) {
  const r = await fetch(`${apiBase}/api/sim/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speed })
  });
  if (!r.ok) throw new Error('sim/start failed');
  return r.json();
}
export async function pause() {
  const r = await fetch(`${apiBase}/api/sim/pause`, { method: 'POST' });
  if (!r.ok) throw new Error('sim/pause failed');
  return r.json();
}
export async function resume() {
  const r = await fetch(`${apiBase}/api/sim/resume`, { method: 'POST' });
  if (!r.ok) throw new Error('sim/resume failed');
  return r.json();
}
export async function stop() {
  const r = await fetch(`${apiBase}/api/sim/stop`, { method: 'POST' });
  if (!r.ok) throw new Error('sim/stop failed');
  return r.json();
}
export async function setSpeed(speed) {
  const r = await fetch(`${apiBase}/api/sim/speed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speed })
  });
  if (!r.ok) throw new Error('sim/speed failed');
  return r.json();
}

// --- Strain API
export async function listStrains() {
  const r = await fetch(`${apiBase}/api/strains`);
  if (!r.ok) throw new Error('strains list failed');
  return r.json();
}
export async function loadStrain(id) {
  const r = await fetch(`${apiBase}/api/strains/${id}`);
  if (!r.ok) throw new Error('strain not found');
  return r.json();
}
export async function saveStrainDraft(id, body) {
  const r = await fetch(`${apiBase}/api/strains/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return r.ok;
}
export async function publishStrain(id) {
  const r = await fetch(`${apiBase}/api/strains/${id}/publish`, { method: 'POST' });
  return r.ok;
}
