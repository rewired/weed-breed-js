import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a building or a top-level container for rooms.
 */
export class Structure {
  constructor({
    id = uuidv4(),
    name = 'Default Structure',
    usableArea = 200,
    height = 3.0,
    baseRent = 100,
    runtime = {}
  } = {}) {
    this.id = id;
    this.name = name;
    this.usableArea = Number(usableArea);
    this.height = Number(height);
    this.baseRent = Number(baseRent);

    this.runtime = runtime;
    this.logger = runtime.logger?.child({ structureId: this.id }) ?? console;

    /** @type {import('./Room.js').Room[]} */
    this.rooms = [];
  }

  /**
   * Adds a room to the structure after validation.
   * @param {import('./Room.js').Room} room
   */
  addRoom(room) {
    const totalRoomArea = this.rooms.reduce((sum, r) => sum + r.area, 0);
    const newTotalArea = totalRoomArea + room.area;

    if (newTotalArea > this.usableArea) {
      throw new Error(
        `Cannot add room "${room.name}" (area: ${room.area}m²) to structure "${this.name}". ` +
        `Exceeds usable area. ` +
        `Current: ${totalRoomArea}m², Proposed: ${newTotalArea}m², Usable: ${this.usableArea}m².`
      );
    }

    // Height inheritance
    if (room.height == null) { // Use == to catch null and undefined
      room.height = this.height;
    }
    room.height = Number(room.height); // Ensure it's a number for calculations

    this.rooms.push(room);
    room.structureId = this.id;
    // Pass down the contextual logger
    room.logger = this.logger.child({ roomId: room.id });
    this.logger.info({ roomId: room.id, roomName: room.name, newTotalArea: newTotalArea }, 'Room added to structure');
  }

  getTickCosts(tickIndex) {
    const roomCosts = this.rooms.map(room => {
      const costs = room.getTickCosts(tickIndex);
      return {
        id: room.id,
        name: room.name,
        ...costs,
      };
    });

    const totalFromRooms = roomCosts.reduce((sum, rc) => sum + rc.total, 0);
    const totalCost = totalFromRooms + this.baseRent;

    return {
      total: totalCost,
      structureBaseRent: this.baseRent,
      roomsTotal: totalFromRooms,
      rooms: roomCosts,
    };
  }
}
