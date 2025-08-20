/* eslint-disable */
// … die Datei beginnt unverändert oben …
/**
 * Zone aggregates devices and plants for simulation ticks.
 * @module engine/Zone
 */
import { ensureEnv, resetEnvAggregates, getZoneVolume, clamp } from './deviceUtils.js';
import { env, AIR_DENSITY, AIR_CP, saturationMoistureKgPerM3 } from '../config/env.js';
import { resolveTickHours } from '../lib/time.js';
import { Plant } from './Plant.js';
import { createDevice } from './factories/deviceFactory.js';

export class Zone {
  constructor({
    id,
    name = 'Unnamed Zone',
    area = 10,
    height,                // Inherited via Room/Structure
    tickLengthInHours,
    runtime = {},
    roomId = null,
    structureId = null,
  } = {}) {
    this.id = id;
    this.name = name;
    this.area = Number(area);
    this.height = height; // Let validation/inheritance handle Number() conversion and defaults
    this.tickLengthInHours = resolveTickHours({ tickLengthInHours });
    this.roomId = roomId;
    this.structureId = structureId;

    // Runtime dependencies
    this.runtime = runtime;
    this.logger = runtime.logger ?? console;
    this.costEngine = runtime.costEngine;
    this.rng = runtime.rng;
    this.strainPriceMap = runtime.strainPriceMap;
    this.devicePriceMap = runtime.devicePriceMap;
    this.blueprints = runtime.blueprints;

    this.devices = [];
    this.plants = [];
    this.plantTemplate = null; // { strain, method, area_m2 }

    this.environment = {
      temperature: env?.defaults?.temperatureC ?? 24,
      humidity: env?.defaults?.relativeHumidity ?? 0.6,
      ppfd: 0,
      co2ppm: env?.defaults?.co2ppm ?? 420,
      moistureKg: env?.defaults?.moistureKg ?? 0,
      nutrients: { N: 100, P: 100, K: 100 },
      _heatW: 0,
      _waterKgDelta: 0,
      _co2PpmDelta: 0,
    };

    this.runtime.lightsOn = true;
    this.deathStats = {};
    this.water = 0.5;
    this.nutrientLevel = 0.5;
  }

  addDevice(device) {
    if (!device) return;
    this.devices.push(device);
    device.zoneRef = this;
  }

  addPlant(plant) {
    if (!plant) return;
    this.plants.push(plant);
    if (!this.plantTemplate) {
      this.plantTemplate = { strain: plant.strain, method: plant.method, area_m2: plant.area_m2 };
    }
    if (this.costEngine && plant?.strain?.id) {
      this.costEngine.bookSeeds(plant.strain.id, 1);
    }
  }

  // --- Public Methods (for tickMachine) ------------------------------------

  /**
   * Apply device effects for the current tick.
   * @param {number} tickIndex
   */
  applyDevices(tickIndex) {
    const s = ensureEnv(this);
    resetEnvAggregates(s);
    this.#manageLightCycle(tickIndex);
    this.#updateDeviceStatus();
    this.#applyDeviceEffects();
  }

  /**
   * Derive environmental values after device effects.
   */
  deriveEnvironment() {
    this.#applyThermalUpdate();
    this.#applyHumidityAndCO2Update();
  }

