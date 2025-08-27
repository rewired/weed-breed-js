import React from 'react';
import { useUiState } from '../store/uiStore.js';
import Table from '../components/Table.jsx';
import { fmtNumber, fmtGram } from '../utils/format.js';

/** List of observed plants. */
export default function PlantsView() {
  const { plants } = useUiState();
  const rows = [];
  plants.forEach((p) => {
    rows.push({
      id: p.id,
      age: fmtNumber(p.age_days || p.age || 0),
      biomass: fmtGram(p.biomass_g),
      buds: fmtGram(p.buds_g),
    });
  });
  if (rows.length === 0) return <div>No plant data.</div>;
  return (
    <Table
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'age', label: 'Age (d)' },
        { key: 'biomass', label: 'Biomass' },
        { key: 'buds', label: 'Buds' },
      ]}
      rows={rows}
    />
  );
}
