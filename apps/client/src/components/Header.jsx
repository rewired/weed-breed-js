import React, { useEffect, useState } from 'react';
import { useConnection, useUiState, setPaused } from '../store/uiStore.js';
import { fmtTick } from '../utils/format.js';
import control from '../api/control.js';

/** Header with connection status and controls. */
export default function Header() {
  const conn = useConnection();
  const { lastTick, lastTickSeen, paused } = useUiState();

  const [server, setServer] = useState({ running: false, tickMs: null });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const toggle = () => setPaused(!paused);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const s = await control.status();
        if (!cancelled) setServer(s);
      } catch {}
      if (!cancelled) setTimeout(poll, 4000);
    }
    poll();
    return () => { cancelled = true; };
  }, []);

  const now = Date.now();
  let status = conn.status;
  if (status === 'connected' && conn.lastMessageTs && now - conn.lastMessageTs > 10000) {
    status = 'stalling';
  }

  const label = (lastTickSeen === null) ? 'Start' : (paused ? 'Resume' : 'Pause');

  const play = async () => {
    setBusy(true); setMsg('');
    try { await control.start(); setServer({ ...server, running: true }); setMsg('started'); }
    catch { setMsg('start failed'); }
    finally { setBusy(false); }
  };

  const stop = async () => {
    setBusy(true); setMsg('');
    try { await control.stop(); setServer({ ...server, running: false }); setMsg('stopped'); }
    catch { setMsg('stop failed'); }
    finally { setBusy(false); }
  };

  const changeSpeed = async (ms) => {
    setBusy(true); setMsg('');
    try { await control.setSpeed(ms); setServer({ ...server, tickMs: ms }); setMsg(`speed ${ms}ms`); }
    catch { setMsg('speed failed'); }
    finally { setBusy(false); }
  };

  const speeds = [
    { label: '0.5x', ms: 200 },
    { label: '1x', ms: 100 },
    { label: '2x', ms: 50 },
    { label: '5x', ms: 20 }
  ];

  return (
    <header>
      <div>
        <span className={`status-pill status-${status}`}>{status}</span>
        <span style={{ marginLeft: '1rem' }}>last tick: {fmtTick(lastTick)}</span>
        <span style={{ marginLeft: '1rem' }}>server: {server.running ? 'running' : 'stopped'} @ {server.tickMs ?? '?'}ms</span>
        {msg && <span style={{ marginLeft: '1rem' }}>{msg}</span>}
      </div>
      <div>
        <button onClick={toggle}>{label}</button>
        <button onClick={play} disabled={busy || server.running}>Play</button>
        <button onClick={stop} disabled={busy || !server.running}>Stop</button>
        <span style={{ marginLeft: '1rem' }}>
          {speeds.map(s => (
            <button key={s.ms} onClick={() => changeSpeed(s.ms)} disabled={busy || s.ms === server.tickMs} style={{ marginRight: '0.25rem' }}>{s.label}</button>
          ))}
        </span>
        <span style={{ marginLeft: '1rem' }}>balance: �?"</span>
      </div>
    </header>
  );
}

