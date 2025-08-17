import React from 'react';
import { useAppState } from '../../StateContext';

const StructureView: React.FC = () => {
  const { state } = useAppState();
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Structure View</h2>
      <p>Selected Structure: {state.selection.structureId ?? 'none'}</p>
      {/* TODO: KPIs and Rooms table */}
    </div>
  );
};

export default StructureView;
