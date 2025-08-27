import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Open UI websocket with auto reconnect and heartbeat.
 * @param {object} [opts]
 * @param {string} [opts.url] Override websocket url.
 * @param {number} [opts.heartbeat=10000] Heartbeat timeout in ms.
 * @returns {{messages$: Observable<string>, status$: BehaviorSubject<{status:string,lastMessageTs:number|null}> , close: ()=>void}}
 */
export function openUiSocket(opts = {}) {
  const url = opts.url || import.meta.env.VITE_WS_URL || `${location.origin.replace(/^http/, 'ws')}/ws/ui`;
  const heartbeat = opts.heartbeat ?? 10000;
  const status$ = new BehaviorSubject({ status: 'connecting', lastMessageTs: null });
  let ws;
  let backoff = 500;
  let shouldReconnect = true;
  let hbTimer;

  const connect = () => {
    status$.next({ status: ws ? 'reconnecting' : 'connecting', lastMessageTs: status$.value.lastMessageTs });
    ws = new WebSocket(url);
    ws.onopen = () => {
      backoff = 500;
      status$.next({ status: 'connected', lastMessageTs: status$.value.lastMessageTs });
    };
    ws.onmessage = (ev) => {
      status$.next({ status: 'connected', lastMessageTs: Date.now() });
      messagesObserver?.next(ev.data);
    };
    ws.onerror = () => {
      ws.close();
    };
    ws.onclose = () => {
      if (!shouldReconnect) {
        status$.next({ status: 'disconnected', lastMessageTs: status$.value.lastMessageTs });
        messagesObserver?.complete();
        return;
      }
      status$.next({ status: 'reconnecting', lastMessageTs: status$.value.lastMessageTs });
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 5000);
    };
  };

  const messages$ = new Observable((observer) => {
    messagesObserver = observer;
    connect();
    return () => {
      shouldReconnect = false;
      clearInterval(hbTimer);
      ws && ws.close();
    };
  });

  let messagesObserver;
  hbTimer = setInterval(() => {
    const last = status$.value.lastMessageTs;
    if (status$.value.status === 'connected' && last && Date.now() - last > heartbeat) {
      status$.next({ status: 'stalling', lastMessageTs: last });
    }
  }, 1000);

  return {
    messages$,
    status$,
    close() {
      shouldReconnect = false;
      clearInterval(hbTimer);
      ws && ws.close();
    },
  };
}
