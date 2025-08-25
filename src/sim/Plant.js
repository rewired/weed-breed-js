import { v4 as uuidv4 } from 'uuid';

export class Plant {
  constructor({ id = uuidv4(), biomass_g = 0, buds_g = 0 } = {}) {
    this.id = id;
    this.biomass_g = biomass_g;
    this.buds_g = buds_g;
    this.state = 'growing';
    this.alive = true;
    this.onHarvest = null; // assigned by Zone
    this._harvested = false;
  }

  update(tctx) {
    if (!this.alive) return;
    // simplistic growth model
    this.biomass_g += 1;
    this.buds_g += 0.2;
  }

  harvest(tctx) {
    if (this._harvested) return 0;
    this._harvested = true;
    const buds = this.buds_g;
    if (typeof this.onHarvest === 'function') {
      this.onHarvest({ ...tctx, plantId: this.id, buds_g: buds });
    }
    this.state = 'harvested';
    this.alive = false;
    this.buds_g = 0;
    return buds;
  }
}
