import React from 'react';
import { useAppState } from '../../StateContext';

const ZoneView: React.FC = () => {
  const { state } = useAppState();
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Zone View</h2>
      <p>Selected Zone: {state.selection.zoneId ?? 'none'}</p>
      {/* TODO: KPIs and details */}
    </div>
  );
};

export default ZoneView;
