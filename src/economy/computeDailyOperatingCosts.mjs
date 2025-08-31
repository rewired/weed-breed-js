/**
 * Compute daily operating costs across zones, devices and global consumables.
 * Works defensively: missing fields simply contribute zero. No exceptions are
 * thrown for incomplete state objects.
 *
 * @module economy/computeDailyOperatingCosts
 */

/**
 * Compute daily operating costs across the given state.
 *
 * @param {any} state - Engine state snapshot
 * @returns {number} daily operating costs in EUR (rounded to 2 decimals)
 */
export function computeDailyOperatingCosts(state = {}) {
  const finance = state?.finance || state?.costEngine || {};
  const energyPrice = Number(
    finance.energyPricePerKWh ?? finance.energyPricePerKwh ?? 0
  );
  let total = 0;

  total += Number(finance.fixedDailyCosts) || 0;

  // Traversal helpers ----------------------------------------------------
  function collectZones(s) {
    const zones = [];
    if (!s) return zones;
    if (Array.isArray(s.zones)) zones.push(...s.zones);
    if (Array.isArray(s.rooms)) {
      for (const r of s.rooms) {
        if (Array.isArray(r?.zones)) zones.push(...r.zones);
      }
    }
    if (Array.isArray(s.buildings)) {
      for (const b of s.buildings) {
        if (Array.isArray(b?.rooms)) {
          for (const r of b.rooms) {
            if (Array.isArray(r?.zones)) zones.push(...r.zones);
          }
        }
      }
    }
    return zones;
  }

  const zones = collectZones(state);
  for (const z of zones) {
    const devices = Array.isArray(z?.devices) ? z.devices : [];
    for (const d of devices) {
      total += Number(d?.costs?.daily || d?.operatingCostPerDay || 0);
      total += Number(d?.costs?.maintenancePerDay || 0);
      const wh = Number(d?.energyWhPerDay || 0);
      if (wh) {
        total += (wh / 1000) * energyPrice;
      }
    }
  }

  total += Number(state?.consumables?.waterDailyCost || 0);
  total += Number(state?.consumables?.nutrientsDailyCost || 0);

  if (!Number.isFinite(total) || total <= 0) total = 5;
  return Number(total.toFixed(2));
}

export default { computeDailyOperatingCosts };
