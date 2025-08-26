import { Zone } from '../src/engine/Zone.js';

test('recomputeMetrics aggregates legacy and engine plants', () => {
  const zone = new Zone({ id: 'z1', tickLengthInHours: 1 });
  zone.devices = [
    { kind: 'ClimateUnit', settings: { coolingCapacity: 2 }, _lastPowerFrac: 0.5 }
  ];
  zone.plants = [
    { biomass_g: 10, buds_g: 2 },
    { state: { biomassDry_g: 20 }, payload: { buds_g: 6 } }
  ];
  const metrics = zone.recomputeMetrics();
  expect(metrics.totalBiomass_g).toBeCloseTo(30);
  expect(metrics.totalBuds_g).toBeCloseTo(8);
  expect(metrics.plantsTotal).toBe(2);
  expect(metrics.alivePlants).toBe(2);
  expect(metrics.meanCoolingUtilization).toBeCloseTo(0.5);
});
