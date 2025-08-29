// apps/client/src/components/Header.jsx
// Single-toggle simulation control + Dev-only Strain Editor link/panel.
// Uses /api/sim/* for control.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import StrainEditor from './StrainEditor.jsx';

const apiBase =
  import.meta?.env?.VITE_API_BASE ||
  `${window.location.protocol}//${window.location.hostname}:3000`;

const wsUrl =
  import.meta?.env?.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3000/ws/ui`;

const SHOW_STRAIN_EDITOR =
  (import.meta?.env?.VITE_SHOW_STRAIN_EDITOR ?? 'true') === 'true';

// --- small HTTP helpers (keep local to avoid global refactors)
async function getSimState() {
  const r = await fetch(`${apiBase}/api/sim/state`);
  return r.json();
}
async function post(path, body) {
  const r = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json().catch(() => ({}));
}
const sim = {
  start: (speed) => post('/api/sim/start', { speed }),
  pause: () => post('/api/sim/pause'),
  resume: () => post('/api/sim/resume'),
  stop: () => post('/api/sim/stop'),
  speed: (speed) => post('/api/sim/speed', { speed }),
};

function labelFor(state) {
  if (state === 'running') return 'Pause';
  if (state === 'paused') return 'Resume';
  return 'Start';
}

export default function Header() {
  const [simState, setSimState] = useState('idle'); // 'idle' | 'running' | 'paused'
  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const wsRef = useRef(null);

  // initial state fetch
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getSimState();
        if (!alive) return;
        setSimState(s.state ?? 'idle');
        setTick(s.tick ?? 0);
        setSpeed(s.speed ?? 1);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // WS telemetry for ticks
  useEffect(() => {
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          // server batches events; we accept either array or single event
          const data = JSON.parse(ev.data);
          const last = Array.isArray(data) ? data[data.length - 1] : data;
          if (last?.type === 'sim.tickCompleted') {
            const t = last?.payload?.tick;
            if (Number.isFinite(t)) setTick(t);
          }
        } catch {
          // ignore
        }
      };
      ws.onerror = () => {};
      ws.onclose = () => {};
      return () => {
        try { ws.close(); } catch {}
      };
    } catch {
      return () => {};
    }
  }, []);

  // click handlers
  const onToggle = async () => {
    if (simState === 'idle') {
      await sim.start(speed);
    } else if (simState === 'running') {
      await sim.pause();
    } else if (simState === 'paused') {
      await sim.resume();
    }
    const s = await getSimState();
    setSimState(s.state ?? 'idle');
    setTick(s.tick ?? 0);
    setSpeed(s.speed ?? 1);
  };

  const onStop = async (e) => {
    e?.preventDefault?.();
    await sim.stop();
    const s = await getSimState();
    setSimState(s.state ?? 'idle');
    setTick(s.tick ?? 0);
    setSpeed(s.speed ?? 1);
  };

  // optional: wire speed buttons if they exist elsewhere in the page via data-speed attribute
  useEffect(() => {
    // This keeps existing speed buttons functional without refactors.
    const nodes = Array.from(document.querySelectorAll('[data-speed]'));
    const handlers = nodes.map((el) => {
      const h = async () => {
        const v = Number(el.getAttribute('data-speed'));
        if (Number.isFinite(v) && v > 0) {
          await sim.speed(v);
          setSpeed(v);
          // do not force state; it will refresh on next tick or explicit GET
        }
      };
      el.addEventListener('click', h);
      return { el, h };
    });
    return () => handlers.forEach(({ el, h }) => el.removeEventListener('click', h));
  }, []);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        borderBottom: '1px solid #333',
      }}
    >
      {/* App title / brand */}
      <strong style={{ marginRight: 'auto' }}>Weed&nbsp;Breed</strong>

      {/* Single Toggle Button */}
      <button onClick={onToggle} title="Start/Pause/Resume simulation">
        {labelFor(simState)}
      </button>

      {/* Small Stop icon (only when running or paused) */}
      {(simState === 'running' || simState === 'paused') && (
        <a
          href="#"
          onClick={onStop}
          title="Stop simulation"
          style={{ textDecoration: 'none', opacity: 0.9 }}
          aria-label="Stop simulation"
        >
          ⏹
        </a>
      )}

      {/* Status label */}
      <span style={{ opacity: 0.8 }}>
        State: {simState} | Tick: {tick} | Speed: {speed}x
      </span>

      {/* Dev-only Strain Editor */}
      {SHOW_STRAIN_EDITOR && (
        <>
          <span style={{ opacity: 0.5 }}>|</span>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setEditorOpen((v) => !v);
            }}
            title="Open Strain Editor (dev)"
          >
            Strain Editor
          </a>
          <StrainEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
        </>
      )}
    </header>
  );
}

