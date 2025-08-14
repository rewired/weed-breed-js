// src/engine/deviceFactory.js
// Factory-Registry für eingebaute Geräte

import { BaseDevice } from './BaseDevice.js';
import { Lamp } from './devices/Lamp.js';
import { ClimateUnit } from './devices/ClimateUnit.js';
import { Dehumidifier } from './devices/Dehumidifier.js';
import { CO2Injector } from './devices/CO2Injector.js';
import { HumidityControlUnit } from './devices/HumidityControlUnit.js';

const REGISTRY = {
  Lamp,
  ClimateUnit,
  Dehumidifier,
  CO2Injector,
  HumidityControlUnit,
};

export function createDevice(json, runtimeCtx = {}, overrides = {}) {
  const kind = json?.kind ?? 'Device';
  const Klass = REGISTRY[kind];
  if (!Klass) {
    throw new Error(`Unknown device kind "${kind}". Register it or extend the factory.`);
  }
  return new Klass(json, runtimeCtx, overrides);
}

export function registerDeviceKind(kind, Klass) {
  if (!kind || !Klass) throw new Error('registerDeviceKind: need kind and class');
  if (REGISTRY[kind]) throw new Error(`Device kind "${kind}" already registered`);
  if (!(Klass.prototype instanceof BaseDevice)) {
    throw new Error(`Registered class for "${kind}" must extend BaseDevice`);
  }
  REGISTRY[kind] = Klass;
}
