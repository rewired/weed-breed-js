import { StatsCollector } from '../src/sim/StatsCollector.js';

describe('StatsCollector', () => {
  test('tracks current plant biomass without cumulative growth', () => {
    const zone = {
      id: 'z1',
      plants: [
        { state: { biomassPartition: { buds_g: 5 }, biomassFresh_g: 10 } }
      ],
      deathStats: {}
    };
    const sc = new StatsCollector([zone]);
    // first record
    sc.recordZone(zone);
    expect(sc.totalBuds_g).toBeCloseTo(5);
    expect(sc.totalBiomass_g).toBeCloseTo(10);
    // second record with same plant weights
    sc.recordZone(zone);
    expect(sc.totalBuds_g).toBeCloseTo(5);
    expect(sc.totalBiomass_g).toBeCloseTo(10);
  });
});
