/**
 * Simulation setup and helper utilities.
 * @module sim/simulation
 */
import { Zone } from '../engine/Zone.js';
import { Plant } from '../engine/Plant.js';
import { logger } from '../lib/logger.js';
import { createDevice } from '../engine/factories/deviceFactory.js';
import * as DeviceLoader from '../engine/loaders/deviceLoader.js';
import { loadStrainById } from '../engine/loaders/strainLoader.js';
import { loadCultivationMethod } from '../engine/loaders/cultivationMethodLoader.js';
import { loadDevicePriceMap, loadStrainPriceMap } from '../engine/loaders/priceLoader.js';
import { CostEngine } from '../engine/CostEngine.js';
import { createRng } from '../lib/rng.js';
import { createTickMachine }from './tickMachine.js';
import { loadSavegame } from '../server/services/savegameLoader.js';
import { loadDifficultyConfig } from '../engine/loaders/difficultyLoader.js';
import { StatsCollector } from './StatsCollector.js';
import { getZoneVolume, readPowerKw } from '../engine/deviceUtils.js';
import { env } from '../config/env.js';

// --- Loader-Wrapper ---------------------------------------------------------
/**
 * Load all available device blueprints.
 * @returns {Promise<Array>}
 */
async function getDeviceBlueprints() {
  return DeviceLoader.loadAllDevices();
}

// --- Runtime Helpers ------------------------------------------------------
/**
 * Find a blueprint matching the given query.
 * @param {Array} blueprints
 * @param {{id?:string,kind?:string,nameIncludes?:string}} [query]
 * @returns {object|null}
 */
function findBlueprint(blueprints, query = {}) {
    const { id, kind, nameIncludes } = query;
    if (id) return blueprints.find(b => b.id === id) ?? null;
    const candidates = blueprints.filter(b =>
      (kind ? b.kind === kind : true) &&
      (nameIncludes ? (b.name ?? '').toLowerCase().includes(String(nameIncludes).toLowerCase()) : true)
    );
    return candidates[0] ?? null;
}

/**
 * Add multiple devices to a zone based on a blueprint.
 * @param {Zone} zone
 * @param {object} blueprint
 * @param {number} count
 * @param {object} runtimeCtx
 * @param {object} [overrides={}] Additional device overrides.
 * @returns {Array} Created device instances.
 */
export function addDeviceN(zone, blueprint, count, runtimeCtx, overrides = {}) {
    if (!blueprint) {
      logger.warn({ overrides }, 'addDeviceN: blueprint not found');
      return [];
    }
    const n = Math.max(1, Math.floor(Number(count ?? 1)));
    const out = [];
    for (let i = 1; i <= n; i++) {
      const clone = JSON.parse(JSON.stringify(blueprint));
      clone.id = `${blueprint.id}#${i}`;
      clone.name = typeof clone.name === 'string' ? `${clone.name} #${i}` : `${blueprint.kind ?? 'Device'} #${i}`;
      clone.blueprintId = blueprint.id;

      const inst = createDevice(clone, runtimeCtx, overrides);
      inst.blueprintId = inst.blueprintId ?? clone.blueprintId;
      zone.addDevice?.(inst);
      out.push(inst);
    }

    const costEngine = zone?.costEngine ?? runtimeCtx?.costEngine;
    if (costEngine) {
      costEngine.bookCapex(blueprint.id, n, { zoneId: zone.id });
    }
    return out;
}

/**
 * Check thermal feasibility of zones before simulation starts.
 * Throws error with a table if cooling is insufficient.
 * @param {object} structure
 * @param {object} log
 */
