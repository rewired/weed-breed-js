// apps/client/src/lib/simApi.js
// REST + WS helpers with relative defaults; resilient in dev.

// --- Base URLs (relative by default for Vite proxy)
const apiBase = (import.meta?.env?.VITE_API_BASE ?? '').trim(); // '' => same-origin
const wsUrl   = (import.meta?.env?.VITE_WS_URL   ?? '/ws/ui').trim();

// --- Health
export async function health() {
  const r = await fetch(`${apiBase}/api/health`);
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

// --- WS (telemetry only)
export function openUiWs(onMessage) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const finalUrl = wsUrl.startsWith('/') ? `${proto}//${window.location.host}${wsUrl}` : wsUrl;
  const ws = new WebSocket(finalUrl);
  ws.onmessage = (ev) => {
    try { onMessage(JSON.parse(ev.data)); } catch {}
  };
  return ws;
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
