import React, { useEffect } from 'react'
import { useWorldSnapshot, requestWorld } from '@/lib/worldControl.js'
import Table from '@/components/Table.jsx'

export default function PlantsPage() {
  const snapshot = useWorldSnapshot()
  useEffect(() => { if (!snapshot) requestWorld().catch(() => {}) }, [snapshot])
  const rows = []
  snapshot?.rooms?.forEach((r) => {
    ;(r.zones || []).forEach((z) => {
      rows.push({
        room: r.name || r.id,
        zone: z.name || z.id,
        strain: z.strainLabel ?? z.strainId ?? '—',
        method: z.methodLabel ?? z.methodId ?? '—',
        planned: z.plantsPlanned ?? 0,
      })
    })
  })
  if (rows.length === 0) return <div style={{ padding: 16 }}>No zones configured</div>
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Planned Plants</h2>
      <Table
        columns={[
          { key: 'room', label: 'Room' },
          { key: 'zone', label: 'Zone' },
          { key: 'strain', label: 'Strain' },
          { key: 'method', label: 'Method' },
          { key: 'planned', label: 'Planned Plants' },
        ]}
        rows={rows}
      />
    </div>
  )
}
