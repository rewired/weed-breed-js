import { BehaviorSubject } from 'rxjs';
import { socket } from '@/lib/socket.js';
import { useEffect, useState } from 'react';

/** @typedef {Object} UiState
 * @property {number|null} lastTick
 * @property {Record<string, number>} counters
 * @property {Map<string, Object>} rooms
 * @property {Map<string, Object>} zones
 * @property {Map<string, Object>} plants
 */

/**
 * Connection info state.
 * @typedef {Object} ConnectionState
 * @property {string} status
 * @property {number|null} lastMessageTs
 * @property {number} lastBatchSize
 */

export const connection$ = new BehaviorSubject({
  status: socket.connected ? 'connected' : 'connecting',
  lastMessageTs: null,
  lastBatchSize: 0,
});

export const uiState$ = new BehaviorSubject({
  // control flags
  paused: true,
  lastTickSeen: null,

  // derived/UI state
  lastTick: null,
  counters: {},
  rooms: new Map(),
  zones: new Map(),
  plants: new Map(),
});

export const devLog$ = new BehaviorSubject([]);

let paused = true; // start paused; UI ignores incoming batches until unpaused
let handlersAttached = false;
let handlers = { connect: null, disconnect: null, events: {} };

/** Start the websocket stream and wire to store. */
export function startUiStream() {
  if (handlersAttached) {
    paused = false;
    uiState$.next({ ...uiState$.value, paused });
    return;
  }
  paused = false;
  uiState$.next({ ...uiState$.value, paused });

  const onConnect = () => {
    connection$.next({ ...connection$.value, status: 'connected' });
  };
  const onDisconnect = () => {
    connection$.next({ ...connection$.value, status: 'disconnected' });
  };
  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);

  const eventTypes = [
    'sim.tickCompleted',
    'plant.stageChanged',
    'plant.harvested',
    'zone.thresholdCrossed',
    'device.degraded',
    'market.saleCompleted',
    'tick.summary',
  ];

  const eventHandler = (type) => (payload) => {
    const ev = { type, ...(payload || {}) };
    connection$.next({
      ...connection$.value,
      lastBatchSize: 1,
      lastMessageTs: Date.now(),
    });
    if (import.meta.env.DEV) {
      const lines = devLog$.value.concat(JSON.stringify(ev)).slice(-50);
      devLog$.next(lines);
    }
    if (paused) return;
    const next = reduceEvents(uiState$.value, [ev]);
    uiState$.next(next);
  };

  handlers = { connect: onConnect, disconnect: onDisconnect, events: {} };
  eventTypes.forEach((evt) => {
    const h = eventHandler(evt);
    handlers.events[evt] = h;
    socket.on(evt, h);
  });

  handlersAttached = true;
}

/** Pause incoming event processing. */
export function setPaused(v) {
  paused = v;
  const cur = uiState$.value;
  uiState$.next({ ...cur, paused: v });
}

/** Stop stream and close socket. */
export function closeUiStream() {
  if (!handlersAttached) return;
  socket.off('connect', handlers.connect);
  socket.off('disconnect', handlers.disconnect);
  Object.entries(handlers.events).forEach(([evt, h]) => socket.off(evt, h));
  handlersAttached = false;
}

/**
 * Fold events into ui state.
 * @param {UiState} state
 * @param {Array<Object>} events
 * @returns {UiState}
 */
function reduceEvents(state, events) {
  const next = {
    paused: state.paused,
    lastTickSeen: state.lastTickSeen,
    lastTick: state.lastTick,
    counters: { ...state.counters },
    rooms: new Map(state.rooms),
    zones: new Map(state.zones),
    plants: new Map(state.plants),
  };
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    if (typeof ev.tick === 'number' && (next.lastTick === null || ev.tick > next.lastTick)) {
      next.lastTick = ev.tick;
    }
    if (typeof ev.type === 'string') {
      const prefix = ev.type.split('.')[0];
      next.counters[prefix] = (next.counters[prefix] || 0) + 1;
    }
    // Only record lastTickSeen on tick.summary to establish heartbeat
    if (ev.type === 'tick.summary' && typeof ev.tick === 'number') {
      next.lastTickSeen = ev.tick;
    }
    if (ev.roomId) {
      const prev = next.rooms.get(ev.roomId) || { id: ev.roomId };
      next.rooms.set(ev.roomId, { ...prev, ...ev });
    }
    if (ev.zoneId) {
      const prev = next.zones.get(ev.zoneId) || { id: ev.zoneId, roomId: ev.roomId };
      next.zones.set(ev.zoneId, { ...prev, ...ev });
    }
    if (ev.plantId) {
      const prev = next.plants.get(ev.plantId) || { id: ev.plantId, zoneId: ev.zoneId };
      next.plants.set(ev.plantId, { ...prev, ...ev });
    }
  }
  return next;
}

/** React hook for connection state. */
export function useConnection() {
  const [val, setVal] = useState(connection$.value);
  useEffect(() => {
    const s = connection$.subscribe(setVal);
    return () => s.unsubscribe();
  }, []);
  return val;
}

/** React hook for ui state. */
export function useUiState() {
  const [val, setVal] = useState(uiState$.value);
  useEffect(() => {
    const s = uiState$.subscribe(setVal);
    return () => s.unsubscribe();
  }, []);
  return val;
}

/** React hook for dev logs. */
export function useDevLog() {
  const [val, setVal] = useState(devLog$.value);
  useEffect(() => {
    const s = devLog$.subscribe(setVal);
    return () => s.unsubscribe();
  }, []);
  return val;
}