export function runThermalPreflight(structure, log = logger) {
  const rows = [];
  let fail = false;
  for (const room of structure?.rooms ?? []) {
    for (const zone of room.zones ?? []) {
      const vol = getZoneVolume(zone);
      const area = zone.area;
      const h = zone.height ?? env?.defaults?.ceilingHeightM ?? 2.5;
      const side = Math.sqrt(Math.max(1e-9, area));
      const envelopeArea = (2 * area) + (4 * side * h);

      const uaPerM2 = Number(env?.defaults?.passiveUaPerM2 ?? 0.5);
      const UA_W_per_K = Math.max(0, uaPerM2 * envelopeArea);
      const UA_kW_per_K = UA_W_per_K / 1000;

      const rho = Number(env?.physics?.airDensity ?? 1.2);
      const cp = Number(env?.physics?.airCp ?? 1005);
      const ACH = Number(env?.defaults?.airChangesPerHour ?? 0.3);
      const mdotCp_kW_per_K = Math.max(0, (ACH * vol / 3600) * rho * cp / 1000);

      let lampKW = 0;
      let coolingKW = 0;
      for (const d of zone.devices ?? []) {
        const settings = d.settings ?? {};
        if (d.kind === 'Lamp') {
          const heatFrac = (settings.heatFraction != null) ? Number(settings.heatFraction) : 0.9;
          lampKW += readPowerKw(settings) * heatFrac;
        } else if (d.kind === 'ClimateUnit') {
          const powerKW = Number(settings.power ?? settings.powerInKilowatts ?? 0);
          const cop = Number(settings.cop ?? (settings.coolingEfficiency && settings.coolingEfficiency > 0.5 ? settings.coolingEfficiency : 3.0));
          let cap = 0;
          if (settings.maxCooling != null) cap = Number(settings.maxCooling);
          else if (settings.coolingCapacity != null) cap = Number(settings.coolingCapacity);
          else if (powerKW > 0) cap = powerKW * Math.max(1, cop);
          coolingKW += Math.max(0, cap);
        }
      }

      const lossesSlope_kW_per_K = UA_kW_per_K + mdotCp_kW_per_K;
      const Tamb = Number(env?.defaults?.outsideTemperatureC ?? 22);
      const target = Number(zone?.environment?.targetTemp ?? env?.defaults?.temperatureC ?? 24);
      const Tstar = Tamb + Math.max(0, lampKW - coolingKW) / Math.max(1e-9, lossesSlope_kW_per_K);

      log?.info?.({
        zoneId: zone.id,
        area,
        volume: vol,
        lamps_kW: lampKW,
        cooling_kW: coolingKW,
        UA_kW_K: UA_kW_per_K,
        ACH,
        mdotCp_kW_K: mdotCp_kW_per_K,
        Tamb,
        target,
        Tstar,
      }, 'Thermal pre-flight');

      const row = {
        zone: zone.id ?? zone.name ?? '?',
        area: area.toFixed(1),
        vol: vol.toFixed(1),
        lamps: lampKW.toFixed(1),
        cooling: coolingKW.toFixed(1),
        UA: UA_kW_per_K.toFixed(3),
        ACH: ACH.toFixed(2),
        mdot: mdotCp_kW_per_K.toFixed(3),
        Tstar: Tstar.toFixed(1),
      };
      if (Tstar > target + 2) {
        const deficit = lampKW - coolingKW;
        row.verdict = `FAIL (Unterdeckung ~${deficit.toFixed(1)} kW)`;
        fail = true;
      } else {
        row.verdict = 'OK';
      }
      rows.push(row);
    }
  }

  if (fail) {
    let table = 'Zone | Area m² | Vol m³ | Lamps kW | Cooling kW | UA kW/K | ACH | mdot·Cp kW/K | T* @full cool | Verdict\n';
    table += rows.map(r => `${r.zone} | ${r.area} | ${r.vol} | ${r.lamps} | ${r.cooling} | ${r.UA} | ${r.ACH} | ${r.mdot} | ${r.Tstar} °C | ${r.verdict}`).join('\n');
    throw new Error(table);
  } else {
    log?.info?.('Thermal pre-flight OK');
  }
}

