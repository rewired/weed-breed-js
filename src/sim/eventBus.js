// @ts-nocheck
/**
 * RxJS based event layer used for telemetry and visualization.
 * Events are semantic and not commands.
 * @module sim/eventBus
 */

import { Subject } from 'rxjs';
import { bufferTime, filter, share } from 'rxjs/operators';

/**
 * Raw event stream emitting `{ type, payload, tick, level, ts }` objects.
 * @type {Subject<{type:string,payload:object,tick:number,level:string,ts:number}>}
 */
export const events$ = new Subject();

/** @type {(e: { level?: string }) => boolean} */
const levelFilter = e => e?.level !== 'debug';

/**
 * Buffered event stream for UI consumption.
 * @type {import('rxjs').Observable<Array>}
 */
export const uiStream$ = events$.pipe(
  filter(levelFilter),
  bufferTime(50),
  share()
);

/**
 * Emit a semantic event for observers (UI, logs, tests).
 * @param {string} type
 * @param {object} payload
 * @param {number} tick
 * @param {string} level
 */
export function emit(type, payload = {}, tick = 0, level = 'info') {
  events$.next({ type, payload, tick, level, ts: Date.now() });
}

export default { emit, events$, uiStream$ };
