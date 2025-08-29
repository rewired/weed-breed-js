// src/sim/eventBus.mjs
import { Subject } from 'rxjs';

/**
 * UI stream batches for the frontend. Other parts of the sim can push into it.
 * Keep API stable: push plain objects with { type, payload, ts }.
 */
export const uiStream$ = new Subject();

/**
 * Convenience: emit a single event into uiStream$.
 * @param {string} type
 * @param {any} payload
 * @param {number} [ts]
 */
export function emit(type, payload, ts = Date.now()) {
  uiStream$.next({ type, payload, ts });
}
