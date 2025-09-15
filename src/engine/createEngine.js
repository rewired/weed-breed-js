/**
 * Minimal engine bootstrap that builds the world from a savegame
 * and runs a lightweight tick scheduler emitting UI telemetry.
 *
 * Pure ESM, JS-only. Keeps domain logic intact.
 */
import { createStructure } from '../engine/factories/structureFactory.js';
import { createRoom } from '../engine/factories/roomFactory.js';
import { createZone } from '../engine/factories/zoneFactory.js';
import { loadAllDevices } from '../engine/loaders/deviceLoader.js';
import { createDevice } from '../engine/factories/deviceFactory.js';
import { loadCultivationMethod } from '../engine/loaders/cultivationMethodLoader.js';
import { loadStrainById } from '../engine/loaders/strainLoader.js';
import { loadDevicePriceMap, loadStrainPriceMap } from '../engine/loaders/priceLoader.js';
import { CostEngine } from '../engine/CostEngine.js';
import { createTickMachine } from '../runtime/tickMachine.js';
import { uiStream$, emit } from '../runtime/eventBus.js';
import { telemetryAdapter } from '../sim/telemetryAdapter.js';
import { ensureRng } from '../lib/rng.mjs';
import { resolveProjectPath } from '../lib/pathutil.mjs';
import { computeDailyOperatingCosts } from '../economy/computeDailyCosts.js';

/**
 * @typedef {object} Engine
 * @property {() => Promise<void>} start
 * @property {() => void} stop
 * @property {() => boolean} isRunning
 * @property {(ms: number) => void} setSpeed
 * @property {() => number} getTickMs
 * @property {() => number} getTick
 * @property {() => any} getState
*/

/**
 * @param {{ savegame?: any, rng?: Function, tickMs?: number, logger?: any, savegamePath?: string }} [opts]
 * @returns {Engine}
 */
