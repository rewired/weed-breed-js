import React, { useState } from 'react'
import { useSocketDiagnostics } from '@/lib/socket.js'
import { useSimState, startSim, pauseSim, stepSim, setSpeed } from '@/lib/simControl.js'
import { loadDefaultSavegame, useWorldSummary } from '@/lib/worldControl.js'

export default function Header() {
  const diag = useSocketDiagnostics()
  const summary = useWorldSummary()
  const [sim, setSim] = useSimState()
  const [busy, setBusy] = useState(false)
  const disabled = !diag.connected || busy

  async function doStart() {
    try { setBusy(true); await startSim() }
    catch (e) { setSim((s) => ({ ...s, error: e?.message || String(e) })) }
    finally { setBusy(false) }
  }
  async function doPause() {
    try { setBusy(true); await pauseSim() }
    catch (e) { setSim((s) => ({ ...s, error: e?.message || String(e) })) }
    finally { setBusy(false) }
  }
  async function doStep() {
    try { setBusy(true); await stepSim() }
    catch (e) { setSim((s) => ({ ...s, error: e?.message || String(e) })) }
    finally { setBusy(false) }
  }
  async function onSpeedChange(e) {
    const val = Number(e.target.value)
    setSim((s) => ({ ...s, speed: val }))
    try { await setSpeed(val) }
    catch (e2) { setSim((s) => ({ ...s, error: e2?.message || String(e2) })) }
  }
  async function doLoadDefault() {
    try { setBusy(true); await loadDefaultSavegame() }
    catch (e) { setSim((s) => ({ ...s, error: e?.message || String(e) })) }
    finally { setBusy(false) }
  }

  return (
    <div style={bar}>
      <span style={{ fontWeight: 600 }}>Weed Breed</span>

      <div style={controls}>
        <button onClick={doStart} disabled={disabled || sim.running} title="Start">▶ Start</button>
        <button onClick={doPause} disabled={disabled || !sim.running} title="Pause">❚❚ Pause</button>
        <button onClick={doStep} disabled={!diag.connected || sim.running || busy} title="Step">▷ Step</button>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span>Speed</span>
          <input type="range" min="0.25" max="8" step="0.25"
            value={sim.speed} onChange={onSpeedChange} disabled={!diag.connected || busy} />
          <code>{sim.speed.toFixed(2)}x</code>
        </label>

        <button onClick={doLoadDefault} disabled={!diag.connected || busy} title="Load default save">
          ⟳ Load Default
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>
          WS:{' '}
          <b style={{ color: diag.connected ? 'limegreen' : 'crimson' }}>
            {diag.connected ? 'connected' : 'disconnected'}
          </b>
          {' · '}events: {diag.eventCount}
          {' · '}last: <code>{diag.lastEventType ?? '—'}</code>
          {' · '}tx: <code>{diag.transport}</code>
          {' · '}mode: <code>{diag.mode}</code>
        </span>
      </div>

      <div style={status}>
        <span>
          {sim.running ? 'running' : 'paused'} · lastTick: <code>{sim.lastTick ?? 'n/a'}</code>
        </span>
        {summary && (
          <span style={{ marginLeft: 16 }}>
            rooms: <b>{summary.rooms}</b> · zones: <b>{summary.zones}</b> · plants: <b>{summary.plants}</b> · harvests: <b>{summary.harvests}</b>
          </span>
        )}
        {sim.error && <span style={{ color: 'salmon', marginLeft: 16 }}>error: {sim.error}</span>}
      </div>
    </div>
  )
}

const bar = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  background: '#0b0e14',
  color: '#d6deeb',
  fontFamily: 'system-ui, sans-serif',
  position: 'sticky',
  top: 0,
  zIndex: 10,
}
const controls = { display: 'inline-flex', alignItems: 'center', gap: 8 }
const status = { gridColumn: '1 / -1', fontSize: 12, opacity: 0.8 }
