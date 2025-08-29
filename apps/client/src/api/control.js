const apiBase = import.meta.env.VITE_SERVER_URL || 'http://localhost:7071';
const token = import.meta.env.VITE_SIM_CONTROL_TOKEN;

async function request(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers['X-Sim-Control'] = token;
  const res = await fetch(apiBase + path, { ...opts, headers });
  if (!res.ok) throw new Error(res.statusText || 'request failed');
  if (res.status === 204) return null;
  return res.json();
}

const control = {
  start() {
    return request('/api/sim/start', { method: 'POST' });
  },
  stop() {
    return request('/api/sim/stop', { method: 'POST' });
  },
  setSpeed(tickMs) {
    return request('/api/sim/speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickMs })
    });
  },
  status() {
    return request('/api/sim/status');
  }
};

export default control;
export { control };

