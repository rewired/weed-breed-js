// src/lib/time.js
import { TICK_HOURS_DEFAULT } from '../config/env.js';

export function resolveTickHours(runtimeCtx) {
  return Number(runtimeCtx?.tickLengthInHours ?? TICK_HOURS_DEFAULT);
}
