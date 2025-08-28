import React from 'react';
import { useConnection, useUiState, setPaused } from '../store/uiStore.js';
import { fmtTick } from '../utils/format.js';

/** Header with connection status and controls. */
export default function Header() {
  const conn = useConnection();
  const { lastTick, lastTickSeen, paused } = useUiState();

  const toggle = () => setPaused(!paused);

  const now = Date.now();
  let status = conn.status;
  if (status === 'connected' && conn.lastMessageTs && now - conn.lastMessageTs > 10000) {
    status = 'stalling';
  }

  const label = (lastTickSeen === null) ? 'Start' : (paused ? 'Resume' : 'Pause');

  return (
    <header>
      <div>
        <span className={`status-pill status-${status}`}>{status}</span>
        <span style={{ marginLeft: '1rem' }}>last tick: {fmtTick(lastTick)}</span>
      </div>
      <div>
        <button onClick={toggle}>{label}</button>
        <span style={{ marginLeft: '1rem' }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} style={{ marginRight: '0.25rem' }}>{s}x</span>
          ))}
        </span>
        <span style={{ marginLeft: '1rem' }}>balance: �?"</span>
      </div>
    </header>
  );
}

