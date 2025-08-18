/**
 * Factory and registry for built-in devices.
 * @module engine/factories/deviceFactory
 */

import { BaseDevice } from '../BaseDevice.js';
import { Lamp } from '../devices/Lamp.js';
import { ClimateUnit } from '../devices/ClimateUnit.js';
import { Dehumidifier } from '../devices/Dehumidifier.js';
import { CO2Injector } from '../devices/CO2Injector.js';
import { HumidityControlUnit } from '../devices/HumidityControlUnit.js';

const REGISTRY = {
  Lamp,
  ClimateUnit,
  Dehumidifier,
  CO2Injector,
  HumidityControlUnit,
};

/**
 * Create a device instance from its JSON blueprint.
 * @param {object} json
 * @param {object} [runtimeCtx={}]
 * @param {object} [overrides={}]
 * @returns {BaseDevice}
 */
export function createDevice(json, runtimeCtx = {}, overrides = {}) {
  const kind = json?.kind ?? 'Device';
  const Klass = REGISTRY[kind];
  if (!Klass) {
    throw new Error(`Unknown device kind "${kind}". Register it or extend the factory.`);
  }
  return new Klass(json, runtimeCtx, overrides);
}

/**
 * Register a custom device class in the factory registry.
 * @param {string} kind
 * @param {typeof BaseDevice} Klass
 */
export function registerDeviceKind(kind, Klass) {
  if (!kind || !Klass) throw new Error('registerDeviceKind: need kind and class');
  if (REGISTRY[kind]) throw new Error(`Device kind "${kind}" already registered`);
  if (!(Klass.prototype instanceof BaseDevice)) {
    throw new Error(`Registered class for "${kind}" must extend BaseDevice`);
  }
  REGISTRY[kind] = Klass;
}
