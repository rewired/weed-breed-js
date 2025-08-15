import { CO2Injector } from '../src/engine/devices/CO2Injector.js';
import { ensureEnv } from '../src/engine/deviceUtils.js';

describe('CO2Injector', () => {
  function makeZone(ppm) {
    const zone = {};
    const env = ensureEnv(zone);
    env.co2ppm = ppm;
    return zone;
  }

  it('remains off within target range', () => {
    const zone = makeZone(800);
    const injector = new CO2Injector({ id: 'c1', kind: 'CO2Injector', settings: { targetCO2: 800, hysteresis: 100, pulsePpmPerTick: 50 } }, { zone });
    injector.applyEffect(zone);
    expect(zone.environment._co2PpmDelta).toBe(0);
    expect(injector._lastOn).toBe(false);
  });

  it('activates when below lower threshold', () => {
    const zone = makeZone(700);
    const injector = new CO2Injector({ id: 'c1', kind: 'CO2Injector', settings: { targetCO2: 800, hysteresis: 100, pulsePpmPerTick: 50 } }, { zone });
    injector.applyEffect(zone);
    expect(zone.environment._co2PpmDelta).toBeGreaterThan(0);
    expect(injector._lastOn).toBe(true);
  });
});

