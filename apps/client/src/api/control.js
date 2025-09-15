/** deprecated: prefer socket-based simControl */
const apiBase = import.meta.env.VITE_SERVER_URL || 'http://localhost:7071';

async function request(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(apiBase + path, { ...opts, headers });
  if (!res.ok) throw new Error(res.statusText || 'request failed');
  if (res.status === 204) return null;
  return res.json();
}

const control = {
  start() {
    return request('/api/sim/start', { method: 'POST' });
  },
  pause() {
    return request('/api/sim/pause', { method: 'POST' });
  },
  step(ticks = 1) {
    return request('/api/sim/step', {
      method: 'POST',
      body: JSON.stringify({ ticks })
    });
  },
  speed(multiplier) {
    return request('/api/sim/speed', {
      method: 'POST',
      body: JSON.stringify({ multiplier })
    });
  }
};

export default control;
export { control };