import { createStructure } from '../engine/factories/structureFactory.js';
import { createRoom } from '../engine/factories/roomFactory.js';
import { createZone } from '../engine/factories/zoneFactory.js';


/**
 * Initialize the simulation environment from a savegame.
 * @param {string} [savegame='default']
 * @param {string} [difficulty='normal']
 * @returns {Promise<{structure:object,costEngine:CostEngine,rng:object,tickMachineLogic:any,blueprints:Array,statsCollector:StatsCollector}>}
 */
export async function initializeSimulation(savegame = 'default', difficulty = 'normal') {
    // --- Load Configuration ---
    const config = await loadSavegame(savegame);
    const difficultyConfig = await loadDifficultyConfig();
    const difficultyModifiers = difficultyConfig[difficulty]?.modifiers || difficultyConfig.normal.modifiers;

    const { rngSeed, costEngine: costEngineConfig, structure: structureConfig } = config;
    if (!structureConfig) {
        throw new Error('Savegame must contain a "structure" definition.');
    }

    // --- Initialize Simulation Environment ---
    const devicePriceMap = await loadDevicePriceMap();
    const strainPriceMap = await loadStrainPriceMap();
    const blueprints = await getDeviceBlueprints();
    const rng = createRng(rngSeed || 'weed-sim-1');

    const costEngine = new CostEngine({
      devicePriceMap,
      strainPriceMap,
      ...costEngineConfig,
      ...difficultyModifiers.economics,
      keepEntries: true, // Ensure ledger entries are kept for per-room calculations
    });

    const globalRuntime = { logger, costEngine, rng, strainPriceMap, devicePriceMap, blueprints, difficulty: difficultyModifiers };

    // --- Build World Hierarchy ---
    const structure = createStructure(structureConfig, globalRuntime);

    for (const roomConfig of structureConfig.rooms ?? []) {
        const room = createRoom(roomConfig, { ...globalRuntime, logger: structure.logger });
        structure.addRoom(room); // This also sets parentId, height, and logger

        for (const zoneConfig of roomConfig.zones ?? []) {
            const zone = createZone(zoneConfig, { ...globalRuntime, logger: room.logger });
            room.addZone(zone); // This also sets parentIds, height, and logger

            // --- Add Devices ---
            const deviceRuntimeCtx = { zone, tickLengthInHours: zone.tickLengthInHours, devicePriceMap, logger: zone.logger, rng };
            if (zoneConfig.devices) {
                for (const device of zoneConfig.devices) {
                    const blueprint = findBlueprint(blueprints, { id: device.blueprintId });
                    addDeviceN(zone, blueprint, device.count, deviceRuntimeCtx, device.overrides);
                }
            }

            // --- Add Plants ---
            const { simulation: simConfig } = zoneConfig;
            if (simConfig) {
                const method = await loadCultivationMethod(simConfig.methodId);
                const strain = await loadStrainById(simConfig.strainId);
                const numPlants = Math.floor(zone.area / method.areaPerPlant);
                for (let i = 0; i < numPlants; i++) {
                    const area_m2 = method?.areaPerPlant ?? 0.25;
                    zone.addPlant(new Plant({ strain, method, rng, area_m2 }));
                }
            }
        }
    }

    const tickMachineLogic = createTickMachine();

    const allZones = [];
    for (const room of structure.rooms) {
        for (const zone of room.zones) {
            allZones.push(zone);
        }
    }
    const tickLengthInHours = allZones[0]?.tickLengthInHours ?? 0;
    const statsCollector = new StatsCollector(allZones);
    process.on('beforeExit', () => {
        statsCollector.logTotals(logger);
    });

    runThermalPreflight(structure, logger);

    return {
        structure, // Return the whole structure instead of flat zones array
        costEngine,
        rng,
        tickMachineLogic,
        blueprints,
        statsCollector,
        tickLengthInHours,
    };
}
