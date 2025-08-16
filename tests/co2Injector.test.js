import { CO2Injector } from '../src/engine/devices/CO2Injector.js';
import { ensureEnv } from '../src/engine/deviceUtils.js';
import { jest } from '@jest/globals';

describe('CO2Injector', () => {
  function setup(ppm, extraSettings = {}) {
    const costEngine = { bookCO2: jest.fn() };
    const zone = { id: 'z1', costEngine };
    const env = ensureEnv(zone);
    env.co2ppm = ppm;
    const settings = { targetCO2: 800, hysteresis: 100, pulsePpmPerTick: 50, ...extraSettings };
    const injector = new CO2Injector({ id: 'c1', kind: 'CO2Injector', settings }, { zone });
    return { zone, env, injector, costEngine };
  }

  it('remains off within target range', () => {
    const { zone, injector } = setup(800);
    injector.applyEffect(zone);
    expect(zone.environment._co2PpmDelta).toBe(0);
    expect(injector._lastOn).toBe(false);
  });

  it('activates when below lower threshold and books CO2', () => {
    const { zone, injector, costEngine } = setup(700);
    injector.applyEffect(zone);
    expect(zone.environment._co2PpmDelta).toBeGreaterThan(0);
    expect(injector._lastOn).toBe(true);
    expect(costEngine.bookCO2).toHaveBeenCalledWith(50, { zoneId: zone.id, deviceId: injector.id });
  });

  it('mode off disables injection', () => {
    const { zone, injector } = setup(700, { mode: 'off' });
    injector.applyEffect(zone);
    expect(zone.environment._co2PpmDelta).toBe(0);
    expect(injector._lastOn).toBe(false);
  });

  it('stays off at hysteresis boundaries', () => {
    const { zone: zoneLow, injector: injLow } = setup(750);
    injLow.applyEffect(zoneLow);
    expect(zoneLow.environment._co2PpmDelta).toBe(0);
    expect(injLow._lastOn).toBe(false);

    const { zone: zoneHigh, injector: injHigh } = setup(850);
    injHigh.applyEffect(zoneHigh);
    expect(zoneHigh.environment._co2PpmDelta).toBe(0);
    expect(injHigh._lastOn).toBe(false);
  });
});
