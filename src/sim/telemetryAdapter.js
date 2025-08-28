/**
 * Telemetry adapter: emits small, stable UI events per tick.
 *
 * Keeps payloads minimal; only aggregate counters and deltas.
 */

/**
 * Binds an engine to the UI event bus.
 * @param {{ getState(): any }} engine
 * @param {{ emitUi(e: object): void, uiStream$: import('rxjs').Observable<any> }} bus
 * @returns {(tick:number)=>void} // call on each tick after state update
 */
export function telemetryAdapter(engine, bus) {
  // Track previous totals to compute deltas
  const prev = new Map(); // zoneId -> { harvestedPlants, buds_g }

  /**
   * Extract minimal summary and emit as one tick.summary event.
   * @param {number} tick
   */
  return function onTick(tick) {
    const state = engine.getState?.() || {};
    const zones = state.zones || [];

    let zonesCount = Number(state.zonesCount ?? zones.length ?? 0);
    let plantsCount = Number(state.plantsCount ?? 0);
    if (!plantsCount && zones?.length) {
      plantsCount = zones.reduce((s, z) => s + (z?.plants?.length ?? 0), 0);
    }

    let harvestedPlantsDelta = 0;
    let harvestedBudsDelta_g = 0;

    for (const z of zones) {
      const key = z?.id ?? String(zones.indexOf(z));
      const stats = z?.stats || {};
      const harvestedPlants = Number(stats.harvestedPlants ?? 0);
      const buds_g = Number(stats.totalBudsCollected_g ?? 0);
      const p = prev.get(key) || { harvestedPlants: 0, buds_g: 0 };
      harvestedPlantsDelta += Math.max(0, harvestedPlants - p.harvestedPlants);
      harvestedBudsDelta_g += Math.max(0, buds_g - p.buds_g);
      prev.set(key, { harvestedPlants, buds_g });
    }

    const payload = {
      type: 'tick.summary',
      tick,
      zones: zonesCount,
      plants: plantsCount,
      harvestsDelta: { harvestedPlants: harvestedPlantsDelta, buds_g: harvestedBudsDelta_g },
    };

    try { bus.emitUi(payload); } catch {}
  };
}

export default telemetryAdapter;

/**
 * Backwards-compatible export name as specified in the request.
 * @param {{ getState(): any }} engine
 * @param {{ emitUi: (e:object)=>void }} bus
 * @returns {(tick:number)=>void}
 */
export function bindTelemetry(engine, bus) {
  return telemetryAdapter(engine, bus);
}
