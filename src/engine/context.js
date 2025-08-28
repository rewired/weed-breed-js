import { createRng } from './rng.js';

/**
 * Factory for the tick context passed through the simulation.
 *
 * @typedef {Object} TickContext
 * @property {{random: () => number}} rng Deterministic RNG instance
 * @property {() => number} nowUtc Function returning the current time in ms
 * @property {number} tickIndex Current tick number
 * @property {number} tickDurationHours Duration of one tick in hours
 * @property {Object} [envOverrides] Optional environment overrides
 */

/**
 * Create a TickContext object.
 *
 * @param {Object} [opts]
 * @param {string|number} [opts.seed] Seed for the RNG
 * @param {number} [opts.tickIndex=0] Index of current tick
 * @param {number} [opts.tickDurationHours=1] Tick duration in hours
 * @param {() => number} [opts.nowUtc=Date.now] Time provider
 * @param {Object} [opts.envOverrides] Environment overrides
 * @returns {TickContext}
 */
export function createTickContext({
  seed = 'weed-breed',
  tickIndex = 0,
  tickDurationHours = 1,
  nowUtc = Date.now,
  envOverrides,
} = {}) {
  return {
    rng: createRng(seed),
    nowUtc,
    tickIndex,
    tickDurationHours,
    envOverrides,
  };
}

export default createTickContext;
