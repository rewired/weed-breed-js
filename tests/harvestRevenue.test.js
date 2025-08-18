import { Zone } from '../src/engine/Zone.js';
import { Plant } from '../src/engine/Plant.js';
import { CostEngine } from '../src/engine/CostEngine.js';
import { createRng } from '../src/lib/rng.js';

describe('Harvest revenue', () => {
  test('books revenue when plants are harvested', () => {
    const strainId = 's1';
    const strainPriceMap = new Map([[strainId, { seedPrice: 0, harvestPricePerGram: 5 }]]);
    const costEngine = new CostEngine({ strainPriceMap });
    costEngine.startTick(0);
    const rng = createRng('seed');
    const zone = new Zone({ id: 'z1', runtime: { costEngine, rng, strainPriceMap } });
    const plant = new Plant({ strain: { id: strainId }, stage: 'harvestReady' });
    plant.state.biomassPartition.buds_g = 10; // 10 g yield
    zone.addPlant(plant);

    zone.harvestAndInventory();
    const totals = costEngine.getTotals();
    expect(totals.revenueEUR).toBeCloseTo(50); // 10 g * 5 EUR
  });
});