  /**
   * Handle irrigation and nutrient supply for plants.
   */
  irrigateAndFeed() {
    if (!this.costEngine) return;
    const s = ensureEnv(this);

    s.reservoir ??= { waterL: 0, capacityL: this.area * 10, nutrientCapacity: { N: 150, P: 150, K: 150 } };

    // Simple top-up strategy to 70% of tank
    const targetWater = s.reservoir.capacityL * 0.7;
    const addWater = Math.max(0, targetWater - s.reservoir.waterL);

    const targetNutrients = { N: 80, P: 50, K: 90 };
    const addN = Math.max(0, targetNutrients.N - (s.nutrients?.N ?? 0));
    const addP = Math.max(0, targetNutrients.P - (s.nutrients?.P ?? 0));
    const addK = Math.max(0, targetNutrients.K - (s.nutrients?.K ?? 0));

    const consumedNutrients = { N: addN, P: addP, K: addK };
    const totalWaterL = addWater;

    const meta = { roomId: this.roomId, zoneId: this.id };
    if (totalWaterL > 0) {
      this.costEngine.bookWater(totalWaterL, meta);
    }
    if (consumedNutrients.N > 0 || consumedNutrients.P > 0 || consumedNutrients.K > 0) {
      this.costEngine.bookFertilizer(consumedNutrients, meta);
    }

    s.reservoir.waterL += totalWaterL;
    s.nutrients.N += consumedNutrients.N;
    s.nutrients.P += consumedNutrients.P;
    s.nutrients.K += consumedNutrients.K;

    if (s.reservoir.waterL > s.reservoir.capacityL) {
      s.reservoir.waterL = s.reservoir.capacityL;
      for (const plant of this.plants) {
        plant.payload.waterStress = Math.max(plant.payload.waterStress ?? 0, 0.2);
      }
    }

    for (const k of ['N', 'P', 'K']) {
      if (s.nutrients[k] > s.reservoir.nutrientCapacity[k]) {
        s.nutrients[k] = s.reservoir.nutrientCapacity[k];
        for (const plant of this.plants) {
          plant.payload.nutrientStress = Math.max(plant.payload.nutrientStress ?? 0, 0.2);
        }
      }
    }

    this.water = s.reservoir.waterL / s.reservoir.capacityL;
    const npkAvg = (s.nutrients.N / s.reservoir.nutrientCapacity.N +
                    s.nutrients.P / s.reservoir.nutrientCapacity.P +
                    s.nutrients.K / s.reservoir.nutrientCapacity.K) / 3;
    this.nutrientLevel = npkAvg;
  }

  async updatePlants(tickLengthInHours, tickIndex) {
    await this.#updatePlants(tickLengthInHours, tickIndex);
  }

  /**
   * Harvest plants and handle device replacement.
   */
  harvestAndInventory(tickIndex) {
    this.#harvestAndReplant(tickIndex);
    this.#replaceBrokenDevices();
  }

  /**
   * Perform accounting for the tick.
   * @param {number} tickIndex
   */
  accounting(tickIndex) {
    this.#bookDeviceCosts(tickIndex);
  }

  // --- Helper Methods ------------------------------------------------------

