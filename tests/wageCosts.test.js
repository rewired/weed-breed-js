import { CostEngine } from '../src/engine/CostEngine.js';
import { initializeSimulation } from '../src/sim/simulation.js';
import { env } from '../src/config/env.js';

describe('Labor cost booking', () => {
  it('deducts wagePerTick each tick', () => {
    const wagePerTick = 25;
    const initialCapital = 100;
    const costEngine = new CostEngine({ initialCapital, wagePerTick, keepEntries: true });

    costEngine.startTick(1);
    costEngine.bookExpense('Labor', costEngine.wagePerTick);
    const totals = costEngine.commitTick();

    expect(totals.totalExpensesEUR).toBeCloseTo(wagePerTick);
    expect(costEngine.getBalance()).toBeCloseTo(initialCapital - wagePerTick);
    const grandTotals = costEngine.getGrandTotals();
    expect(grandTotals.totalOtherExpenseEUR).toBeCloseTo(wagePerTick);
  });

  it('loads wagePerTick from savegame configuration', async () => {
    const uaOrig = env.defaults.passiveUaPerM2;
    const achOrig = env.defaults.airChangesPerHour;
    env.defaults.passiveUaPerM2 = 50;
    env.defaults.airChangesPerHour = 5;
    const { costEngine } = await initializeSimulation('default');
    expect(costEngine.wagePerTick).toBe(10);
    env.defaults.passiveUaPerM2 = uaOrig;
    env.defaults.airChangesPerHour = achOrig;
  });
});
