/**
 * Zone aggregates devices and plants for simulation ticks.
 * Handles light cycles, environment derivation, harvesting and
 * cost accounting for a cultivation zone.
 * @module engine/Zone
 */
import { ensureEnv, resetEnvAggregates, getZoneVolume, clamp } from './deviceUtils.js';
import { env, AIR_DENSITY, AIR_CP, saturationMoistureKgPerM3 } from '../config/env.js';
import { resolveTickHours } from '../lib/time.js';
import { Plant } from './Plant.js';
import { createDevice } from './factories/deviceFactory.js';

// Helper to read from Map or plain object
const get = (m, k) => m?.get?.(k) ?? m?.[k];

export class Zone {
  constructor({
    id,
    name = 'Unnamed Zone',
    area = 10,
    height,
    tickLengthInHours,
    runtime = {},
    roomId = null,
    structureId = null,
  } = {}) {
    this.id = id;
    this.name = name;
    this.area = Number(area);
    this.height = height;
    this.tickLengthInHours = resolveTickHours({ tickLengthInHours });
    this.roomId = roomId;
    this.structureId = structureId;

    // runtime deps
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
      humidity: env?.defaults?.humidity ?? 0.6,
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
    this._warnedNoLamp = false;

    // harvest & debug tracking
    this.totalBuds_g = 0; // accumulated harvested buds [g]
    this.harvestedPlants = 0;
    this.harvestEvents = 0;
    this.firstHarvestDay = null;
    this.lastHarvestDay = null;
    this.startDayFlower = null;

    if (process.env.DEBUG_HARVEST) {
      this._debugDay = { ppfdSum: 0, lightHours: 0, darkHours: 0 };
    }
  }