export function createEngine(opts = {}) {
  const { savegame, rng, tickMs, logger, savegamePath: savegamePathOpt } = opts;
  const rngWrapped = ensureRng(rng);
  const savegamePath = resolveProjectPath(
    savegamePathOpt || process.env.SAVEGAME_PATH || 'data/savegames/default.json'
  );
  const config = { savegamePath };
  let timer = null;
  let tick = 0;
  let tickMsCurrent = Math.max(10, Number(tickMs || 100));
  let inFlight = false; // Guard against overlapping steps
  /** @type {Array<any>} */
  let zones = [];
  /** @type {any} */
  let structure = null;
  /** @type {CostEngine|null} */
  let costEngine = null;

  // bind telemetry adapter to existing runtime/eventBus
  const bus = {
    emitUi: (e) => emit(e.type, e, e.tick),
    uiStream$,
  };
  let onTick = () => {};

  /**
   * Build world from provided savegame using existing factories/loaders.
   */
  async function buildWorld() {
    const devicePriceMap = await loadDevicePriceMap();
    const strainPriceMap = await loadStrainPriceMap();
    const blueprints = await loadAllDevices();

    costEngine = new CostEngine({ devicePriceMap, strainPriceMap });
    const world = { totalBuds_g: 0, strainStats: new Map() };

    const runtimeBase = { logger, rng: rngWrapped, costEngine, devicePriceMap, strainPriceMap, blueprints, world };

    const sg = savegame || {};
    const structCfg = sg.structure || sg.world?.structure || null;
    if (!structCfg) throw new Error('savegame.structure missing');

    structure = createStructure(structCfg, runtimeBase);
    for (const roomCfg of structCfg.rooms ?? []) {
      const room = createRoom(roomCfg, { ...runtimeBase, logger: structure.logger });
      structure.addRoom(room);
      for (const zoneCfg of roomCfg.zones ?? []) {
        const zone = createZone(zoneCfg, { ...runtimeBase, logger: room.logger });
        room.addZone(zone);

        // devices
        const bpIndex = new Map(blueprints.map(b => [b.id, b]));
        for (const d of zoneCfg.devices ?? []) {
          const bp = bpIndex.get(d.blueprintId);
          if (!bp) continue;
          const count = Number(d.count ?? 1);
          for (let i = 0; i < count; i++) {
            const dev = createDevice(bp, { zone, tickLengthInHours: zone.tickLengthInHours, logger: zone.logger, rng: rngWrapped }, d.overrides);
            zone.addDevice(dev);
          }
        }

        // plants
        const sim = zoneCfg.simulation || {};
        if (sim?.methodId && sim?.strainId) {
          const method = await loadCultivationMethod(sim.methodId);
          const strain = await loadStrainById(sim.strainId);
          const areaPerPlant = method?.areaPerPlant ?? 0.25;
          const n = Math.max(0, Math.floor((zone.area ?? 0) / areaPerPlant));
          // Hoist the dynamic import outside the loop for performance
          const { Plant } = await import('../engine/Plant.js');
          for (let i = 0; i < n; i++) {
            // Plant ctor resolves shape internally using provided method/strain
            const plant = new Plant({ strain, method, rng: rngWrapped, area_m2: areaPerPlant });
            zone.addPlant(plant);
          }
        }
      }
    }

    // Cache zones for tick loop
    zones = [];
    for (const r of structure.rooms ?? []) {
      for (const z of r.zones ?? []) zones.push(z);
    }

    // Pre-bind telemetry emission per tick
    onTick = telemetryAdapter({
      getState() {
        const plants = zones.reduce((sum, z) => sum + (z.plants?.length ?? 0), 0);
        return { tick, zonesCount: zones.length, plantsCount: plants, zones };
      }
    }, bus);
  }

  /** run one simulation tick over all zones */
  async function step() {
    // Prevent overlapping steps
    if (inFlight) {
      logger?.warn?.({ tick }, 'Skipping tick - previous step still in progress');
      return;
    }
    inFlight = true;
    
    try {
      const ticksPerDay = zones[0] ? Math.round(24 / zones[0].tickLengthInHours) : 24;
      costEngine?.startTick(tick + 1);

      // Simple sequential updates to keep event loop responsive
      for (const z of zones) {
        try {
          // Keep parity with tickMachine ordering by using Zone.update
          await z.update({ tick });
        } catch (err) {
          logger?.warn?.({ err: String(err), zoneId: z.id, tick }, 'zone update failed');
        }
      }

      // Optional additional orchestration (e.g., XState) could be wired here
      try { createTickMachine; } catch {}

      const totals = costEngine?.commitTick?.();
      if (totals) costEngine.recordTickTotals?.(totals);

      emit('finance:update', { cash: costEngine?.getBalance?.() ?? 0 }, tick);

      // Telemetry heartbeat
      try { onTick?.(tick); } catch (err) { logger?.warn?.({ err: String(err) }, 'telemetry emit failed'); }

      const dayFrac = (tick % ticksPerDay) / ticksPerDay;
      emit('sim:tick', { tick, dayFrac }, tick);

      if ((tick + 1) % ticksPerDay === 0) {
        const day = Math.floor((tick + 1) / ticksPerDay);
        const zoneStats = zones.map(z => {
          z.recomputeMetrics?.();
          const avgStress = z.getAverageStress?.() ?? 0;
          const eventsToday = (z.harvestEvents - (z._prevHarvestEvents ?? 0));
          z._prevHarvestEvents = z.harvestEvents;
          return {
            zoneId: z.id,
            avgStress: Math.round(avgStress),
            totalBiomass_g: z.metrics?.totalBiomass_g ?? 0,
            totalBuds_g: z.metrics?.totalBuds_g ?? 0,
            harvestEventsToday: eventsToday,
          };
        });
        const dailyCosts = computeDailyOperatingCosts({ costEngine, ticksPerDay }) || 0;
        const finance = { cash: costEngine?.getBalance?.() ?? 0, dailyCosts };
        emit('sim:day', { day, finance, zoneStats }, tick);
      }

      tick += 1;
    } finally {
      inFlight = false;
    }
  }

  // Helper to run the tick loop safely
  async function runTickLoop() {
    if (!timer) return;
    await step();
    // Schedule next tick if still running
    if (timer) {
      timer = setTimeout(runTickLoop, tickMsCurrent);
      if (timer.unref) timer.unref();
    }
  }

  let building = null;
  async function ensureBuilt() {
    if (structure) return;
    if (!building) building = buildWorld().catch((e) => { building = null; throw e; });
    await building;
  }

  return {
    config,
    async start() {
      if (timer) return; // idempotent
      await ensureBuilt();
      // Use setTimeout with async loop instead of setInterval
      timer = setTimeout(runTickLoop, 0);
      if (timer.unref) timer.unref();
      logger?.info?.({ msg: 'engine started', tickMs: tickMsCurrent, zones: zones.length });
    },
    stop() {
      if (timer) { 
        clearTimeout(timer); 
        timer = null; 
        inFlight = false; // Reset the guard
        logger?.info?.({ msg: 'engine stopped' }); 
      }
    },
    isRunning() { return Boolean(timer); },
    setSpeed(ms) {
      const next = Math.max(10, Number(ms));
      tickMsCurrent = next;
      // If running, the next tick will use the new speed
      logger?.info?.({ msg: 'engine speed set', tickMs: tickMsCurrent });
    },
    getTickMs() { return tickMsCurrent; },
    getTick() { return tick; },
    getState() {
      const plants = zones.reduce((sum, z) => sum + (z.plants?.length ?? 0), 0);
      return { tick, zonesCount: zones.length, plantsCount: plants, structure, zones };
    }
  };
}

export default createEngine;
