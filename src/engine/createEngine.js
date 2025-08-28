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
 * @param {{ savegame: any, rng: Function, tickMs: number, logger: any }} opts
 * @returns {Engine}
 */
export function createEngine({ savegame, rng, tickMs, logger }) {
  let timer = null;
  let tick = 0;
  let tickMsCurrent = Math.max(10, Number(tickMs || 100));
  /** @type {Array<any>} */
  let zones = [];
  /** @type {any} */
  let structure = null;

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

    const costEngine = new CostEngine({ devicePriceMap, strainPriceMap });
    const world = { totalBuds_g: 0, strainStats: new Map() };

    const runtimeBase = { logger, rng, costEngine, devicePriceMap, strainPriceMap, blueprints, world };

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
            const dev = createDevice(bp, { zone, tickLengthInHours: zone.tickLengthInHours, logger: zone.logger, rng }, d.overrides);
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
          for (let i = 0; i < n; i++) {
            // Plant ctor resolves shape internally using provided method/strain
            const plant = new (await import('../engine/Plant.js')).Plant({ strain, method, rng, area_m2: areaPerPlant });
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

    // Telemetry heartbeat
    try { onTick?.(tick); } catch (err) { logger?.warn?.({ err: String(err) }, 'telemetry emit failed'); }

    tick += 1;
  }

  let building = null;
  async function ensureBuilt() {
    if (structure) return;
    if (!building) building = buildWorld().catch((e) => { building = null; throw e; });
    await building;
  }

  return {
    async start() {
      if (timer) return; // idempotent
      await ensureBuilt();
      timer = setInterval(() => { step().catch(() => {}); }, tickMsCurrent);
      if (timer.unref) timer.unref();
      logger?.info?.({ msg: 'engine started', tickMs: tickMsCurrent, zones: zones.length });
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; logger?.info?.({ msg: 'engine stopped' }); }
    },
    isRunning() { return Boolean(timer); },
    setSpeed(ms) {
      const next = Math.max(10, Number(ms));
      tickMsCurrent = next;
      if (timer) {
        clearInterval(timer);
        timer = setInterval(() => { step().catch(() => {}); }, tickMsCurrent);
        if (timer.unref) timer.unref();
      }
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