  // -----------------------------------------------------------------------
  // logging helper
  #log(level, data, msg) {
    try {
      this.logger?.[level]?.(data, msg);
    } catch {
      /* ignore logging errors */
    }
  }

  // -----------------------------------------------------------------------
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
      try { this.costEngine.bookSeeds(plant.strain.id, 1); } catch { /* ignore */ }
    }
    const world = this.runtime.world;
    if (world && plant?.strain?.id) {
      const s = world.strainStats.get(plant.strain.id) ?? { name: plant.strain.name, plantsTotal: 0, harvestedPlants: 0, totalBuds_g: 0, totalFlowerDurationDays: 0 };
      s.name = plant.strain.name;
      s.plantsTotal += 1;
      world.strainStats.set(plant.strain.id, s);
    }
  }

  // --- Public Methods ----------------------------------------------------

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
    if (this._debugDay) {
      const h = this.tickLengthInHours;
      const ppfd = this.environment.ppfd ?? 0;
      if (this.runtime.lightsOn) {
        this._debugDay.ppfdSum += ppfd * h;
        this._debugDay.lightHours += h;
      } else {
        this._debugDay.darkHours += h;
      }
    }
  }

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
    if (totalWaterL > 0) this.costEngine.bookWater(totalWaterL, meta);
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

  harvestAndInventory(tickIndex) {
    this.#harvestAndReplant(tickIndex);
    this.#replaceBrokenDevices();
  }

  accounting(tickIndex) {
    this.#bookDeviceCosts(tickIndex);
  }

  // -----------------------------------------------------------------------
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

    const plant = this.plants[0];
    const stage = plant.stage;
    const cyclePref = plant.strain?.environmentalPreferences?.lightCycle;

    let cycle = cyclePref?.[stage] ?? cyclePref?.default;
    if (!cycle) {
      const strain = plant.strain || {};
      const ageDays = plant.ageHours / 24;
      if ((strain.photoperiodic ?? true) && ageDays >= (strain.vegDays ?? 28)) {
        cycle = [12, 12];
      } else {
        cycle = [18, 6];
      }
      this.#log('info', { zoneId: this.id, stage }, 'Using fallback light cycle');
    }

    const currentSimHour = (tickIndex * this.tickLengthInHours) % 24;
    const lightHours = Number(cycle[0]) || 0;
    const lightsOn = currentSimHour < lightHours;
    this.runtime.lightsOn = lightsOn;

    const lamps = this.devices.filter(d => d.kind === 'Lamp');
    if (lamps.length === 0 && !this._warnedNoLamp) {
      this._warnedNoLamp = true;
      this.#log('warn', { zoneId: this.id }, 'No Lamp in zone; PPFD will stay ~0');
    }
    for (const lamp of lamps) {
      try {
        lamp.toggle(lightsOn ? 'on' : 'off');
      } catch (e) {
        this.#log('error', { err: e, deviceId: lamp.id }, 'Lamp toggle failed');
      }
    }
  }

  #updateDeviceStatus() {
    for (const d of this.devices) {
      try { d.tick?.(); } catch (e) { this.#log('error', { err: e, deviceId: d?.id }, 'Device tick failed'); }
    }
  }

  #applyDeviceEffects() {
    for (const d of this.devices) {
      try {
        if (d.status === 'ok' && typeof d.applyEffect === 'function') {
          d.applyEffect(this);
        }
      } catch (e) {
        this.#log('error', { err: e, deviceId: d?.id, kind: d?.kind, name: d?.name }, 'Device applyEffect failed');
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
        this.#log('error', { err: e, plantId: p?.id, label: p?.label }, 'Plant tick failed');
      }
    }
    const survivors = [];
    for (const p of this.plants) {
      if (p.isDead || p.stage === 'dead') {
        const cause = p.causeOfDeath ?? 'unknown';
        this.deathStats[cause] = (this.deathStats[cause] ?? 0) + 1;
      } else {
        survivors.push(p);
      }
    }
    const removed = this.plants.length - survivors.length;
    this.plants = survivors;
    if (removed > 0) this.#log('info', { removed }, 'Removed dead plants');
  }

  // -----------------------------------------------------------------------
  #harvestAndReplant(tickIndex = 0) {
    if (!this.costEngine || !this.strainPriceMap) return;

    const ready = [];
    const keep = [];
    for (const p of this.plants) {
      if (p.stage === 'harvestReady') ready.push(p);
      else if (!p.isDead && p.stage !== 'dead') keep.push(p);
    }
    if (ready.length === 0) return;

    let harvested = 0;
    let revenueEUR = 0;
    const world = this.runtime.world;
    const ticksPerDay = Math.round(24 / this.tickLengthInHours);
    for (const plant of ready) {
      const buds = plant.budBiomass ?? 0;
      const strainId = plant.strain?.id;
      const priceInfo = get(this.strainPriceMap, strainId) ?? {};
      const pricePerGram = Number(priceInfo.harvestPricePerGram ?? priceInfo.pricePerGram ?? 0);
      const revenue = buds * pricePerGram;
      if (revenue > 0) {
        try { this.costEngine.bookRevenue('Harvest', revenue); } catch { /* ignore */ }
        revenueEUR += revenue;
      }
      harvested += 1;
      this.totalBuds_g += buds;
      if (world) {
        world.totalBuds_g += buds;
        const s = world.strainStats.get(strainId);
        if (s) {
          s.totalBuds_g += buds;
          s.harvestedPlants += 1;
          const flowerDur = plant.flowerStartTick != null ? (tickIndex - plant.flowerStartTick) / ticksPerDay : 0;
          s.totalFlowerDurationDays += flowerDur;
        }
      }
      if (process.env.DEBUG_HARVEST) {
        this.#log('info', { harvested_buds_g_added: buds, plantId: plant.id, strainId }, 'HARVEST_DEBUG');
      }
      plant.state.biomassPartition.buds_g = 0;
    }

    // remove harvested
    this.plants = keep;
    this.harvestedPlants += harvested;
    if (harvested > 0) {
      this.harvestEvents += 1;
      const day = Math.floor(tickIndex / ticksPerDay);
      if (this.firstHarvestDay == null) this.firstHarvestDay = day;
      this.lastHarvestDay = day;
      console.assert(this.totalBuds_g >= this.harvestedPlants * 0.5, 'totalBuds_g too low');
    }

    // determine template
    const template = this.plantTemplate || ready[0] || keep[0];
    if (template) {
      let areaPerPlant = template.method?.areaPerPlant;
      if (!areaPerPlant || areaPerPlant <= 0) areaPerPlant = template.area_m2;
      if (!areaPerPlant || areaPerPlant < 1) areaPerPlant = 2.5; // sensible default
      const capacity = Math.max(0, Math.floor(this.area / areaPerPlant));
      const need = Math.max(0, capacity - this.plants.length);
      for (let i = 0; i < need; i++) {
        const newPlant = new Plant({ strain: template.strain, method: template.method, rng: this.rng, area_m2: areaPerPlant });
        this.addPlant(newPlant);
      }
      this.#log('info', { harvested, revenueEUR, replanted: need }, 'HARVEST_ZONE_TICK');
    }
  }

  #replaceBrokenDevices() {
    if (!this.costEngine || !this.blueprints || !this.devicePriceMap) return;
    const runtimeCtx = { zone: this, tickLengthInHours: this.tickLengthInHours, devicePriceMap: this.devicePriceMap };
    for (let i = 0; i < this.devices.length; i++) {
      const device = this.devices[i];
      if (device.status === 'broken') {
        this.#log('warn', { deviceId: device.id, name: device.name }, 'Device BROKEN. Replacing...');
        try { this.costEngine.bookCapex(device.blueprintId, 1); } catch { /* ignore */ }
        const blueprint = this.#findBlueprint({ id: device.blueprintId });
        if (blueprint) {
          try {
            const newDevice = createDevice(blueprint, runtimeCtx);
            this.devices[i] = newDevice;
            this.#log('info', { oldDeviceId: device.id, newDeviceId: newDevice.id, name: newDevice.name }, 'Device REPLACED.');
          } catch (e) {
            this.#log('error', { err: e, blueprintId: device.blueprintId }, 'Device replacement failed');
          }
        } else {
          this.#log('error', { blueprintId: device.blueprintId }, 'Could not find blueprint to replace broken device. Removing device.');
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
    const tickH = resolveTickHours(this);
    const dtSec = Math.max(1, tickH * (env?.factors?.hourToSec ?? 3600));

    const rhoAir = Number(env?.physics?.airDensity ?? AIR_DENSITY ?? 1.2);
    const cpAir = Number(env?.physics?.airCp ?? AIR_CP ?? 1005);

    const vol = getZoneVolume(this); // m³
    const airMass = Math.max(1e-6, vol * rhoAir);

    const area = this.area;
    const h = this.height ?? env?.defaults?.ceilingHeightM ?? 2.5;
    const side = Math.sqrt(Math.max(1e-9, area));
    const envelopeArea = (2 * area) + (4 * side * h);

    const uaPerM2 = Number(env?.defaults?.passiveUaPerM2 ?? 0.5);
    const UA_W_per_K = Math.max(0, uaPerM2 * envelopeArea);

    const ACH = Number(env?.defaults?.airChangesPerHour ?? 0.3);
    const mdotCp_W_per_K = Math.max(0, (ACH * vol / 3600) * rhoAir * cpAir);

    const Tamb = Number(env?.defaults?.outsideTemperatureC ?? 22);
    const Tnow = Number(s.temperature ?? 24);
    const dT = Tnow - Tamb;
    const passiveW = (UA_W_per_K + mdotCp_W_per_K) * dT;

    s._heatW = Number(s._heatW ?? 0) - passiveW;

    const massMultiplier = Number(env?.defaults?.thermalMassMultiplier ?? 200);
    const C_eff = airMass * cpAir * Math.max(1, massMultiplier);

    const heatW = Number(s._heatW ?? 0);
    const Q = heatW * dtSec;
    const dT_heat = Q / C_eff;

    s.temperature = Tnow + dT_heat;
  }

  #applyHumidityAndCO2Update() {
    const s = ensureEnv(this);

    const vol = getZoneVolume(this);
    const moistureKgPerM3 = Number(s.moistureKg) / Math.max(1e-9, vol);
    const satKgPerM3 = saturationMoistureKgPerM3(s.temperature);
    const rhRaw = Math.max(0, Math.min(0.999, moistureKgPerM3 / Math.max(1e-12, satKgPerM3)));
    s.humidity = clamp(rhRaw, env?.clamps?.humidityMin ?? 0.1, env?.clamps?.humidityMax ?? 0.95);

    const waterDelta = Number(s._waterKgDelta ?? 0);
    const co2DeltaPpm = Number(s._co2PpmDelta ?? 0);

    s.moistureKg = Math.max(0, Number(s.moistureKg ?? 0) + waterDelta);
    s.co2ppm = Math.max(0, Number(s.co2ppm ?? 420) + co2DeltaPpm);

    const newMoisturePerM3 = Math.max(0, s.moistureKg / Math.max(1e-9, vol));
    const newRh = Math.max(0, Math.min(0.999, newMoisturePerM3 / Math.max(1e-12, satKgPerM3)));
    s.humidity = clamp(newRh, env?.clamps?.humidityMin ?? 0.1, env?.clamps?.humidityMax ?? 0.95);

    s._waterKgDelta = 0;
    s._co2PpmDelta = 0;
    s.ppfd = Math.max(0, Number(s.ppfd ?? 0));
  }

  debugDailyLog(day) {
    if (!this._debugDay) return;
    const lightH = this._debugDay.lightHours;
    const darkH = this._debugDay.darkHours;
    const meanPPFD = lightH > 0 ? this._debugDay.ppfdSum / lightH : 0;
    const DLI = meanPPFD * 3600 * lightH / 1e6;
    const ref = meanPPFD * 3600 * lightH / 1e6;
    const diff = Math.abs(DLI - ref) / Math.max(1, DLI);
    console.assert(diff < 0.1, `DLI consistency check failed in zone ${this.id}`);
    if (process.env.DEBUG_HARVEST) {
      this.logger.info({ zoneId: this.id, day, photoperiod: [lightH, darkH], meanPPFD, DLI }, 'DEBUG_ZONE_DAY');
      for (const p of this.plants) {
        p.debugDailyLog?.(day, this);
      }
      if (Math.abs(lightH - 12) <= 1 && meanPPFD >= 400 && meanPPFD <= 500) {
        console.assert(DLI >= 15 && DLI <= 25, `avgDLI out of range in zone ${this.id}`);
      }
    }
    this._debugDay.ppfdSum = 0;
    this._debugDay.lightHours = 0;
    this._debugDay.darkHours = 0;
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

      const cfg = get(this.costEngine.devicePriceMap, device.blueprintId);
      const baseMaintenance = cfg?.baseMaintenanceCostPerTick ?? 0;
      const inc = cfg?.costIncreasePer1000Ticks ?? 0;
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
