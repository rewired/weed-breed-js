/**
 * Compute daily operating costs from the simulation state
 * @module economy/computeDailyOperatingCosts
 */

/**
 * Calculate daily operating costs
 * @param {{ costEngine?: any, ticksPerDay?: number }} state
 * @returns {number} Daily operating costs
 */
export function computeDailyOperatingCosts(state) {
  if (!state) return 0;
  
  const { costEngine, ticksPerDay = 24 } = state;
  
  if (!costEngine) return 0;
  
  // Get accumulated costs from cost engine
  let dailyCosts = 0;
  
  if (typeof costEngine.getDailyCosts === 'function') {
    dailyCosts = costEngine.getDailyCosts();
  } else if (typeof costEngine.getTotals === 'function') {
    const totals = costEngine.getTotals();
    // Estimate daily costs from totals
    dailyCosts = (totals.totalCosts || 0) / Math.max(1, ticksPerDay);
  } else if (costEngine.ledger) {
    // Fallback to ledger if available
    dailyCosts = (costEngine.ledger.totalCosts || 0) / Math.max(1, ticksPerDay);
  }
  
  return Math.max(0, dailyCosts);
}

export default computeDailyOperatingCosts;
