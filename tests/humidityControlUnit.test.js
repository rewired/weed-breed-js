import { HumidityControlUnit } from '../src/engine/devices/HumidityControlUnit.js';
import { ensureEnv, getZoneVolume } from '../src/engine/deviceUtils.js';
import { env as cfg, saturationMoistureKgPerM3 } from '../src/config/env.js';
import { jest } from '@jest/globals';

describe('HumidityControlUnit', () => {
  function setup(humidity) {
    const costEngine = { bookWater: jest.fn() };
    const zone = { id: 'z1', costEngine, area: 1, height: 2.5 };
    const env = ensureEnv(zone);
    env.humidity = humidity;
    const mRef = cfg.humidity.deriveFromTemperature
      ? saturationMoistureKgPerM3(env.temperature)
      : cfg.humidity.moistureRefKgPerM3;
    const vol = getZoneVolume(zone);
    env.moistureKg = humidity * mRef * vol;
    const runtimeCtx = { zone, tickLengthInHours: 1 };
    return { zone, env, runtimeCtx, costEngine, mRef, vol };
  }

  it('dehumidifies when above threshold', () => {
    const { zone, env, runtimeCtx, mRef, vol } = setup(0.8);
    const unit = new HumidityControlUnit({ id: 'h1', kind: 'HumidityControlUnit', settings: { targetHumidity: 0.6, hysteresis: 0.1, dehumidifyRateKgPerTick: 0.05 } }, runtimeCtx);
    unit.applyEffect(zone);
    expect(unit.state).toBe('dehumidifying');
    const needed = 0.2 * mRef * vol;
    const expected = -needed * 0.1;
    expect(env._waterKgDelta).toBeCloseTo(expected, 5);
  });

  it('humidifies and books water when below threshold', () => {
    const { zone, env, runtimeCtx, costEngine, mRef, vol } = setup(0.4);
    const unit = new HumidityControlUnit({ id: 'h1', kind: 'HumidityControlUnit', settings: { targetHumidity: 0.6, hysteresis: 0.1, humidifyRateKgPerTick: 0.03 } }, runtimeCtx);
    unit.applyEffect(zone);
    expect(unit.state).toBe('humidifying');
    const needed = 0.2 * mRef * vol;
    const expected = needed * 0.1;
    expect(env._waterKgDelta).toBeCloseTo(expected, 5);
    expect(costEngine.bookWater).toHaveBeenCalledTimes(1);
    const booked = costEngine.bookWater.mock.calls[0][0];
    expect(booked).toBeCloseTo(expected, 5);
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
