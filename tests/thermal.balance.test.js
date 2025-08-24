import { Zone } from '../src/engine/Zone.js';
import { Lamp } from '../src/engine/devices/Lamp.js';
import { ClimateUnit } from '../src/engine/devices/ClimateUnit.js';
import { env } from '../src/config/env.js';
import { runThermalPreflight } from '../src/sim/simulation.js';

describe('thermal balance', () => {
  const achOrig = env.defaults.airChangesPerHour;
  afterEach(() => {
    env.defaults.airChangesPerHour = achOrig;
  });

  test('stabilizes with sufficient cooling', () => {
    env.defaults.airChangesPerHour = 1.0;
    const zone = new Zone({ id: 'Z1', area: 20, height: 2.5, runtime: { logger: null } });
    const lamp = new Lamp({ kind: 'Lamp', settings: { power: 4 } }, { tickLengthInHours: zone.tickLengthInHours });
    const climate = new ClimateUnit({ kind: 'ClimateUnit', settings: { maxCooling: 5, targetTemperature: 26 } }, { tickLengthInHours: zone.tickLengthInHours });
    zone.addDevice(lamp);
    zone.addDevice(climate);

    const temps = [];
    for (let i = 0; i < 72; i++) {
      zone.applyDevices(i);
      zone.deriveEnvironment();
      temps.push(zone.environment.temperature);
    }
    const last = temps.slice(-12);
    const maxDiff = Math.max(...last) - Math.min(...last);
    expect(last.every(t => t >= 25 && t <= 27)).toBe(true);
    expect(maxDiff).toBeLessThan(0.3);
  });

  test('pre-flight fails on insufficient cooling', () => {
    const zone = new Zone({ id: 'Z2', area: 20, height: 2.5, runtime: { logger: null } });
    const lamp = new Lamp({ kind: 'Lamp', settings: { power: 9.6 } }, { tickLengthInHours: zone.tickLengthInHours });
    const climate = new ClimateUnit({ kind: 'ClimateUnit', settings: { maxCooling: 0.4, targetTemperature: 26 } }, { tickLengthInHours: zone.tickLengthInHours });
    zone.addDevice(lamp);
    zone.addDevice(climate);
    const structure = { rooms: [{ zones: [zone] }] };
    expect(() => runThermalPreflight(structure, { info: () => {} })).toThrow(/FAIL/);
  });
});

