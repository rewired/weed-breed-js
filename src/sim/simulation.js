import { Zone } from '../engine/Zone.js';
import { Plant } from '../engine/Plant.js';
import { logger } from '../lib/logger.js';
import { createDevice } from '../engine/factories/deviceFactory.js';
import * as DeviceLoader from '../engine/loaders/deviceLoader.js';
import { loadStrainBySlug } from '../engine/loaders/strainLoader.js';
import { loadCultivationMethod } from '../engine/loaders/cultivationMethodLoader.js';
import { loadDevicePriceMap, loadStrainPriceMap } from '../engine/loaders/priceLoader.js';
import { CostEngine } from '../engine/CostEngine.js';
import { createRng } from '../lib/rng.js';
import { createTickMachine }from './tickMachine.js';
import { loadSavegame } from '../server/services/savegameLoader.js';
import { loadDifficultyConfig } from '../engine/loaders/difficultyLoader.js';

// --- Loader-Wrapper ---------------------------------------------------------
async function getDeviceBlueprints() {
  return DeviceLoader.loadAllDevices();
}

// --- Runtime Helpers ------------------------------------------------------
function findBlueprint(blueprints, query = {}) {
    const { id, kind, nameIncludes } = query;
    if (id) return blueprints.find(b => b.id === id) ?? null;
    const candidates = blueprints.filter(b =>
      (kind ? b.kind === kind : true) &&
      (nameIncludes ? (b.name ?? '').toLowerCase().includes(String(nameIncludes).toLowerCase()) : true)
    );
    return candidates[0] ?? null;
}

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

import { createStructure } from '../engine/factories/structureFactory.js';
import { createRoom } from '../engine/factories/roomFactory.js';
import { createZone } from '../engine/factories/zoneFactory.js';


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
                    const blueprint = findBlueprint(blueprints, { kind: device.kind });
                    addDeviceN(zone, blueprint, device.count, deviceRuntimeCtx, device.overrides);
                }
            }

            // --- Add Plants ---
            const { simulation: simConfig } = zoneConfig;
            if (simConfig) {
                const method = await loadCultivationMethod(simConfig.methodId);
                const strain = await loadStrainBySlug(simConfig.strainSlug);
                const numPlants = Math.floor(zone.area / method.areaPerPlant);
                for (let i = 0; i < numPlants; i++) {
                    const area_m2 = method?.areaPerPlant ?? 0.25;
                    zone.addPlant(new Plant({ strain, method, rng, area_m2 }));
                }
            }
        }
    }

    const tickMachineLogic = createTickMachine();

    return {
        structure, // Return the whole structure instead of flat zones array
        costEngine,
        rng,
        tickMachineLogic,
        blueprints
    };
}
