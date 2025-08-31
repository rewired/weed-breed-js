import React from 'react'
import { useSocketDiagnostics } from '@/lib/socket.js'

export default function Header() {
  const diag = useSocketDiagnostics()

  return (
    <div style={bar}>
      <span style={{ fontWeight: 600 }}>Weed Breed</span>
      <span>
        WS:{' '}
        <b style={{ color: diag.connected ? 'limegreen' : 'crimson' }}>
          {diag.connected ? 'connected' : 'disconnected'}
        </b>
        {' · '}events: {diag.eventCount} {' · '}last: <code>{diag.lastEventType ?? '—'}</code>
      </span>
    </div>
  )
}

const bar = {
  display: 'flex',
  justifyContent: 'space-between',
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
