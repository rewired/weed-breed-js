import { Dehumidifier } from '../src/engine/devices/Dehumidifier.js';
import { ensureEnv } from '../src/engine/deviceUtils.js';

describe('Dehumidifier', () => {
  it('removes moisture according to rate', () => {
    const zone = {};
    const env = ensureEnv(zone);
    const device = new Dehumidifier({ id: 'd1', kind: 'Dehumidifier', settings: { latentRemovalKgPerTick: 0.2 } }, { tickLengthInHours: 1 });
    device.applyEffect(zone);
    expect(env._waterKgDelta).toBeCloseTo(-0.2);
  });

  it('estimates energy based on tick length', () => {
    const device = new Dehumidifier({ id: 'd1', kind: 'Dehumidifier', settings: { power: 2 } }, { tickLengthInHours: 1 });
    expect(device.estimateEnergyKWh(0.5)).toBeCloseTo(1); // 2 kW * 0.5 h
    expect(device.estimateEnergyKWh(2)).toBeCloseTo(4);    // 2 kW * 2 h
  });
});
