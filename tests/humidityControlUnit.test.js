import { HumidityControlUnit } from '../src/engine/devices/HumidityControlUnit.js';
import { ensureEnv } from '../src/engine/deviceUtils.js';
import { jest } from '@jest/globals';

describe('HumidityControlUnit', () => {
  function setup(humidity) {
    const costEngine = { bookWater: jest.fn() };
    const zone = { id: 'z1', costEngine };
    const env = ensureEnv(zone);
    env.humidity = humidity;
    const runtimeCtx = { zone, tickLengthInHours: 1 };
    return { zone, env, runtimeCtx, costEngine };
  }

  it('dehumidifies when above threshold', () => {
    const { zone, env, runtimeCtx } = setup(0.8);
    const unit = new HumidityControlUnit({ id: 'h1', kind: 'HumidityControlUnit', settings: { targetHumidity: 0.6, hysteresis: 0.1, dehumidifyRateKgPerTick: 0.05 } }, runtimeCtx);
    unit.applyEffect(zone);
    expect(unit.state).toBe('dehumidifying');
    expect(env._waterKgDelta).toBeCloseTo(-0.05);
  });

  it('humidifies and books water when below threshold', () => {
    const { zone, env, runtimeCtx, costEngine } = setup(0.4);
    const unit = new HumidityControlUnit({ id: 'h1', kind: 'HumidityControlUnit', settings: { targetHumidity: 0.6, hysteresis: 0.1, humidifyRateKgPerTick: 0.03 } }, runtimeCtx);
    unit.applyEffect(zone);
    expect(unit.state).toBe('humidifying');
    expect(env._waterKgDelta).toBeCloseTo(0.03);
    expect(costEngine.bookWater).toHaveBeenCalledWith(0.03, { zoneId: zone.id, deviceId: unit.id });
  });

  it('stays idle within hysteresis band', () => {
    const { zone, env, runtimeCtx, costEngine } = setup(0.6);
    const unit = new HumidityControlUnit({ id: 'h1', kind: 'HumidityControlUnit', settings: { targetHumidity: 0.6, hysteresis: 0.1, humidifyRateKgPerTick: 0.03, dehumidifyRateKgPerTick: 0.05 } }, runtimeCtx);
    unit.applyEffect(zone);
    expect(unit.state).toBe('idle');
    expect(env._waterKgDelta).toBe(0);
    expect(costEngine.bookWater).not.toHaveBeenCalled();
  });
});
