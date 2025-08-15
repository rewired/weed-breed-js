import { Zone } from '../src/engine/Zone.js';
import { CostEngine } from '../src/engine/CostEngine.js';

test('Zone.getTickCosts includes water and fertilizer expenses', () => {
  const costEngine = new CostEngine({ keepEntries: true });
  costEngine.startTick(1);
  const zone = new Zone({ id: 'z1', runtime: { costEngine } });
  costEngine.bookWater(10, { zoneId: 'z1' });
  costEngine.bookFertilizer({ N: 20, P: 10, K: 5 }, { zoneId: 'z1' });
  const expectedWater = 10 * costEngine.waterPricePerLiter;
  const expectedFertilizer = 20 * costEngine.pricePerMgN + 10 * costEngine.pricePerMgP + 5 * costEngine.pricePerMgK;
  const costs = zone.getTickCosts(1);
  expect(costs.water).toBeCloseTo(expectedWater);
  expect(costs.fertilizer).toBeCloseTo(expectedFertilizer);
  expect(costs.total).toBeCloseTo(expectedWater + expectedFertilizer);
});
