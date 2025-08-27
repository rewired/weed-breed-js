import React from 'react';
import { useUiState } from '../store/uiStore.js';
import Table from '../components/Table.jsx';
import { fmtNumber, fmtCelsius, fmtPercent } from '../utils/format.js';

/** View for a single room showing its zones. */
export default function RoomView({ roomId }) {
  const { rooms, zones, plants } = useUiState();
  const room = rooms.get(roomId);
  if (!room) return <div>Room {roomId} not found.</div>;

  const rows = [];
  zones.forEach((z) => {
    if (z.roomId !== roomId) return;
    const plantCount = Array.from(plants.values()).filter((p) => p.zoneId === z.id).length;
    rows.push({
      id: z.id,
      plants: fmtNumber(plantCount),
      temp: fmtCelsius(z.temp_C),
      humidity: fmtPercent(z.humidity_rel),
    });
  });

  return (
    <div>
      <h2>Room {roomId}</h2>
      <Table
        columns={[
          { key: 'id', label: 'Zone' },
          { key: 'plants', label: 'Plants' },
          { key: 'temp', label: 'Temp' },
          { key: 'humidity', label: 'Humidity' },
        ]}
        rows={rows}
      />
    </div>
  );
}
