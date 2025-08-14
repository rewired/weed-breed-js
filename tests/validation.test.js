import { Structure } from '../src/engine/Structure.js';
import { Room } from '../src/engine/Room.js';
import { Zone } from '../src/engine/Zone.js';
import { BaseDevice } from '../src/engine/BaseDevice.js';
import { CostEngine } from '../src/engine/CostEngine.js';
import { logger } from '../src/lib/logger.js';

// Mock runtime environment
const getMockRuntime = () => ({
  logger,
  costEngine: new CostEngine({
    devicePriceMap: new Map([
      ['test_lamp', { capitalExpenditure: 100, baseMaintenanceCostPerTick: 0.1, energyPricePerKWhOverride: 0.25 }],
      ['test_ac', { capitalExpenditure: 500, baseMaintenanceCostPerTick: 0.5, energyPricePerKWhOverride: 0.30 }],
    ]),
  }),
});

// Mock Device class for testing cost aggregation
class MockDevice extends BaseDevice {
    constructor(id, kind, power) {
        super({ id, name: id, kind });
        this.power = power; // in kW
    }
    estimateEnergyKWh(hours) {
        return this.power * hours;
    }
}


describe('Task B: Validation & Invariants', () => {

  describe('Area Validation', () => {
    it('should throw an error when total room area exceeds structure usable area', () => {
      const structure = new Structure({ usableArea: 100, runtime: getMockRuntime() });
      structure.addRoom(new Room({ area: 50, runtime: getMockRuntime() }));
      structure.addRoom(new Room({ area: 50, runtime: getMockRuntime() }));

      const failingAdd = () => structure.addRoom(new Room({ area: 1, runtime: getMockRuntime() }));

      expect(failingAdd).toThrow(/Exceeds usable area/);
    });

    it('should throw an error when total zone area exceeds room area', () => {
      const room = new Room({ area: 50, runtime: getMockRuntime() });
      room.addZone(new Zone({ area: 25, runtime: getMockRuntime() }));
      room.addZone(new Zone({ area: 25, runtime: getMockRuntime() }));

      const failingAdd = () => room.addZone(new Zone({ area: 1, runtime: getMockRuntime() }));

      expect(failingAdd).toThrow(/Exceeds room area/);
    });
  });

  describe('Height Inheritance', () => {
    it('should inherit height from structure to room if not specified', () => {
      const structure = new Structure({ height: 3.5, runtime: getMockRuntime() });
      const room = new Room({ area: 50, runtime: getMockRuntime() }); // No height specified
      structure.addRoom(room);

      expect(room.height).toBe(3.5);
    });

    it('should inherit height from room to zone if not specified', () => {
      const room = new Room({ area: 50, height: 2.8, runtime: getMockRuntime() });
      const zone = new Zone({ area: 20, runtime: getMockRuntime() }); // No height specified
      room.addZone(zone);

      expect(zone.height).toBe(2.8);
    });

    it('should NOT override specified height', () => {
        const structure = new Structure({ height: 3.5, runtime: getMockRuntime() });
        const room = new Room({ area: 50, height: 2.5, runtime: getMockRuntime() });
        structure.addRoom(room);

        expect(room.height).toBe(2.5);
    });
  });
});

describe('Task C: Cost Aggregation', () => {
    it('should correctly aggregate costs from devices up to the structure', () => {
        const tickIndex = 1;
        const tickLengthInHours = 3;
        const runtime = getMockRuntime();

        // Setup structure
        const structure = new Structure({ id: 's1', name: 'Test Facility', baseRent: 100, runtime });
        const room = new Room({ id: 'r1', name: 'Test Room', area: 50, baseCost: 20, runtime });
        const zone = new Zone({ id: 'z1', name: 'Test Zone', area: 30, tickLengthInHours, runtime });

        // Add mock devices
        const lamp = new MockDevice('d1', 'Lamp', 1.0); // 1.0 kW
        lamp.blueprintId = 'test_lamp';
        const ac = new MockDevice('d2', 'ClimateUnit', 2.0); // 2.0 kW
        ac.blueprintId = 'test_ac';

        zone.addDevice(lamp);
        zone.addDevice(ac);

        // Build hierarchy
        room.addZone(zone);
        structure.addRoom(room);

        // --- Calculate Expected Costs ---
        // Zone Costs
        const lampEnergyCost = 1.0 * tickLengthInHours * 0.25; // 0.75
        const lampMaintCost = 0.1;
        const acEnergyCost = 2.0 * tickLengthInHours * 0.30; // 1.80
        const acMaintCost = 0.5;
        const expectedZoneTotal = lampEnergyCost + lampMaintCost + acEnergyCost + acMaintCost; // 0.75 + 0.1 + 1.80 + 0.5 = 3.15

        // Room Costs
        const expectedRoomTotal = expectedZoneTotal + room.baseCost; // 3.15 + 20 = 23.15

        // Structure Costs
        const expectedStructureTotal = expectedRoomTotal + structure.baseRent; // 23.15 + 100 = 123.15

        // --- Get Actual Costs ---
        const costs = structure.getTickCosts(tickIndex);

        // --- Assertions ---
        expect(costs.total).toBeCloseTo(expectedStructureTotal);
        expect(costs.rooms[0].total).toBeCloseTo(expectedRoomTotal);
        expect(costs.rooms[0].zones[0].total).toBeCloseTo(expectedZoneTotal);
        expect(costs.rooms[0].zones[0].devices.length).toBe(2);
    });
});
