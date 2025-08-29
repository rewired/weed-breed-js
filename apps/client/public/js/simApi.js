// apps/client/public/js/simApi.js
const apiBase = import.meta?.env?.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:3000`;
const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = import.meta?.env?.VITE_WS_URL || `${wsProto}//${window.location.hostname}:3000/ws/ui`;

export async function getState() {
  const res = await fetch(`${apiBase}/api/sim/state`);
  return res.json();
}
export async function start(speed) {
  const res = await fetch(`${apiBase}/api/sim/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speed }) });
  return res.json();
}
export async function pause() {
  const res = await fetch(`${apiBase}/api/sim/pause`, { method: 'POST' });
  return res.json();
}
export async function resume() {
  const res = await fetch(`${apiBase}/api/sim/resume`, { method: 'POST' });
  return res.json();
}
export async function stop() {
  const res = await fetch(`${apiBase}/api/sim/stop`, { method: 'POST' });
  return res.json();
}
export async function setSpeed(speed) {
  const res = await fetch(`${apiBase}/api/sim/speed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speed }) });
  return res.json();
}
export function openUiWs(onMessage) {
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (ev) => {
    try { onMessage(JSON.parse(ev.data)); } catch {}
  };
  return ws;
}
