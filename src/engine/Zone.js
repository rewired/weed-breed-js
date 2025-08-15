// src/engine/Zone.js
import { ensureEnv, resetEnvAggregates, getZoneVolume, clamp } from './deviceUtils.js';
import { env, AIR_DENSITY, AIR_CP, TICK_HOURS_DEFAULT } from '../config/env.js';
import { Plant } from './Plant.js';
import { createDevice } from './factories/deviceFactory.js';

/**
 * Zone
 * - Aggregates device effects and plant feedback
 * - Integrates per tick: temperature, humidity (pool) and CO₂
 * - Subsequently executes all plant ticks (if any)
 * - Provides the interfaces for the tickMachine
 */
export class Zone {
  constructor({
    id = 'zone',
    name = 'Zone',
    area = 1,
    height, // Inherited from Room/Structure
    tickLengthInHours = (env?.time?.tickLengthInHoursDefault ?? 3),
    runtime = {},
    roomId = null,
    structureId = null,
  } = {}) {
    this.id = id;
    this.name = name;
    this.area = Number(area);
    this.height = height; // Let validation/inheritance handle Number() conversion and defaults
    this.tickLengthInHours = Number(tickLengthInHours);
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
  }

  // --- Public Methods (for tickMachine) ------------------------------------

  applyDevices(tickIndex) {
    const s = ensureEnv(this);
    resetEnvAggregates(s);
    this.#manageLightCycle(tickIndex);
    this.#updateDeviceStatus();
    this.#applyDeviceEffects();
  }

  deriveEnvironment() {
    this.#applyThermalUpdate();
    this.#applyHumidityAndCO2Update();
  }

  irrigateAndFeed() {
    if (!this.costEngine) return;
    const s = ensureEnv(this);

    let totalWaterL = 0;
    const consumedNutrients = { N: 0, P: 0, K: 0 };

    // 1. Evaluate and apply consumption for each plant
    for (const plant of this.plants) {
      totalWaterL += plant.lastWaterConsumptionL ?? 0;

      const demand = plant.lastNutrientConsumption;
      let nutrientStress = 0;

      // Check if reservoir can meet demand
      if (s.nutrients.N < demand.N || s.nutrients.P < demand.P || s.nutrients.K < demand.K) {
        nutrientStress = 0.2; // Deficiency causes stress
      } else {
        // Consume nutrients from reservoir
        s.nutrients.N -= demand.N;
        s.nutrients.P -= demand.P;
        s.nutrients.K -= demand.K;
        // Track what was actually consumed
        consumedNutrients.N += demand.N;
        consumedNutrients.P += demand.P;
        consumedNutrients.K += demand.K;
      }
      plant.payload.nutrientStress = nutrientStress;
    }

    // 2. Book costs for consumed resources
    if (totalWaterL > 0) {
      this.costEngine.bookWater(totalWaterL);
    }
    if (consumedNutrients.N > 0 || consumedNutrients.P > 0 || consumedNutrients.K > 0) {
      this.costEngine.bookFertilizer(consumedNutrients);
    }

    // 3. Replenish the reservoir with the consumed amount (simulates fertigation)
    s.nutrients.N += consumedNutrients.N;
    s.nutrients.P += consumedNutrients.P;
    s.nutrients.K += consumedNutrients.K;
  }

  async updatePlants(tickLengthInHours, tickIndex) {
    await this.#updatePlants(tickLengthInHours, tickIndex);
  }

  harvestAndInventory() {
    this.#harvestAndReplant();
    this.#replaceBrokenDevices();
  }

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

  addDevice(device) {
    if (!device) return;
    const deviceLogger = this.logger.child({ deviceId: device.id, deviceKind: device.kind });
    device.runtimeCtx = {
      ...(device.runtimeCtx ?? {}),
      structureId: this.structureId,
      roomId: this.roomId,
      zone: this,
      tickLengthInHours: this.tickLengthInHours,
      logger: deviceLogger,
    };
    this.devices.push(device);
  }

  addPlant(plant) {
    if (!plant) return;
    this.plants.push(plant);
  }

