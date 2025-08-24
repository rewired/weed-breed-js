import { computeBudDeltaTick } from '../src/engine/budGrowth.js';

test('bud growth baseline', () => {
  const delta = computeBudDeltaTick({
    basePerDay_g: 1.5,
    tempC: 26,
    tempOptC: 26,
    tempWidthC: 6,
    CO2ppm: 900,
    co2HalfSat_ppm: 900,
    DLI: 20,
    dliHalfSat_mol_m2d: 20,
    ppfd: 500,
    ppfdMax: 1000,
    tickHours: 24
  });
  expect(delta).toBeGreaterThan(0.3);
  expect(delta).toBeLessThan(0.45);
});
