// src/engine/devices/HumidityControlUnit.js
import { BaseDevice } from '../BaseDevice.js';
import { ensureEnv, addLatentWater, getZoneVolume } from '../deviceUtils.js';
import { env, saturationMoistureKgPerM3 } from '../../config/env.js';
import { resolveTickHours } from '../../lib/time.js';

export class HumidityControlUnit extends BaseDevice {
  constructor(json, runtimeCtx) {
    super(json, runtimeCtx);
    this.state = 'idle'; // 'idle', 'humidifying', 'dehumidifying'
  }

  applyEffect(zone) {
    const s = ensureEnv(zone);
    const settings = this.settings ?? {};
    const target = Number(settings.targetHumidity ?? 0.6);
    const hyst = Number(settings.hysteresis ?? 0.05);
    const now = Number(s.humidity ?? target);

    // determine desired state
    this.state = 'idle';
    if (now > target + hyst * 0.5) this.state = 'dehumidifying';
    if (now < target - hyst * 0.5) this.state = 'humidifying';

    // compute moisture delta to reach target
    const vol = getZoneVolume(zone);
    const tempC = Number(s.temperature ?? env.defaults.temperatureC ?? 20);
    let mRef = Number(env.humidity.moistureRefKgPerM3 ?? 0.017);
    if (env.humidity.deriveFromTemperature) {
      mRef = saturationMoistureKgPerM3(tempC);
    }
    const alpha = Number(env.humidity.alpha ?? 1);
    const MvMax = Math.max(1e-9, mRef * vol);
    const Mv = Number(s.moistureKg ?? 0);
    const rhNorm = Math.min(1, Math.max(0, target / alpha));
    const MvTarget = rhNorm * MvMax;
    const moistureDelta = MvTarget - Mv; // kg required (+ humidify)

    const maxFrac = Math.max(0, Math.min(1, Number(settings.maxRateFraction ?? 0.1)));
    const needed = Math.abs(moistureDelta);
    const permitted = needed * maxFrac;

    if (this.state === 'dehumidifying') {
      const rate = Number(settings.dehumidifyRateKgPerTick ?? 0);
      const kg = Math.min(rate, needed, permitted);
      if (kg > 0) addLatentWater(s, -kg);
    } else if (this.state === 'humidifying') {
      const rate = Number(settings.humidifyRateKgPerTick ?? 0);
      const kg = Math.min(rate, needed, permitted);
      if (kg > 0) {
        addLatentWater(s, kg);
        this.runtimeCtx?.zone?.costEngine?.bookWater(kg, { zoneId: this.runtimeCtx?.zone?.id, deviceId: this.id });
      }
    }
  }

  estimateEnergyKWh(tickHours) {
    if (this.state === 'idle') {
      return 0;
    }
    const h = resolveTickHours({ tickLengthInHours: tickHours ?? this.runtimeCtx?.tickLengthInHours });
    const p = Number(this.settings?.power ?? 0); // kW(el)
    return Math.max(0, p * h);
  }
}
