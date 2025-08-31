/**
 * Compute daily operating costs across all zones/devices.
 * @module economy/computeDailyCosts
 */

/**
 * Compute daily operating costs across all zones/devices (energy, maintenance, water, nutrients).
 * @param {{costEngine?: any, ticksPerDay?: number}} state
 * @returns {number} daily costs in EUR
 */
export function computeDailyOperatingCosts(state = {}) {
  const ce = state.costEngine;
  if (!ce) return 0;
  const ticksPerDay = Math.max(1, Number(state.ticksPerDay || 24));
  const hist = Array.isArray(ce.tickHistory) ? ce.tickHistory : [];
  if (!hist.length) return 0;
  const slice = hist.slice(-ticksPerDay);
  let total = 0;
  for (const t of slice) {
    total +=
      (t.energyEUR || 0) +
      (t.waterEUR || 0) +
      (t.fertilizerEUR || 0) +
      (t.maintenanceEUR || 0) +
      (t.rentEUR || 0) +
      (t.otherExpenseEUR || 0);
  }
  return total;
}

export default { computeDailyOperatingCosts };