  #findBlueprint(query = {}) {
    const { id, kind, nameIncludes } = query;
    if (id) return this.blueprints.find(b => b.id === id) ?? null;
    const candidates = this.blueprints.filter(b =>
      (kind ? b.kind === kind : true) &&
      (nameIncludes ? (b.name ?? '').toLowerCase().includes(String(nameIncludes).toLowerCase()) : true)
    );
    return candidates[0] ?? null;
  }

  #manageLightCycle(tickIndex) {
    if (!this.plants.length) return;

    // Use the first plant as a representative for the whole zone's cycle
    const representativePlant = this.plants[0];
    const stage = representativePlant.stage;
    const lightCycle = representativePlant.strain?.environmentalPreferences?.lightCycle;

    if (!lightCycle) return; // No light cycle data for this strain

    const cycle = lightCycle[stage] ?? lightCycle.default ?? [18, 6];
    const lightHours = cycle[0];

    const currentSimHour = (tickIndex * this.tickLengthInHours) % 24;

    const lightsOn = currentSimHour < lightHours;
    // expose lights-on state for plant stress calculations
    if (this.runtime) {
      this.runtime.lightsOn = lightsOn;
    }

    for (const device of this.devices) {
      if (device.kind === 'Lamp') {
        device.toggle(lightsOn ? 'on' : 'off');
      }
    }
  }

  #updateDeviceStatus() {
    for (const d of this.devices) {
      d.tick?.();
    }
  }

  #applyDeviceEffects() {
    for (const d of this.devices) {
      try {
        if (d.status === 'ok' && typeof d.applyEffect === 'function') {
          d.applyEffect(this);
        }
      } catch (e) {
        this.logger?.error?.({ err: e, deviceId: d?.id, kind: d?.kind, name: d?.name }, 'Device applyEffect failed');
      }
    }
  }

  async #updatePlants(tickLengthInHours, tickIndex = 0) {
    for (const p of this.plants) {
      try {
        if (typeof p.tick === 'function') {
          await p.tick(this, tickLengthInHours, tickIndex);
        }
      } catch (e) {
        this.logger?.error?.({ err: e, plantId: p?.id, label: p?.label }, 'Plant tick failed');
      }
    }
    const survivors = [];
    for (const p of this.plants) {
      if (p.isDead) {
        const cause = p.causeOfDeath ?? 'unknown';
        this.deathStats[cause] = (this.deathStats[cause] ?? 0) + 1;
      } else {
        survivors.push(p);
      }
    }
    const removed = this.plants.length - survivors.length;
    this.plants = survivors;
    if (removed > 0) {
      this.logger?.info?.({ removed }, 'Removed dead plants');
    }
  }

  /**
   * 🔧 NEW: Partial harvest each tick + immediate replant to capacity.
   */
  #harvestAndReplant(tickIndex = 0) {
    if (!this.costEngine || !this.rng || !this.strainPriceMap) return;

    // Split plants into ready/keep
    const ready = [];
    const keep = [];
    for (const p of this.plants) {
      if (p.stage === 'harvestReady') ready.push(p);
      else if (!p.isDead && p.stage !== 'dead') keep.push(p);
    }

    if (ready.length === 0) {
      return; // nothing to do this tick
    }

    // Harvest ready plants
    let harvested = 0;
    let revenueEUR = 0;
    for (const plant of ready) {
      const yieldGrams = plant.calculateYield();
      const strainId = plant.strain?.id;
      const priceInfo = this.strainPriceMap.get(strainId);
      const pricePerGram = priceInfo?.harvestPricePerGram ?? 0;
      const revenue = yieldGrams * pricePerGram;

      if (revenue > 0) {
        this.costEngine.bookRevenue('Harvest', revenue);
        revenueEUR += revenue;
      }
      harvested += 1;
      this.logger?.info?.(
        { plantId: String(plant.id).slice(0, 8), yieldGrams: Number(yieldGrams.toFixed?.(2) ?? yieldGrams), revenue: Number(revenue.toFixed?.(2) ?? revenue) },
        'HARVEST_PLANT'
      );
    }

    // Remove harvested plants from zone
    this.plants = keep;

    // Replant to capacity from zone template (or first kept/ready plant)
    const template = this.plantTemplate || (ready[0] || keep[0]
      ? { strain: (ready[0] || keep[0]).strain, method: (ready[0] || keep[0]).method, area_m2: (ready[0] || keep[0]).area_m2 }
      : null
    );
    if (template) {
      const areaPerPlant = template.method?.areaPerPlant ?? template.area_m2 ?? 0.25;
      const capacity = Math.max(0, Math.floor(this.area / areaPerPlant));
      const need = Math.max(0, capacity - this.plants.length);
      for (let i = 0; i < need; i++) {
        const newPlant = new Plant({ strain: template.strain, method: template.method, rng: this.rng, area_m2: areaPerPlant });
        this.addPlant(newPlant);
      }
      this.logger?.info?.({ harvested, revenueEUR: Number(revenueEUR.toFixed?.(2) ?? revenueEUR), replanted: need }, 'HARVEST_ZONE_TICK');
    }
  }

  #replaceBrokenDevices() {
    if (!this.costEngine || !this.blueprints || !this.devicePriceMap) return;
    const runtimeCtx = { zone: this, tickLengthInHours: this.tickLengthInHours, devicePriceMap: this.devicePriceMap };
    for (let i = 0; i < this.devices.length; i++) {
      const device = this.devices[i];
      if (device.status === 'broken') {
        this.logger.warn({ deviceId: device.id, name: device.name }, 'Device BROKEN. Replacing...');

        this.costEngine.bookCapex(device.blueprintId, 1);

        const blueprint = this.#findBlueprint({ id: device.blueprintId });
        if (blueprint) {
          const newDevice = createDevice(blueprint, runtimeCtx);
          this.devices[i] = newDevice;
          this.logger.info({ oldDeviceId: device.id, newDeviceId: newDevice.id, name: newDevice.name }, 'Device REPLACED.');
        } else {
          this.logger.error({ blueprintId: device.blueprintId }, 'Could not find blueprint to replace broken device. Removing device.');
          this.devices.splice(i, 1);
          i--;
        }
      }
    }
  }

  #bookDeviceCosts(tickIndex) {
    if (!this.costEngine) return;
    const meta = { roomId: this.roomId, zoneId: this.id };
    for (const d of (this.devices ?? [])) {
      const kWh = d.estimateEnergyKWh?.(this.tickLengthInHours) ?? 0;
      const priceKey = d.blueprintId ?? d.id;
      if (kWh > 0) this.costEngine.bookDeviceEnergy(priceKey, kWh, meta);
      this.costEngine.bookDeviceMaintenance(priceKey, tickIndex, meta);
    }
  }

  #applyThermalUpdate() {
    const s = ensureEnv(this);
    const tickH  = resolveTickHours(this);
    const dtSec  = Math.max(1, tickH * (env?.factors?.hourToSec ?? 3600));

    const rhoAir = Number(env?.physics?.airDensity ?? AIR_DENSITY ?? 1.2);
    const cpAir  = Number(env?.physics?.airCp ?? AIR_CP ?? 1005);

    const volume = getZoneVolume(this);
    const airMass = Math.max(1e-6, volume * rhoAir);

    const massMultiplier = Number(env?.defaults?.thermalMassMultiplier ?? 200);
    const C_eff = airMass * cpAir * Math.max(1, massMultiplier);

    const heatW = Number(s._heatW ?? 0);
    const Q = heatW * dtSec;
    const dT_heat = Q / C_eff;

    s.temperature = Number(s.temperature ?? 24) + dT_heat;
  }

  #applyHumidityAndCO2Update() {
    const s = ensureEnv(this);
    const tickH  = resolveTickHours(this);
    const dtSec  = Math.max(1, tickH * (env?.factors?.hourToSec ?? 3600));

    // Humidity: convert water mass change to RH change (very simplified)
    const vol = getZoneVolume(this);
    const moistureKgPerM3 = Number(s.moistureKg) / Math.max(1e-9, vol);
    const satKgPerM3 = saturationMoistureKgPerM3(s.temperature);
    let rh = Math.max(0, Math.min(0.999, moistureKgPerM3 / Math.max(1e-12, satKgPerM3)));
    rh = clamp(rh, env?.clamps?.humidityMin ?? 0.1, env?.clamps?.humidityMax ?? 0.95);

    // Aggregated deltas from devices/plants
    const waterDelta = Number(s._waterKgDelta ?? 0);
    const co2DeltaPpm = Number(s._co2PpmDelta ?? 0);

    // Apply (extremely simplified) effects
    s.moistureKg = Math.max(0, Number(s.moistureKg ?? 0) + waterDelta);
    s.co2ppm = Math.max(0, Number(s.co2ppm ?? 420) + co2DeltaPpm);

    // Recalculate RH with updated moisture
    const newMoisturePerM3 = Math.max(0, s.moistureKg / Math.max(1e-9, vol));
    const newRh = Math.max(0, Math.min(0.999, newMoisturePerM3 / Math.max(1e-12, satKgPerM3)));
    s.humidity = clamp(newRh, env?.clamps?.humidityMin ?? 0.1, env?.clamps?.humidityMax ?? 0.95);

    // Reset tick aggregates
    s._waterKgDelta = 0;
    s._co2PpmDelta = 0;
    s.ppfd = Number(s.ppfd ?? 0); // ensure numeric
  }

  getTickCosts(tickIndex) {
    if (!this.costEngine) {
      return { total: 0, energy: 0, maintenance: 0, water: 0, fertilizer: 0, other: 0, devices: [] };
    }

    let totalEnergyCost = 0;
    let totalMaintenanceCost = 0;
    const deviceCosts = [];

    for (const device of this.devices) {
      const kWh = device.estimateEnergyKWh?.(this.tickLengthInHours) ?? 0;
      const energyPrice = this.costEngine.getEnergyPriceForDevice(device.blueprintId ?? device.id);
      const energyCost = kWh * energyPrice;

      const baseMaintenance = this.costEngine.devicePriceMap.get(device.blueprintId)?.baseMaintenanceCostPerTick ?? 0;
      const inc = this.costEngine.devicePriceMap.get(device.blueprintId)?.costIncreasePer1000Ticks ?? 0;
      const factor = 1 + inc * Math.floor(tickIndex / 1000);
      const maintenanceCost = baseMaintenance * factor;

      totalEnergyCost += energyCost;
      totalMaintenanceCost += maintenanceCost;
      deviceCosts.push({
        id: device.id,
        kind: device.kind,
        energyCost,
        maintenanceCost,
        total: energyCost + maintenanceCost,
      });
    }

    const { waterEUR, fertilizerEUR } = this.costEngine.getWaterAndFertilizerTotalsForZone(this.id);
    const otherExpense = 0;

    const total = totalEnergyCost + totalMaintenanceCost + (waterEUR ?? 0) + (fertilizerEUR ?? 0) + otherExpense;
    return {
      total,
      energy: totalEnergyCost,
      maintenance: totalMaintenanceCost,
      water: waterEUR ?? 0,
      fertilizer: fertilizerEUR ?? 0,
      other: otherExpense,
      devices: deviceCosts,
    };
  }

  get status() {
    const s = ensureEnv(this);
    return {
      temperatureC: s.temperature,
      humidity: s.humidity,
      co2ppm: s.co2ppm,
      ppfd: s.ppfd,
      area: this.area,
      height: this.height,
      volume: getZoneVolume(this)
    };
  }
}
