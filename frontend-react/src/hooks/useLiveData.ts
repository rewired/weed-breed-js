import { useEffect } from 'react';

export function useLiveData(dispatch: (action: any) => void) {
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}`);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        dispatch({ type: 'UPDATE_LIVE', payload: data });
      } catch (err) {
        console.error(err);
      }
    };
    return () => ws.close();
  }, [dispatch]);
}
