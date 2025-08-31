import React, { useEffect } from 'react'
import { useWorldSnapshot, requestWorld } from '@/lib/worldControl.js'
import Table from '@/components/Table.jsx'

export default function DevicesPage() {
  const snapshot = useWorldSnapshot()
  useEffect(() => { if (!snapshot) requestWorld().catch(() => {}) }, [snapshot])
  const rows = []
  snapshot?.rooms?.forEach((r) => {
    ;(r.zones || []).forEach((z) => {
      const blueprints = (z.devices || [])
        .map((d) => `${d.blueprintId} x ${d.count}`)
        .join(', ')
      rows.push({
        room: r.name || r.id,
        zone: z.name || z.id,
        total: z.devicesTotal || 0,
        blueprints,
      })
    })
  })
  if (rows.length === 0) return <div style={{ padding: 16 }}>No devices configured</div>
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Devices</h2>
      <Table
        columns={[
          { key: 'room', label: 'Room' },
          { key: 'zone', label: 'Zone' },
          { key: 'total', label: 'Devices Total' },
          { key: 'blueprints', label: 'Blueprints' },
        ]}
        rows={rows}
      />
    </div>
  )
}
