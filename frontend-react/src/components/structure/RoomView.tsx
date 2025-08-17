import React from 'react';
import { useAppState } from '../../StateContext';

const RoomView: React.FC = () => {
  const { state } = useAppState();
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Room View</h2>
      <p>Selected Room: {state.selection.roomId ?? 'none'}</p>
      {/* TODO: KPIs and Zones table */}
    </div>
  );
};

export default RoomView;
