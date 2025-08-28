// src/lib/rng.mjs
/**
 * RNG adapter for seedrandom() to provide a uniform API:
 * - float(min=0, max=1)
 * - int(min, max)    [inclusive]
 * - pick(array)
 */
import seedrandom from 'seedrandom';

/** @typedef {{
 *  (): number;
 *  float?: (min?: number, max?: number) => number;
 *  int?: (min: number, max: number) => number;
 *  pick?: <T>(arr: T[]) => T;
 * }} RNGLike */

/**
 * Create a wrapped RNG with a consistent API from a seed.
 * @param {string|number} seed
 * @returns {RNGLike}
 */
export function createRng(seed) {
  const base = seedrandom(String(seed));
  if (typeof base.float !== 'function') {
    base.float = (min = 0, max = 1) => base() * (max - min) + min;
  }
  if (typeof base.int !== 'function') {
    base.int = (min, max) => {
      if (max < min) [min, max] = [max, min];
      return Math.floor(base() * (max - min + 1)) + min;
    };
  }
  if (typeof base.pick !== 'function') {
    base.pick = (arr) => arr[Math.floor(base() * arr.length)];
  }
  return base;
}

/**
 * Ensure an incoming rng-like has the uniform helpers attached.
 * @param {RNGLike} rng
 * @returns {RNGLike}
 */
export function ensureRng(rng) {
  if (typeof rng !== 'function') return createRng('wb-default');
  if (typeof rng.float !== 'function') {
    rng.float = (min = 0, max = 1) => rng() * (max - min) + min;
  }
  if (typeof rng.int !== 'function') {
    rng.int = (min, max) => {
      if (max < min) [min, max] = [max, min];
      return Math.floor(rng() * (max - min + 1)) + min;
    };
  }
  if (typeof rng.pick !== 'function') {
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  }
  return rng;
}
