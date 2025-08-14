// src/engine/devices/Dehumidifier.js
// Entfeuchter: zieht pro Tick eine feste Wassermenge (kg H2O) aus der Luft
import { BaseDevice } from '../BaseDevice.js';
import { ensureEnv, addLatentWater } from '../deviceUtils.js';
import { env } from '../../config/env.js';

export class Dehumidifier extends BaseDevice {
  constructor(json, runtimeCtx) {
    super(json, runtimeCtx);
  }

  applyEffect(zone) {
    const s = ensureEnv(zone);
    const settings = this.settings ?? {};
    const kg = Number(settings.latentRemovalKgPerTick ?? settings.latentKgPerTick ?? 0);
    if (kg > 0) addLatentWater(s, -kg); // Senke
  }

  estimateEnergyKWh(tickHours) {
    const h = Number(tickHours ?? this.runtimeCtx?.tickLengthInHours ?? env?.time?.tickLengthInHoursDefault ?? 3);
    const p = Number(this.settings?.power ?? 0); // kW(el)
    return Math.max(0, p * h);
  }
}
