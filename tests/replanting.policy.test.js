import { Zone } from '../src/engine/Zone.js';
import { Plant } from '../src/engine/Plant.js';
import { CostEngine } from '../src/engine/CostEngine.js';
import { events$ } from '../src/runtime/eventBus.js';

describe('Replanting policy', () => {
  test('skips when zone not empty', () => {
    const costEngine = new CostEngine({ keepEntries: true });
    const zone = new Zone({ id: 'z1', runtime: { costEngine } });
    zone.addPlant(new Plant({ strain: { id: 's1' } }));
    const events = [];
    const sub = events$.subscribe(e => events.push(e));
    zone.replanting({ tick: 0 });
    sub.unsubscribe();
    const skip = events.find(e => e.type === 'zone.replant.skipped');
    expect(skip).toBeTruthy();
    expect(skip.payload.reason).toBe('zoneNotEmpty');
  });

  test('respects cooldown', () => {
    const strainId = 's1';
    const costEngine = new CostEngine({ strainPriceMap: new Map([[strainId, { seedPrice: 1 }]]), keepEntries: true });
    const zone = new Zone({ id: 'z2', runtime: { costEngine }, policy: { replanting: { zoneEmptyCooldownHours: 2, defaultStrainId: strainId } } });
    zone.emptySinceTick = 0;
    const events = [];
    const sub = events$.subscribe(e => events.push(e));
    zone.replanting({ tick: 1 });
    sub.unsubscribe();
    const skip = events.find(e => e.type === 'zone.replant.skipped');
    expect(skip).toBeTruthy();
    expect(skip.payload.reason).toBe('cooldownWindow');
  });
});
