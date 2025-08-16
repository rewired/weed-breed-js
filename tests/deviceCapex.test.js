import { Zone } from '../src/engine/Zone.js';
import { CostEngine } from '../src/engine/CostEngine.js';
import { addDeviceN } from '../src/sim/simulation.js';

describe('Device CapEx booking', () => {
  it('books capex once per device batch and updates opening balance', () => {
    const deviceId = 'c701efa6-1e90-4f28-8934-ea9c584596e4';
    const price = 220;
    const initialCapital = 1000;
    const costEngine = new CostEngine({
      devicePriceMap: new Map([[deviceId, { capitalExpenditure: price }]]),
      initialCapital,
      keepEntries: true,
    });
    const logger = {};
    logger.child = () => logger;
    const zone = new Zone({ id: 'z1', runtime: { costEngine, logger } });
    const blueprint = { id: deviceId, kind: 'CO2Injector', name: 'CO2 Pulse', settings: {} };

    costEngine.startTick(0);
    addDeviceN(zone, blueprint, 2, {});
    const entries = costEngine.ledger.entries.filter(e => e.type === 'capex');
    expect(entries).toHaveLength(1);
    expect(entries[0].meta).toMatchObject({ deviceId, qty: 2, zoneId: 'z1' });
    costEngine.commitTick();

    expect(zone.devices).toHaveLength(2);

    const expectedBalance = initialCapital - price * 2;
    costEngine.startTick(1);
    expect(costEngine.ledger.openingBalanceEUR).toBeCloseTo(expectedBalance);
  });
});
