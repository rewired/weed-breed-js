import { writeHarvestEvent } from '../lib/reporting/reportWriters.js';
import { Plant } from './Plant.js';

export class Zone {
  constructor({ id, plants = [] } = {}) {
    this.id = id || 'zone';
    this.plants = [];
    this.stats = { harvestedPlants: 0, totalBudsCollected_g: 0, budsCollectedToday_g: 0 };
    this.metrics = { totalBiomass_g: 0, totalBuds_g: 0 };
    for (const p of plants) this.addPlant(p);
  }

  addPlant(plant) {
    if (!plant) return;
    plant.onHarvest = this._onPlantHarvest.bind(this);
    this.plants.push(plant);
    this.recomputeMetrics();
  }

  recomputeMetrics() {
    this.metrics.totalBiomass_g = this.plants.reduce((a, p) => a + (p.biomass_g || 0), 0);
    this.metrics.totalBuds_g = this.plants.reduce((a, p) => a + (p.buds_g || 0), 0);
  }

  update(tctx) {
    const { tick, TICKS_PER_DAY } = tctx;
    if (tick % TICKS_PER_DAY === 0) {
      this.stats.budsCollectedToday_g = 0;
    }
    const survivors = [];
    const newPlants = [];
    for (const p of this.plants) {
      p.update(tctx);
      if (p.buds_g >= 20) {
        p.harvest({ ...tctx, zoneId: this.id });
        newPlants.push(new Plant());
      } else if (p.alive) {
        survivors.push(p);
      }
    }
    this.plants = survivors.concat(newPlants);
    this.recomputeMetrics();
  }

  harvestAll(tctx) {
    for (const p of this.plants) {
      p.harvest({ ...tctx, zoneId: this.id });
    }
    this.plants = this.plants.filter(p => p.alive);
    this.recomputeMetrics();
  }

  _onPlantHarvest(evt) {
    this.stats.harvestedPlants += 1;
    this.stats.totalBudsCollected_g += evt.buds_g;
    this.stats.budsCollectedToday_g += evt.buds_g;
    writeHarvestEvent({ ...evt, type: 'HARVEST', zoneId: this.id });
  }
}
