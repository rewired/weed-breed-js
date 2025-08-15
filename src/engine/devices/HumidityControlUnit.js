// src/engine/devices/HumidityControlUnit.js
import { BaseDevice } from '../BaseDevice.js';
import { ensureEnv, addLatentWater } from '../deviceUtils.js';
import { env } from '../../config/env.js';

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

    this.state = 'idle';
    if (now > target + hyst * 0.5) {
        this.state = 'dehumidifying';
    }
    if (now < target - hyst * 0.5) {
        this.state = 'humidifying';
    }

    if (this.state === 'dehumidifying') {
      const kg = Number(settings.dehumidifyRateKgPerTick ?? 0);
      if (kg > 0) addLatentWater(s, -kg);
    } else if (this.state === 'humidifying') {
      const kg = Number(settings.humidifyRateKgPerTick ?? 0);
      if (kg > 0) {
        addLatentWater(s, kg);
        const costEngine = zone?.costEngine ?? this.runtimeCtx?.zone?.costEngine;
        costEngine?.bookWater?.(kg);
      }
    }
  }

  estimateEnergyKWh(tickHours) {
    if (this.state === 'idle') {
      return 0;
    }
    const h = Number(tickHours ?? this.runtimeCtx?.tickLengthInHours ?? env?.time?.tickLengthInHoursDefault ?? 3);
    const p = Number(this.settings?.power ?? 0); // kW(el)
    return Math.max(0, p * h);
  }
}
