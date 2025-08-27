import React from 'react';
import { useUiState } from '../store/uiStore.js';
import Table from '../components/Table.jsx';

/** List of devices if observed. */
export default function DevicesView() {
  const { zones } = useUiState();
  const rows = [];
  zones.forEach((z) => {
    if (Array.isArray(z.devices)) {
      z.devices.forEach((d) => rows.push({ id: d.id || 'n/a', name: d.name || 'n/a', zone: z.id }));
    }
  });
  if (rows.length === 0) return <div>No device data.</div>;
  return <Table columns={[{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'zone', label: 'Zone' }]} rows={rows} />;
}
