/**
 * Factory for creating Zone instances.
 * @module engine/factories/zoneFactory
 */
import { Zone } from '../Zone.js';

/**
 * Creates a Zone instance from a configuration object.
 * @param {object} config - The zone configuration.
 * @param {object} runtime - The shared runtime environment.
 * @returns {Zone} A new Zone instance.
 */
export function createZone(config, runtime) {
  if (!config) {
    throw new Error('Zone configuration is required.');
  }
  return new Zone({ ...config, runtime });
}
