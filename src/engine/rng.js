import seedrandom from 'seedrandom';

/**
 * Create a deterministic pseudo random number generator.
 *
 * @param {string|number} [seed='weed-breed'] Seed for the generator.
 * @returns {{random: () => number}} RNG instance exposing a single `random` method.
 */
export function createRng(seed = 'weed-breed') {
  const rng = seedrandom(String(seed));
  return {
    /**
     * Generate a floating point number in [0,1).
     * @returns {number}
     */
    random: () => rng(),
  };
}

export default createRng;
