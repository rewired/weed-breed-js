import { events$ } from './eventBus.js';

export class StatsCollector {
  constructor(zones = []) {
    this.zones = new Map(zones.map(z => [z.id, z]));
    this.totalBuds_g = 0;
    this.totalBiomass_g = 0;
    this.zoneTotals = {};

    events$.subscribe(e => {
      if (e.type === 'sim.tickCompleted') {
        const zone = this.zones.get(e.payload.zoneId);
        if (zone) {
          this.recordZone(zone);
        }
      }
    });
  }

  recordZone(zone) {
    let buds = 0;
    let biomass = 0;
    for (const plant of zone.plants ?? []) {
      buds += plant.state?.biomassPartition?.buds_g ?? 0;
      biomass += plant.state?.biomassFresh_g ?? 0;
    }
    this.totalBuds_g += buds;
    this.totalBiomass_g += biomass;
    const zt = this.zoneTotals[zone.id] ?? { buds_g: 0, biomass_g: 0 };
    zt.buds_g += buds;
    zt.biomass_g += biomass;
    this.zoneTotals[zone.id] = zt;
  }

  report() {
    return {
      totalBuds_g: this.totalBuds_g,
      totalBiomass_g: this.totalBiomass_g,
      zones: this.zoneTotals
    };
  }

  logTotals(logger = console) {
    logger.info(this.report(), 'STATS');
  }
}