  // --- Private Tick-Phase Implementations ---------------------------------

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
  }

  #harvestAndReplant() {
    if (!this.costEngine || !this.rng || !this.strainPriceMap) return;
    for (let i = 0; i < this.plants.length; i++) {
      const plant = this.plants[i];
      if (plant.stage === 'harvestReady') {
        const yieldGrams = plant.calculateYield();
        const strainId = plant.strain?.id;
        const priceInfo = this.strainPriceMap.get(strainId);
        const pricePerGram = priceInfo?.harvestPricePerGram ?? 0;
        const revenue = yieldGrams * pricePerGram;

        if (revenue > 0) {
          this.costEngine.bookRevenue('Harvest', revenue);
          this.logger.info({ plantId: plant.id.slice(0,8), yieldGrams: yieldGrams.toFixed(2), revenue: revenue.toFixed(2) }, 'HARVEST');
        }

        const newPlant = new Plant({
          strain: plant.strain,
          method: plant.method,
          rng: this.rng
        });
        this.plants[i] = newPlant;
        this.logger.info({ oldPlantId: plant.id.slice(0,8), newPlantId: newPlant.id.slice(0,8) }, 'REPLANT');
      }
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
    for (const d of (this.devices ?? [])) {
      const kWh = d.estimateEnergyKWh?.(this.tickLengthInHours) ?? 0;
      const priceKey = d.blueprintId ?? d.id;
      if (kWh > 0) this.costEngine.bookDeviceEnergy(priceKey, kWh);
      this.costEngine.bookDeviceMaintenance(priceKey, tickIndex);
    }
  }

  #applyThermalUpdate() {
    const s = ensureEnv(this);
    const tickH  = Number(this.tickLengthInHours ?? env?.time?.tickLengthInHoursDefault ?? 3);
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

    const ach = Number(env?.defaults?.airChangesPerHour ?? 0.3);
    const rate = 1 - Math.exp(-ach * tickH);
    const outsideT = Number(env?.defaults?.outsideTemperatureC ?? env?.outdoor?.temperatureC ?? 22);
    const T0 = Number(s.temperature ?? outsideT);
    const dT_leak = (outsideT - T0) * rate;

    s.temperature = T0 + dT_heat + dT_leak;

    if (typeof s.humidity === 'number') {
      const hMin = Number(env?.clamps?.humidityMin ?? 0.30);
      const hMax = Number(env?.clamps?.humidityMax ?? 0.95);
      s.humidity = clamp(s.humidity, hMin, hMax);
    }
  }

  #applyHumidityAndCO2Update() {
    const s = ensureEnv(this);
    const vol = getZoneVolume(this);

    // --- Humidity ---
    const mRef = Number(env?.humidity?.moistureRefKgPerM3 ?? 0.0003);
    const alpha = Number(env?.humidity?.alpha ?? 1.0);
    const MvMax = Math.max(1e-9, mRef * vol);

    const dMv = Number(s._waterKgDelta ?? 0);
    let Mv = Number(s.moistureKg ?? 0) + dMv;
    if (Mv < 0) Mv = 0;
    if (Mv > MvMax) Mv = MvMax;
    s.moistureKg = Mv;

    let rh = alpha * (Mv / MvMax);
    const hMin = Number(env?.clamps?.humidityMin ?? 0.30);
    const hMax = Number(env?.clamps?.humidityMax ?? 0.95);
    s.humidity = clamp(rh, hMin, hMax);

    // --- CO2 ---
    const co2Min = Number(env?.clamps?.co2ppmMin ?? 300);
    const co2Max = Number(env?.clamps?.co2ppmMax ?? 2000);
    let c = Number(s.co2ppm ?? (env?.defaults?.co2ppm ?? 420));
    c += Number(s._co2PpmDelta ?? 0);
    s.co2ppm = clamp(c, co2Min, co2Max);
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

    // In a real scenario, water/fertilizer would be tracked here too,
    // but the current logic books them directly. We'll represent zone-level overhead as 0 for now.
    const zoneOverhead = 0;

    return {
      total: totalEnergyCost + totalMaintenanceCost + zoneOverhead,
      energy: totalEnergyCost,
      maintenance: totalMaintenanceCost,
      other: zoneOverhead,
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
