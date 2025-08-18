/**
 * Factory for creating Structure instances.
 * @module engine/factories/structureFactory
 */
import { Structure } from '../Structure.js';

/**
 * Creates a Structure instance from a configuration object.
 * @param {object} config - The structure configuration.
 * @param {object} runtime - The shared runtime environment.
 * @returns {Structure} A new Structure instance.
 */
export function createStructure(config, runtime) {
  if (!config) {
    throw new Error('Structure configuration is required.');
  }
  return new Structure({ ...config, runtime });
}
