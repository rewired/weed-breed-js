import seedrandom from 'seedrandom';

export function createRng(seed = 'weed-breed') {
  const rng = seedrandom(seed);
  return {
    float: () => rng(),               // 0..1
    int: (min, max) => Math.floor(rng() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(rng() * arr.length)],
  };
}
