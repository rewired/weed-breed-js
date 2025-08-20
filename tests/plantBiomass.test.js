import { Plant } from '../src/engine/Plant.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const strainData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/strains/ak-47.json'), 'utf8'));

function makeCtx(overrides = {}) {
  const zone = {
    tickLengthInHours: 1,
    temperatureC: 25,
    co2ppm: 1200,
    humidity: 0.6,
    water: 1,
    npk: 1,
    ...overrides,
  };
  zone.environment = { ppfd: 600, ...(overrides.environment ?? {}) };
  if (overrides.ppfd != null) zone.environment.ppfd = overrides.ppfd;
  delete zone.ppfd;
  return { zone };
}

describe('Plant biomass model', () => {
  const strain = { ...strainData, noise: { enabled: false } };

  test('light scaling ~ linear', () => {
    let delta1;
    const p1 = new Plant({ strain, stage: 'vegetation', onBiomassUpdate: (pl, d) => { delta1 = d; } });
    p1.updateBiomass(makeCtx({ ppfd: 400 }));

    let delta2;
    const p2 = new Plant({ strain, stage: 'vegetation', onBiomassUpdate: (pl, d) => { delta2 = d; } });
    p2.updateBiomass(makeCtx({ ppfd: 800 }));
    expect(delta2.dW_net).toBeCloseTo(delta1.dW_net * 2, 1);
  });

  test('Q10 temperature response', () => {
    let base, high, low;
    const pBase = new Plant({ strain, onBiomassUpdate: (pl, d) => { base = d; } });
    pBase.updateBiomass(makeCtx());

    const pHigh = new Plant({ strain, onBiomassUpdate: (pl, d) => { high = d; } });
    pHigh.updateBiomass(makeCtx({ temperatureC: 35 }));

    const pLow = new Plant({ strain, onBiomassUpdate: (pl, d) => { low = d; } });
    pLow.updateBiomass(makeCtx({ temperatureC: 15 }));

    expect(high.factors.f_T).toBeCloseTo(1.2, 1);
    expect(low.factors.f_T).toBeCloseTo(0.5, 1);
  });

  test('CO2 factor and water limitation', () => {
    let d400, d1200, dWater, dBase, dNpk;
    const p1 = new Plant({ strain, onBiomassUpdate: (pl, d) => { d400 = d; } });
    p1.updateBiomass(makeCtx({ co2ppm: 400 }));

    const p2 = new Plant({ strain, onBiomassUpdate: (pl, d) => { d1200 = d; } });
    p2.updateBiomass(makeCtx({ co2ppm: 1200 }));

    expect(d400.factors.f_CO2).toBeLessThanOrEqual(0.8);
    expect(d1200.factors.f_CO2).toBeCloseTo(1.0, 2);

    const p3 = new Plant({ strain, onBiomassUpdate: (pl, d) => { dWater = d; } });
    p3.updateBiomass(makeCtx({ water: 0.5 }));
    const p4 = new Plant({ strain, onBiomassUpdate: (pl, d) => { dBase = d; } });
    p4.updateBiomass(makeCtx());
    expect(dWater.dW_net / dBase.dW_net).toBeLessThan(0.7);

    const p5 = new Plant({ strain, onBiomassUpdate: (pl, d) => { dNpk = d; } });
    p5.updateBiomass(makeCtx({ npk: 0.5 }));
    expect(dNpk.dW_net / dBase.dW_net).toBeGreaterThan(0.5);
    expect(dNpk.dW_net / dBase.dW_net).toBeLessThan(0.8);
  });

  test('cap prevents overshoot', () => {
    let delta;
    const p = new Plant({ strain, stage: 'vegetation', onBiomassUpdate: (pl, d) => { delta = d; } });
    p.updateBiomass(makeCtx());
    const first = delta.dW_net;
    for (let i = 0; i < 200; i++) {
      p.updateBiomass(makeCtx());
    }
    const last = delta.dW_net;
    expect(p.state.biomassDry_g).toBeLessThanOrEqual(90.0001);
    expect(last).toBeLessThan(first);
  });

  test('deterministic noise and telemetry', () => {
    const strainNoise = { ...strainData, noise: { enabled: true, pct: 0.02 } };
    const p1 = new Plant({ strain: strainNoise, noiseSeed: 1 });
    const p2 = new Plant({ strain: strainNoise, noiseSeed: 1 });
    const seq1 = [], seq2 = [];
    p1.onBiomassUpdate = (pl, d) => seq1.push(d.dW_net);
    p2.onBiomassUpdate = (pl, d) => seq2.push(d.dW_net);
    for (let i = 0; i < 3; i++) {
      p1.updateBiomass(makeCtx());
      p2.updateBiomass(makeCtx());
    }
    expect(seq1).toEqual(seq2);

    const calls = [];
    const p3 = new Plant({ strain, onBiomassUpdate: (pl, d) => calls.push(d) });
    p3.updateBiomass(makeCtx());
    expect(calls.length).toBe(1);
  });

  test('flowering shifts partition to buds', () => {
    const p = new Plant({ strain, stage: 'flowering' });
    p.updateBiomass(makeCtx());
    const first = p.state.biomassPartition.buds_g;
    for (let i = 0; i < 20; i++) {
      p.updateBiomass(makeCtx());
    }
    expect(p.state.biomassPartition.buds_g).toBeGreaterThan(first);
  });
});

