/**
 * Time related helpers.
 * @module lib/time
 */
import { TICK_HOURS_DEFAULT } from '../config/env.js';

/**
 * Resolve the tick length in hours for the given runtime context.
 * @param {object} [runtimeCtx] - Optional runtime context containing `tickLengthInHours`.
 * @returns {number} Tick length in hours.
 */
export function resolveTickHours(runtimeCtx) {
  return Number(runtimeCtx?.tickLengthInHours ?? TICK_HOURS_DEFAULT);
}
