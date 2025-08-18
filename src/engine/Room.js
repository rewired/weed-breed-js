/**
 * Room model containing zones within a structure.
 * @module engine/Room
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a room within a structure, containing one or more zones.
 */
export class Room {
  constructor({
    id = uuidv4(),
    name = 'Default Room',
    area = 50,
    height, // Inherited if not provided
    baseCost = 10,
    structureId = null,
    runtime = {}
  } = {}) {
    this.id = id;
    this.name = name;
    this.area = Number(area);
    this.height = height; // Let validation/inheritance handle Number() conversion
    this.baseCost = Number(baseCost);
    this.structureId = structureId;

    this.runtime = runtime;
    this.logger = runtime.logger ?? console;

    /** @type {import('./Zone.js').Zone[]} */
    this.zones = [];
  }

  /**
   * Adds a zone to the room after validation.
   * @param {import('./Zone.js').Zone} zone
   */
  addZone(zone) {
    const totalZoneArea = this.zones.reduce((sum, z) => sum + z.area, 0);
    const newTotalArea = totalZoneArea + zone.area;

    if (newTotalArea > this.area) {
      throw new Error(
        `Cannot add zone "${zone.name}" (area: ${zone.area}m²) to room "${this.name}". ` +
        `Exceeds room area. ` +
        `Current: ${totalZoneArea}m², Proposed: ${newTotalArea}m², Room Area: ${this.area}m².`
      );
    }

    // Height inheritance
    if (zone.height == null) { // Use == to catch null and undefined
      zone.height = this.height;
    }
    zone.height = Number(zone.height); // Ensure it's a number for calculations

    this.zones.push(zone);
    zone.roomId = this.id;
    zone.structureId = this.structureId;

    // Pass down the contextual logger
    zone.logger = this.logger.child({ zoneId: zone.id });
    this.logger.info({ zoneId: zone.id, zoneName: zone.name, newTotalArea: newTotalArea }, 'Zone added to room');
  }

  getTickCosts(tickIndex) {
    const zoneCosts = this.zones.map(zone => {
      const costs = zone.getTickCosts(tickIndex);
      return {
        id: zone.id,
        name: zone.name,
        ...costs,
      };
    });

    const totalFromZones = zoneCosts.reduce((sum, zc) => sum + zc.total, 0);
    const totalCost = totalFromZones + this.baseCost;

    return {
      total: totalCost,
      roomBaseCost: this.baseCost,
      zonesTotal: totalFromZones,
      zones: zoneCosts,
    };
  }
}
