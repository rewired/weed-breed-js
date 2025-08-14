// @ts-nocheck
// RxJS-Eventlayer gemäß ADR (§6)
// Events dienen Telemetrie/Visualisierung, keine Commands.

import { Subject } from 'rxjs';
import { bufferTime, filter, share } from 'rxjs/operators';

export const events$ = new Subject(); // { type, payload, tick, level, ts }

/** @type {(e: { level?: string }) => boolean} */
const levelFilter = e => e?.level !== 'debug';

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
