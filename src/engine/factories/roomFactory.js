import { Room } from '../Room.js';

/**
 * Creates a Room instance from a configuration object.
 * @param {object} config - The room configuration.
 * @param {object} runtime - The shared runtime environment.
 * @returns {Room} A new Room instance.
 */
export function createRoom(config, runtime) {
  if (!config) {
    throw new Error('Room configuration is required.');
  }
  return new Room({ ...config, runtime });
}
