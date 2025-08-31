/**
 * Bridge converting low level SimEngine tick events into UI friendly payloads.
 * Listens for `sim.tickCompleted` and emits `sim:day`, `finance:update` and
 * `harvest:event` events on a provided {@link EventEmitter}.
 *
 * This adapter does not mutate the core engine logic. It only listens to the
 * engine and derives information for the UI.
 *
 * @module engine/SimEngineEventBridge
 */
import { EventEmitter } from 'node:events';
import { computeDailyOperatingCosts } from '../economy/computeDailyOperatingCosts.mjs';

/**
 * Attach a bridge translating `sim.tickCompleted` to higher level events.
 *
 * @param {{
 *   engine: any,
 *   events$: EventEmitter,
 *   getState?: () => any,
 *   ticksPerDay?: number,
 *   mutateCash?: boolean
 * }} opts
 * @returns {{ dispose(): void }}
 */
export function attachSimEngineEventBridge({
  engine,
  events$,
  getState,
  ticksPerDay = 24,
  mutateCash,
} = {}) {
  if (!(events$ instanceof EventEmitter)) {
    throw new Error('events$ must be an EventEmitter');
  }

  const emitter = engine?.events instanceof EventEmitter ? engine.events : engine;
  if (!emitter || typeof emitter.on !== 'function') {
    throw new Error('engine is not an EventEmitter');
  }

  let tick = 0;
  let day = 0;
  let shadowCash = null;
  const prevBudsByZone = new Map();

  /**
   * Safely collect all zone objects from the given state.
   * @param {any} state
   * @returns {Array<any>}
   */
  function collectZones(state) {
    const zones = [];
    if (!state) return zones;

    if (Array.isArray(state.zones)) zones.push(...state.zones);

    if (Array.isArray(state.rooms)) {
      for (const r of state.rooms) {
        if (Array.isArray(r?.zones)) zones.push(...r.zones);
      }
    }

    if (Array.isArray(state.buildings)) {
      for (const b of state.buildings) {
        if (Array.isArray(b?.rooms)) {
          for (const r of b.rooms) {
            if (Array.isArray(r?.zones)) zones.push(...r.zones);
          }
        }
      }
    }
    return zones;
  }

  /**
   * Listener for `sim.tickCompleted` events.
   * @param {{tick?:number}} [payload]
   */
  function onTick(payload = {}) {
    tick = Number.isFinite(payload.tick) ? Number(payload.tick) : tick + 1;
    if (tick % ticksPerDay !== 0) return;

    day += 1;
    const state = typeof getState === 'function' ? getState() : engine?.state || {};

    // Finance --------------------------------------------------------------
    const dailyCosts = computeDailyOperatingCosts(state);
    let cash = 0;
    const finance = state?.finance || {};
    if (typeof finance.cash === 'number') {
      if (shadowCash == null) shadowCash = finance.cash;
      if (mutateCash !== false) {
        finance.cash -= dailyCosts;
        cash = finance.cash;
      } else {
        shadowCash -= dailyCosts;
        cash = shadowCash;
      }
    } else {
      if (shadowCash == null) shadowCash = 0;
      shadowCash -= dailyCosts;
      cash = shadowCash;
    }
    const financePayload = { day, cash, dailyCosts };
    events$.emit('finance:update', financePayload);

    // Zone statistics -----------------------------------------------------
    const zoneStats = [];
    const zones = collectZones(state);
    for (const z of zones) {
      const zoneId = z?.id || z?.zoneId || String(zoneStats.length);
      const plants = Array.isArray(z?.plants) ? z.plants : [];
      let stressSum = 0;
      let stressCount = 0;
      for (const p of plants) {
        let s = p?.stress?.current;
        if (s == null) s = p?.state?.stress?.current;
        if (s == null) s = p?.stress;
        if (s == null) s = p?.state?.stress;
        s = Number(s);
        if (Number.isFinite(s)) {
          if (s <= 1) s *= 100; // assume 0..1 range
          s = Math.max(0, Math.min(100, s));
          stressSum += s;
          stressCount += 1;
        }
      }
      const avgStress = stressCount ? Math.round(stressSum / stressCount) : 0;
      zoneStats.push({ zoneId, avgStress, plants: plants.length });

      const budsNowRaw = z?.inventory?.buds_g ?? z?.buds_g;
      const budsNow = Number(budsNowRaw) || 0;
      const prev = prevBudsByZone.get(zoneId) || 0;
      const delta = Number((budsNow - prev).toFixed(3));
      if (delta > 0) {
        events$.emit('harvest:event', { zoneId, day, buds_g: delta });
      }
      prevBudsByZone.set(zoneId, budsNow);
    }

    const simDayPayload = { day, finance: financePayload, zoneStats };
    events$.emit('sim:day', simDayPayload);
  }

  emitter.on('sim.tickCompleted', onTick);

  return {
    dispose() {
      try { emitter.off('sim.tickCompleted', onTick); } catch {}
    },
  };
}

export default { attachSimEngineEventBridge };
