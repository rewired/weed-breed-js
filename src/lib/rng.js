/**
 * Random number generator utilities.
 * @module lib/rng
 */
import seedrandom from 'seedrandom';

/**
 * Create a deterministic random number generator.
 * @param {string} [seed='weed-breed'] - Seed value.
 * @returns {{float: function(): number, int: function(number, number): number, pick: function(Array): any}} RNG helpers.
 */
export function createRng(seed = 'weed-breed') {
  const rng = seedrandom(seed);
  return {
    float: () => rng(),               // 0..1
    int: (min, max) => Math.floor(rng() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(rng() * arr.length)],
  };
}
