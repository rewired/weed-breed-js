import React from 'react';
import { useUiState } from '../store/uiStore.js';
import KPICard from '../components/KPICard.jsx';
import Table from '../components/Table.jsx';
import { fmtNumber, fmtTick } from '../utils/format.js';

/** Overall structure view with KPIs and rooms table. */
export default function StructureView() {
  const { lastTick, rooms, zones, plants, counters } = useUiState();

  const kpis = [
    { label: 'Last Tick', value: fmtTick(lastTick) },
    { label: 'Rooms', value: fmtNumber(rooms.size) },
    { label: 'Zones', value: fmtNumber(zones.size) },
    { label: 'Plants', value: fmtNumber(plants.size) },
    { label: 'Harvests', value: fmtNumber(counters.harvest || 0) },
  ];

  const rows = [];
  rooms.forEach((room) => {
    const zoneCount = Array.from(zones.values()).filter((z) => z.roomId === room.id).length;
    const plantCount = Array.from(plants.values()).filter((p) => {
      const z = zones.get(p.zoneId);
      return z && z.roomId === room.id;
    }).length;
    rows.push({ id: room.id, zones: zoneCount, plants: plantCount, phase: room.phase || 'n/a' });
  });

  return (
    <div>
      <div className="kpi-grid">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={k.value} />
        ))}
      </div>
      <Table
        columns={[
          { key: 'id', label: 'Room' },
          { key: 'zones', label: 'Zones' },
          { key: 'plants', label: 'Plants' },
          { key: 'phase', label: 'Phase' },
        ]}
        rows={rows}
      />
    </div>
  );
}
