import React from 'react';
import { useAppState } from '../../StateContext';

const PlantView: React.FC = () => {
  const { state } = useAppState();
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Plant View</h2>
      <p>Selected Plant: {state.selection.plantId ?? 'none'}</p>
      {/* TODO: Plant detail */}
    </div>
  );
};

export default PlantView;
