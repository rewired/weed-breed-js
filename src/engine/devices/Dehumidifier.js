/**
 * Dehumidifier device removing moisture from air each tick.
 * @module engine/devices/Dehumidifier
 */
import { BaseDevice } from '../BaseDevice.js';
import { ensureEnv, addLatentWater } from '../deviceUtils.js';
import { env } from '../../config/env.js';
import { resolveTickHours } from '../../lib/time.js';

/**
 * Device removing water vapor from the environment.
 */
export class Dehumidifier extends BaseDevice {
  constructor(json, runtimeCtx) {
    super(json, runtimeCtx);
  }

  /**
   * Apply dehumidification effect to the zone.
   * @param {object} zone
   */
  applyEffect(zone) {
    const s = ensureEnv(zone);
    const settings = this.settings ?? {};
    const kg = Number(settings.latentRemovalKgPerTick ?? settings.latentKgPerTick ?? 0);
    if (kg > 0) addLatentWater(s, -kg); // Senke
  }

  /**
   * Estimate energy consumption for a tick.
   * @param {number} tickHours
   * @returns {number}
   */
  estimateEnergyKWh(tickHours) {
    const h = resolveTickHours({ tickLengthInHours: tickHours ?? this.runtimeCtx?.tickLengthInHours });
    const p = Number(this.settings?.power ?? 0); // kW(el)
    return Math.max(0, p * h);
  }
}
