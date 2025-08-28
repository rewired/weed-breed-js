import { createRng } from '../../src/engine/rng.js';

describe('RNG', () => {
  test('same seed yields identical sequences', () => {
    const a = createRng('seed');
    const b = createRng('seed');
    const seqA = [a.random(), a.random(), a.random()];
    const seqB = [b.random(), b.random(), b.random()];
    expect(seqA).toEqual(seqB);
  });

  test('different seeds yield different sequences', () => {
    const a = createRng('seed-a');
    const b = createRng('seed-b');
    const seqA = [a.random(), a.random(), a.random()];
    const seqB = [b.random(), b.random(), b.random()];
    expect(seqA).not.toEqual(seqB);
  });
});
