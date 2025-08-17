import React from 'react';
import { useAppState } from '../../StateContext';
import formatUnits from '../../utils/formatUnits';

const TopBar: React.FC = () => {
  const { state, dispatch } = useAppState();

  const setRunning = async (running: boolean) => {
    try {
      await fetch(`/simulation/${running ? 'start' : 'pause'}`, { method: 'POST' });
      dispatch({ type: 'SET_STATE', payload: { running } });
    } catch (err) {
      console.error(err);
    }
  };

  const changeSpeed = async (speed: string) => {
    try {
      await fetch(`/simulation/speed/${speed}`, { method: 'POST' });
      dispatch({ type: 'SET_STATE', payload: { speed } });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>
      <div>
        Tick: {state.tick} | Balance: €{state.balance.toFixed(2)} | Daily: {formatUnits(state.dailyEnergyKWh, 'kWh')}
      </div>
      <div>
        <button onClick={() => setRunning(true)} disabled={state.running}>Start</button>
        <button onClick={() => setRunning(false)} disabled={!state.running}>Pause</button>
        <select value={state.speed} onChange={e => changeSpeed(e.target.value)}>
          <option value="slow">slow</option>
          <option value="normal">normal</option>
          <option value="fast">fast</option>
        </select>
      </div>
    </header>
  );
};

export default TopBar;
