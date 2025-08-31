import React from 'react'
import { useWorldSummary, useWorldSnapshot } from '@/lib/worldControl.js'
import { useSimState } from '@/lib/simControl.js'

export default function StructurePage() {
  const summary = useWorldSummary()
  const snapshot = useWorldSnapshot()
  const [sim] = useSimState()
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
        {snapshot?.rooms?.length ? (
          snapshot.rooms.map((r) => <RoomBlock key={r.id} room={r} />)
        ) : (
          <EmptyRooms />
        )}
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

function RoomBlock({ room }) {
  const zones = room.zones || []
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontWeight: 600, margin: '8px 4px' }}>{room.name || room.id}</div>
      <div style={thead}>
        <div style={{ flex: 2 }}>Zone</div>
        <div style={{ flex: 2 }}>Strain</div>
        <div style={{ flex: 1 }}>Method</div>
        <div style={{ flex: 1 }} />
      </div>
      {zones.length ? zones.map((z) => <ZoneRow key={z.id} zone={z} />) : <NoZones />}
    </div>
  )
}

function ZoneRow({ zone }) {
  return (
    <div style={trow}>
      <div style={{ flex: 2 }}>{zone.name || zone.id}</div>
      <div style={{ flex: 2 }}>{zone.strainLabel ?? zone.strainId ?? '—'}</div>
      <div style={{ flex: 1 }}>{zone.methodLabel ?? zone.methodId ?? '—'}</div>
      <div style={{ flex: 1, textAlign: 'right' }}>
        {Number.isFinite(zone.plantsPlanned) && (
          <span style={tagSoft}>planned {zone.plantsPlanned}</span>
        )}
        {zone.devicesTotal ? (
          <span style={tagSoft}>devices {zone.devicesTotal}</span>
        ) : null}
      </div>
    </div>
  )
}

function NoZones() {
  return (
    <div style={{ ...trow, opacity: 0.7 }}>
      <div style={{ flex: 2 }}>—</div>
      <div style={{ flex: 2 }}>No zones</div>
      <div style={{ flex: 1 }}>—</div>
      <div style={{ flex: 1 }}>—</div>
    </div>
  )
}

function EmptyRooms() {
  return (
    <div style={{ ...trow, opacity: 0.7 }}>
      <div style={{ flex: 2 }}>—</div>
      <div style={{ flex: 2 }}>No rooms loaded</div>
      <div style={{ flex: 1 }}>—</div>
      <div style={{ flex: 1 }}>—</div>
    </div>
  )
}

const wrap = { padding: 16, color: '#d6deeb', fontFamily: 'system-ui, sans-serif' }
const cardsRow = { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }
const card = { background: '#1b1f2a', padding: 12, borderRadius: 8, border: '1px solid #2b3344' }
const thead = { display: 'flex', gap: 12, padding: '8px 4px', borderBottom: '1px solid #2b3344', opacity: 0.8 }
const trow = { display: 'flex', gap: 12, padding: '10px 4px', borderBottom: '1px dashed #2b3344' }
const tagSoft = {
  display: 'inline-block',
  background: '#232a39',
  border: '1px solid #2b3344',
  padding: '2px 6px',
  borderRadius: 8,
  marginLeft: 6,
  opacity: 0.9,
}
