import { Zone } from '../src/engine/Zone.js';
import { Plant } from '../src/engine/Plant.js';
import { CostEngine } from '../src/engine/CostEngine.js';
import { createRng } from '../src/lib/rng.js';

describe('Seed cost booking', () => {
  it('books seed cost when adding new plant', () => {
    const strainId = 'strain1';
    const costEngine = new CostEngine({
      strainPriceMap: new Map([[strainId, { seedPrice: 3 }]]),
      keepEntries: true,
    });
    costEngine.startTick(1);
    const zone = new Zone({ id: 'z1', runtime: { costEngine } });
    const plant = new Plant({ strain: { id: strainId } });
    zone.addPlant(plant);
    const seedEntries = costEngine.ledger.entries.filter(e => e.meta?.subType === 'seeds');
    expect(seedEntries.length).toBe(1);
    expect(seedEntries[0].meta.strainId).toBe(strainId);
    expect(costEngine.ledger.otherExpenseEUR).toBeCloseTo(3);
  });

  it('books seed cost on replant after harvest', () => {
    const strainId = 'strain1';
    const strainPriceMap = new Map([[strainId, { seedPrice: 2, harvestPricePerGram: 0 }]]);
    const costEngine = new CostEngine({ strainPriceMap, keepEntries: true });
    const rng = createRng('test');
    const zone = new Zone({ id: 'z1', runtime: { costEngine, rng, strainPriceMap } });

    // Initial plant already at harvest stage
    const plant = new Plant({ strain: { id: strainId }, stage: 'harvestReady', method: {} });
    costEngine.startTick(1);
    zone.addPlant(plant);
    costEngine.commitTick();

    // Harvest and replant in new tick
    costEngine.startTick(2);
    zone.harvestAndInventory();

    const seedEntries = costEngine.ledger.entries.filter(e => e.meta?.subType === 'seeds');
    expect(seedEntries.length).toBe(1);
    expect(seedEntries[0].meta.strainId).toBe(strainId);
    expect(costEngine.ledger.otherExpenseEUR).toBeCloseTo(2);
  });
});
