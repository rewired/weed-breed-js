import { emit } from './eventBus.js';

/**
 * Attach instrumentation hooks to Plant and Zone classes.
 * @param {{Plant: any, Zone: any}} classes
 */
export function attach({ Plant, Zone }) {
  if (Plant && !Plant.prototype.__instrumented) {
    const origTick = Plant.prototype.tick;
    Plant.prototype.tick = async function(zone, tickLengthInHours, tickIndex) {
      const prevStage = this.stage;
      await origTick.call(this, zone, tickLengthInHours, tickIndex);
      if (this.stage !== prevStage) {
        const t = zone?.tickLengthInHours || tickLengthInHours || 1;
        const ticksPerDay = Math.round(24 / t);
        emit('phase-change', {
          plantId: this.id,
          zoneId: zone?.id,
          from: prevStage,
          to: this.stage,
          tick: tickIndex,
          day: Math.floor(tickIndex / ticksPerDay)
        });
      }
    };
    Plant.prototype.__instrumented = true;
  }

  if (Zone && !Zone.prototype.__instrumented) {
    const origUpdatePlants = Zone.prototype.updatePlants;
    Zone.prototype.updatePlants = async function(tickLengthInHours, tickIndex) {
      const before = new Map(this.plants.map(p => [p.id, p]));
      await origUpdatePlants.call(this, tickLengthInHours, tickIndex);
      const after = new Set(this.plants.map(p => p.id));
      const t = this.tickLengthInHours || tickLengthInHours || 1;
      const ticksPerDay = Math.round(24 / t);
      const day = Math.floor(tickIndex / ticksPerDay);
      for (const [id, p] of before.entries()) {
        if (!after.has(id)) {
          emit('death', {
            plantId: id,
            zoneId: this.id,
            reason: p.causeOfDeath || 'unknown',
            tick: tickIndex,
            day,
            strain: p.strain,
            method: p.method
          });
        }
      }
    };

    const origHarvestAndInventory = Zone.prototype.harvestAndInventory;
    Zone.prototype.harvestAndInventory = function(tickIndex) {
      const before = new Map(this.plants.map(p => [p.id, p]));
      origHarvestAndInventory.call(this, tickIndex);
      const after = new Map(this.plants.map(p => [p.id, p]));
      const t = this.tickLengthInHours || 1;
      const ticksPerDay = Math.round(24 / t);
      const day = Math.floor(tickIndex / ticksPerDay);
      for (const [id, p] of before.entries()) {
        if (!after.has(id)) {
          const buds = p.state?.biomassPartition?.buds_g ?? 0;
          emit('harvest', {
            plantId: id,
            zoneId: this.id,
            buds_g: buds,
            tick: tickIndex,
            day,
            strain: p.strain,
            method: p.method
          });
        }
      }
      for (const [id, p] of after.entries()) {
        if (!before.has(id)) {
          emit('replant', {
            zoneId: this.id,
            newPlantId: id,
            tick: tickIndex,
            day,
            strain: p.strain,
            method: p.method
          });
        }
      }
    };

    const origDebugDailyLog = Zone.prototype.debugDailyLog;
    Zone.prototype.debugDailyLog = function(day) {
      const totalBiomass = this.plants.reduce((s, p) => s + (p.state?.biomassFresh_g ?? 0), 0);
      const totalBuds = this.plants.reduce((s, p) => s + (p.state?.biomassPartition?.buds_g ?? 0), 0);
      const plantsTotal = this.plants.length;
      const harvestedPlants = this.harvestedPlants;
      const deadPlants = Object.values(this.deathStats ?? {}).reduce((a, b) => a + b, 0);
      const lightH = this._debugDay?.lightHours || 0;
      const avgPPFD = lightH > 0 ? this._debugDay.ppfdSum / lightH : undefined;
      const avgDLI = avgPPFD != null ? (avgPPFD * 3600 * lightH) / 1e6 : undefined;
      const totalH = this._debugDay?.totalHours || 0;
      const meanTemp = totalH > 0 ? this._debugDay.tempSum / totalH : undefined;
      emit('zone-daily', {
        zoneId: this.id,
        day,
        totalBiomass_g: totalBiomass,
        totalBuds_g: totalBuds,
        plantsTotal,
        harvestedPlants,
        deadPlants,
        avgPPFD_umol_m2s: avgPPFD,
        avgDLI_mol_m2d: avgDLI,
        meanTemp_C: meanTemp
      });
      return origDebugDailyLog ? origDebugDailyLog.call(this, day) : undefined;
    };

    Zone.prototype.__instrumented = true;
  }
}

