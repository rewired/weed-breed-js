// BEGIN: REPLANTING v1 (do not remove)
/**
 * Replanting policy configuration.
 * @typedef {Object} ReplantingPolicy
 * @property {boolean} [enabled=true]
 * @property {'zoneEmpty'|'perSlot'} [zoneGateMode='zoneEmpty']
 * @property {number} [zoneEmptyCooldownHours=0]
 * @property {boolean} [seedAllWhenZoneEmpty=true]
 * @property {string} [defaultStrainId]
 * @property {number} [replantDelayInHours=0] Only for 'perSlot' mode
 * @property {number} [minBudgetEur=0]
 * @property {number} [maxConcurrentBatches=1] Especially for 'perSlot'
 * @property {boolean} [requireSubstrateReset=false]
 */

export const DEFAULT_REPLANTING_POLICY = /** @type {ReplantingPolicy} */ ({
  enabled: true,
  zoneGateMode: 'zoneEmpty',
  zoneEmptyCooldownHours: 0,
  seedAllWhenZoneEmpty: true,
  defaultStrainId: undefined,
  replantDelayInHours: 0,
  minBudgetEur: 0,
  maxConcurrentBatches: 1,
  requireSubstrateReset: false,
});

/**
 * Normalize user provided replanting policy.
 * @param {Partial<ReplantingPolicy>} [input]
 * @returns {ReplantingPolicy}
 */
export function normalizeReplantingPolicy(input = {}) {
  return {
    ...DEFAULT_REPLANTING_POLICY,
    ...(input || {}),
  };
}
// END: REPLANTING v1
