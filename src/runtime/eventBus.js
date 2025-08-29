// src/runtime/eventBus.js
// RxJS based event layer used for telemetry and visualization.
// Events are semantic and not commands.

import { Subject } from 'rxjs';
import { bufferTime, filter, share } from 'rxjs/operators';

/**
 * Raw event stream emitting { type, payload, tick, level, ts } objects.
 * @type {Subject<{type:string,payload:any,tick?:number,level?:string,ts:number}>}
 */
export const events$ = new Subject();

/**
 * UI stream batches for front-end (arrays of events).
 * Batches every 200ms; drops empty batches.
 */
export const uiStream$ = events$.pipe(
  bufferTime(200),
  filter(batch => Array.isArray(batch) && batch.length > 0),
  share()
);

/**
 * Emit a semantic event for observers (UI, logs, tests).
 * @param {string} type
 * @param {object} payload
 * @param {number} [tick=0]
 * @param {string} [level='info']
 */
export function emit(type, payload = {}, tick = 0, level = 'info') {
  events$.next({ type, payload, tick, level, ts: Date.now() });
}

export default { emit, events$, uiStream$ };
