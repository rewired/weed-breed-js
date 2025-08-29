// apps/client/src/components/Header.jsx
// Single toggle control + connectivity badge + status + dev-only Strain Editor launcher.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  health, getState, start, pause, resume, stop as simStop, setSpeed, openUiWs
} from '@/lib/simApi.js';
const SHOW_STRAIN_EDITOR = (import.meta?.env?.VITE_SHOW_STRAIN_EDITOR ?? 'true') === 'true';

function labelFor(state) {
  if (state === 'running') return 'Pause';
  if (state === 'paused')  return 'Resume';
  return 'Start';
}

function Dot({ status }) {
  const color =
    status === 'connected' ? '#20c997' :
    status === 'connecting' ? '#f59f00' : '#fa5252';
  const title = `Connectivity: ${status}`;
  return <span title={title} style={{
    display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color
  }} />;
}

export default function Header({ onOpenEditor }) {
  const [simState, setSimState] = useState('idle');
  const [tick, setTick] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [conn, setConn] = useState('connecting'); // 'connected' | 'connecting' | 'error'
  const wsRef = useRef(null);

  // Health heartbeat (every 5s)
  useEffect(() => {
    let alive = true;
    const beat = async () => {
      try {
        await health();
        if (alive) setConn('connected');
      } catch {
        if (alive) setConn('error');
      }
    };
    beat();
    const id = setInterval(beat, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Initial fetch + 3s polling fallback (keeps state visible if WS is down)
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const s = await getState();
        if (!alive) return;
        setSimState(s.state ?? 'idle');
        setTick(s.tick ?? 0);
        setSpeedState(s.speed ?? 1);
      } catch {
        // keep last
      }
    };
    pull();
    const id = setInterval(pull, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // WS telemetry (ticks)
  useEffect(() => {
    try {
      const ws = openUiWs((evt) => {
        const last = Array.isArray(evt) ? evt[evt.length - 1] : evt;
        if (last?.type === 'sim.tickCompleted') {
          const t = last?.payload?.tick;
          if (Number.isFinite(t)) setTick(t);
        }
      });
      wsRef.current = ws;
      setConn((c) => (c === 'error' ? 'connecting' : c));
      ws.onopen = () => setConn('connected');
      ws.onclose = () => setConn('connecting');
      ws.onerror = () => setConn('error');
      return () => { try { ws.close(); } catch {} };
    } catch {
      return () => {};
    }
  }, []);

  const onToggle = async () => {
    if (simState === 'idle')      await start(speed);
    else if (simState === 'running') await pause();
    else if (simState === 'paused')  await resume();
    const s = await getState();
    setSimState(s.state ?? 'idle');
    setTick(s.tick ?? 0);
    setSpeedState(s.speed ?? 1);
  };
  const onStop = async (e) => {
    e?.preventDefault?.();
    await simStop();
    const s = await getState();
    setSimState(s.state ?? 'idle');
    setTick(s.tick ?? 0);
    setSpeedState(s.speed ?? 1);
  };

  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 12px', borderBottom: '1px solid #333'
    }}>
      <strong style={{ marginRight: 'auto' }}>Weed&nbsp;Breed</strong>

      <Dot status={conn} />

      <button onClick={onToggle} title="Start/Pause/Resume simulation">
        {labelFor(simState)}
      </button>

      {(simState === 'running' || simState === 'paused') && (
        <a href="#" onClick={onStop} title="Stop simulation"
           aria-label="Stop simulation" style={{ textDecoration: 'none', opacity: 0.9 }}>⏹</a>
      )}

      <span style={{ opacity: 0.8 }}>
        State: {simState} | Tick: {tick} | Speed: {speed}x
      </span>

      {SHOW_STRAIN_EDITOR && (
        <>
          <span style={{ opacity: 0.5 }}>|</span>
          <a href="#" onClick={(e) => { e.preventDefault(); onOpenEditor?.(); }}>
            Strain Editor
          </a>
        </>
      )}
    </header>
  );
}
