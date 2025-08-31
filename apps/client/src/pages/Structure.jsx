import React, { useEffect } from 'react'
import { useWorldSummary, useWorldSnapshot, requestWorld } from '@/lib/worldControl.js'
import { useSimState } from '@/lib/simControl.js'

export default function StructurePage() {
  const summary = useWorldSummary()
  const snapshot = useWorldSnapshot()
  const [sim] = useSimState()

  // ensure initial data if user opens page later
  useEffect(() => {
    if (!summary || !snapshot) {
      requestWorld().catch(() => {})
    }
  }, [summary, snapshot])

  return (
    <div style={wrap}>
      <div style={cardsRow}>
        <Card title="Last Tick" value={sim.lastTick ?? 'n/a'} />
        <Card title="Rooms" value={summary?.rooms ?? 0} />
        <Card title="Zones" value={summary?.zones ?? 0} />
        <Card title="Plants" value={summary?.plants ?? 0} />
        <Card title="Harvests" value={summary?.harvests ?? 0} />
      </div>

      <div style={{ marginTop: 16 }}>
        <TableHeader />
        <div>
          {snapshot?.rooms?.length
            ? snapshot.rooms.map((r) => <RoomRow key={r.id} room={r} />)
            : <EmptyRow />}
        </div>
      </div>
    </div>
  )
}

function Card({ title, value }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
      <div style={{ opacity: 0.7 }}>{title}</div>
    </div>
  )
}

function TableHeader() {
  return (
    <div style={thead}>
      <div style={{ flex: 2 }}>Room</div>
      <div style={{ flex: 2 }}>Zones</div>
      <div style={{ flex: 1 }}>Plants</div>
      <div style={{ flex: 1 }}>Phase</div>
    </div>
  )
}

function RoomRow({ room }) {
  const zones = room.zones || []
  const plantsTotal = zones.reduce((acc, z) => acc + (z.plantsCount || 0), 0)
  const topPhase = (() => {
    const counts = zones.reduce((acc, z) => {
      const k = z.phase || '—'; acc[k] = (acc[k] || 0) + 1; return acc
    }, {})
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? '—'
  })()

  return (
    <div style={trow}>
      <div style={{ flex: 2, fontWeight: 600 }}>{room.name || room.id}</div>
      <div style={{ flex: 2 }}>
        {zones.length
          ? zones.map((z) => (
              <span key={z.id} style={tag}>
                {z.name || z.id} · {z.plantsCount}
              </span>
            ))
          : <span style={{ opacity: 0.6 }}>—</span>}
      </div>
      <div style={{ flex: 1 }}>{plantsTotal}</div>
      <div style={{ flex: 1 }}>{topPhase}</div>
    </div>
  )
}

function EmptyRow() {
  return (
    <div style={{ ...trow, opacity: 0.7 }}>
      <div style={{ flex: 2 }}>—</div>
      <div style={{ flex: 2 }}>No rooms loaded</div>
      <div style={{ flex: 1 }}>0</div>
      <div style={{ flex: 1 }}>—</div>
    </div>
  )
}

const wrap = { padding: 16, color: '#d6deeb', fontFamily: 'system-ui, sans-serif' }
const cardsRow = { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }
const card = { background: '#1b1f2a', padding: 12, borderRadius: 8, border: '1px solid #2b3344' }
const thead = { display: 'flex', gap: 12, padding: '8px 4px', borderBottom: '1px solid #2b3344', opacity: 0.8 }
const trow = { display: 'flex', gap: 12, padding: '10px 4px', borderBottom: '1px dashed #2b3344' }
const tag = { display: 'inline-block', background: '#232a39', border: '1px solid #2b3344', padding: '2px 6px', borderRadius: 8, marginRight: 6 }
