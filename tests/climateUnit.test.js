import { ClimateUnit } from '../src/engine/devices/ClimateUnit.js';
import { ensureEnv } from '../src/engine/deviceUtils.js';

describe('ClimateUnit', () => {
  function makeZone(temp) {
    const zone = { };
    const env = ensureEnv(zone);
    env.temperature = temp;
    return zone;
  }

  it('stays off within hysteresis band', () => {
    const zone = makeZone(24);
    const unit = new ClimateUnit({ id: 'cl1', kind: 'ClimateUnit', settings: { targetTemperature: 24, hysteresisK: 1, power: 1 } }, { tickLengthInHours: 1 });
    unit.applyEffect(zone);
    expect(unit._on).toBe(false);
    expect(zone.environment._heatW).toBe(0);
  });

  it('turns on above upper threshold and cools', () => {
    const zone = makeZone(25);
    const unit = new ClimateUnit({ id: 'cl1', kind: 'ClimateUnit', settings: { targetTemperature: 24, hysteresisK: 1, power: 1 } }, { tickLengthInHours: 1 });
    unit.applyEffect(zone);
    expect(unit._on).toBe(true);
    expect(zone.environment._heatW).toBeLessThan(0);
  });

  it('turns off when cooled below lower threshold', () => {
    const zone = makeZone(25);
    const unit = new ClimateUnit({ id: 'cl1', kind: 'ClimateUnit', settings: { targetTemperature: 24, hysteresisK: 1, power: 1 } }, { tickLengthInHours: 1 });
    unit.applyEffect(zone); // turn on
    zone.environment.temperature = 23; // below target - hyst/2 (23.5)
    zone.environment._heatW = 0;
    unit.applyEffect(zone);
    expect(unit._on).toBe(false);
    expect(zone.environment._heatW).toBe(0);
  });

  it('estimates energy based on power and duty cycle', () => {
    const zone = makeZone(25);
    const unit = new ClimateUnit({ id: 'cl1', kind: 'ClimateUnit', settings: { targetTemperature: 24, hysteresisK: 1, power: 2 } }, { tickLengthInHours: 1 });
    unit.applyEffect(zone);
    const expected = unit.settings.power * unit._lastPowerFrac * 1; // tick = 1h
    expect(unit.estimateEnergyKWh()).toBeCloseTo(expected, 5);
  });
});
