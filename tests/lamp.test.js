import { Lamp } from '../src/engine/devices/Lamp.js';
import { ensureEnv } from '../src/engine/deviceUtils.js';

describe('Lamp', () => {
  function setup(state = 'on') {
    const zone = { area: 1 };
    const env = ensureEnv(zone);
    const lamp = new Lamp({ id: 'l1', kind: 'Lamp', settings: { power: 1, heatFraction: 0.5, ppfd: 200, coverageArea: 1 } }, { tickLengthInHours: 1 });
    if (state === 'off') lamp.toggle('off');
    return { zone, env, lamp };
  }

  it('does nothing when toggled off', () => {
    const { zone, env, lamp } = setup('off');
    lamp.applyEffect(zone);
    expect(env._heatW).toBe(0);
    expect(env.ppfd).toBe(0);
    expect(lamp.estimateEnergyKWh()).toBe(0);
  });

  it('adds heat and ppfd when on', () => {
    const { zone, env, lamp } = setup('on');
    lamp.applyEffect(zone);
    expect(env._heatW).toBeCloseTo(500); // 1 kW * 1000 * 0.5
    expect(env.ppfd).toBeCloseTo(200);
    expect(lamp.estimateEnergyKWh(2)).toBeCloseTo(2); // 1 kW * 2 h
  });
});
