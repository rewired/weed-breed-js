import React from 'react';
import { useAppState } from '../../StateContext';

const modes = ['structure', 'company', 'shop', 'editor'] as const;

const LeftPanel: React.FC = () => {
  const { state, dispatch } = useAppState();
  return (
    <aside style={{ width: 200, borderRight: '1px solid #ccc', padding: '0.5rem' }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {modes.map((m) => (
          <li key={m} style={{ marginBottom: 4 }}>
            <button
              style={{
                width: '100%',
                padding: '0.25rem',
                background: state.treeMode === m ? '#ddd' : 'transparent',
                border: '1px solid #ccc'
              }}
              onClick={() => dispatch({ type: 'SET_STATE', payload: { treeMode: m, selection: {} } })}
            >
              {m}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default LeftPanel;
