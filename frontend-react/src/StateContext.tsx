import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useLiveData } from './hooks/useLiveData';

interface Selection {
  structureId?: string;
  roomId?: string;
  zoneId?: string;
  plantId?: string;
}

interface State {
  treeMode: 'structure' | 'company' | 'shop' | 'editor';
  selection: Selection;
  tick: number;
  balance: number;
  dailyEnergyKWh: number;
  running: boolean;
  speed: string;
}

const initialState: State = {
  treeMode: 'structure',
  selection: {},
  tick: 0,
  balance: 0,
  dailyEnergyKWh: 0,
  running: false,
  speed: 'normal',
};

type Action =
  | { type: 'SET_STATE'; payload: Partial<State> }
  | { type: 'UPDATE_LIVE'; payload: Partial<State> };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'UPDATE_LIVE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | undefined>(undefined);

export const StateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useLiveData(dispatch);

  useEffect(() => {
    fetchInitialData(dispatch);
  }, []);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
};

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used within StateProvider');
  return ctx;
}

async function fetchInitialData(dispatch: React.Dispatch<Action>) {
  try {
    const res = await fetch('/simulation/status');
    if (res.ok) {
      const data = await res.json();
      dispatch({ type: 'SET_STATE', payload: updateWithLiveData(data) });
    }
  } catch (err) {
    console.error(err);
  }
}

function updateWithLiveData(data: any): Partial<State> {
  return {
    tick: data.tick ?? 0,
    balance: data.balance ?? 0,
    dailyEnergyKWh: data.dailyEnergyKWh ?? 0,
    running: data.running ?? false,
    speed: data.speed ?? 'normal',
  };
}
