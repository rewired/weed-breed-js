// src/engine/deviceUtils.js
// Helper functions for device and environment logic (ESM, Node 23+)

import { env } from '../config/env.js';
import { resolveTickHours } from '../lib/time.js';

export function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return Number(min);
  return Math.min(Math.max(x, Number(min)), Number(max));
}

/**
 * ensureEnv(zone): ensures a consistent, mutable environmental state
 *
 * Fields (implicit units, see naming conventions):
 *  - temperature [°C], humidity [0..1], ppfd [µmol/m²·s], co2ppm [ppm]
 *  - moistureKg [kg H2O]   (Moisture pool in the air)
 *  - _heatW [W]            (Aggregate: +Lamp, -Climate)
 *  - _waterKgDelta [kg/tick]  (Aggregate: +Source/-Sink → Moisture pool)
 *  - _co2PpmDelta [ppm/tick]  (Aggregate: +Injection/-Consumption)
 */
export function ensureEnv(zone) {
  if (!zone || typeof zone !== 'object') {
    throw new Error('ensureEnv: zone is required');
  }
  zone.environment ??= {};

  const defaults = {
    temperature: env?.defaults?.temperatureC ?? 24,
    humidity: clamp(env?.defaults?.humidity ?? 0.6, env?.clamps?.humidityMin ?? 0.30, env?.clamps?.humidityMax ?? 0.95),
    ppfd: 0,
    co2ppm: toNumber(env?.defaults?.co2ppm ?? 420, 420),
    moistureKg: toNumber(env?.defaults?.moistureKg ?? 0, 0),
    nutrients: {
      N: 100,
      P: 100,
      K: 100
    },
    _heatW: 0,
    _waterKgDelta: 0,
    _co2PpmDelta: 0
  };

  for (const [k, v] of Object.entries(defaults)) {
    if (zone.environment[k] == null) zone.environment[k] = v;
  }
  return zone.environment;
}

export function resetEnvAggregates(envState) {
  if (!envState || typeof envState !== 'object') return;
  envState.ppfd = 0;
  envState._heatW = 0;
  envState._waterKgDelta = 0;
  envState._co2PpmDelta = 0;
}

export function addLatentWater(envState, kg) {
  if (!envState) return;
  envState._waterKgDelta = (envState._waterKgDelta ?? 0) + Number(kg || 0);
}

export function addCO2Delta(envState, ppm) {
  if (!envState) return;
  envState._co2PpmDelta = (envState._co2PpmDelta ?? 0) + Number(ppm || 0);
}

export function getZoneVolume(zone) {
  const area   = toNumber(zone?.area, 1);
  const height = toNumber(zone?.height, env?.defaults?.ceilingHeightM ?? 2.5);
  const vol = area * height;
  return vol > 0 ? vol : 0;
}

export function getTickHours(runtimeCtx) {
  return resolveTickHours(runtimeCtx);
}

export function readPowerKw(settings = {}) {
  if (settings.powerInKilowatts != null) return toNumber(settings.powerInKilowatts, 0);
  if (settings.power != null) return toNumber(settings.power, 0);
  if (settings.kw != null) return toNumber(settings.kw, 0);
  return 0;
}

/**
 * Read PPFD - supports variants according to naming conventions.
 * - settings.photosyntheticPhotonFluxDensity (recommended)
 * - settings.ppfd / settings.ppfd_umol_m2_s
 * - settings.light.ppfd
 */
export function readPPFD(settings = {}) {
  if (settings.photosyntheticPhotonFluxDensity != null) {
    return toNumber(settings.photosyntheticPhotonFluxDensity, 0);
  }
  if (settings.ppfd != null) return toNumber(settings.ppfd, 0);
  if (settings.ppfd_umol_m2_s != null) return toNumber(settings.ppfd_umol_m2_s, 0);
  if (settings.light && typeof settings.light === 'object' && settings.light.ppfd != null) {
    return toNumber(settings.light.ppfd, 0);
  }
  return 0;
}

export const CONST = {
  KW_TO_W:  toNumber(env?.factors?.kwToW, 1000),
  HOUR_TO_SEC: toNumber(env?.factors?.hourToSec, 3600),
};
