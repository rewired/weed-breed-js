// src/engine/devices/ClimateUnit.js
// Klimaregelung mit Hysterese + Leistungsgrenzen; schreibt negative Wärmeleistung in env._heatW
import { env, AIR_DENSITY, AIR_CP } from '../../config/env.js';
import { BaseDevice } from '../BaseDevice.js';
import { ensureEnv, getZoneVolume, clamp } from '../deviceUtils.js';

export class ClimateUnit extends BaseDevice {
  constructor(json, runtimeCtx) {
    super(json, runtimeCtx);
    this._on = false;
    this._lastPowerFrac = 0; // Duty-Cycle 0..1
  }

  applyEffect(zone) {
    const s = ensureEnv(zone);
    const settings = this.settings ?? {};
    const tickH   = Number(this.runtimeCtx?.tickLengthInHours ?? env?.time?.tickLengthInHoursDefault ?? 3);
    const dtSec   = Math.max(1, tickH * (env?.factors?.hourToSec ?? 3600));

    // Setpoint & Hysterese
    const target = Number(settings.targetTemperature ?? 24);
    const hyst   = Number(settings.hysteresisK ?? 0.5);
    const now    = Number(s.temperature ?? target);

    if (!this._on && now > target + hyst * 0.5) this._on = true;
    if ( this._on && now < target - hyst * 0.5) this._on = false;

    let coolingW_th = 0;
    let powerFrac   = 0;

    if (this._on && now > target) {
      // Thermische Energie, um bis zum Setpoint zu kommen
      const volume  = getZoneVolume(zone);
      const rhoAir  = Number(env?.physics?.airDensity ?? AIR_DENSITY);
      const cpAir   = Number(env?.physics?.airCp ?? AIR_CP);
      const airMass = Math.max(1e-6, volume * rhoAir);
      const massMultiplier = Number(env?.defaults?.thermalMassMultiplier ?? 200);
      const C_eff = airMass * cpAir * Math.max(1, massMultiplier);

      const desiredDropK = Math.max(0, now - target);      // K
      const requiredJ    = desiredDropK * C_eff;           // J
      const requiredW    = requiredJ / dtSec;              // W (thermisch)

      // Kapazitätsgrenzen (thermisch)
      const KW_TO_W  = Number(env?.factors?.kwToW ?? 1000);
      const powerElKW = Number(settings.power ?? settings.powerInKilowatts ?? 0); // elektrisch
      const powerElW  = Math.max(0, powerElKW * KW_TO_W);

      const cop = Number(settings.cop ?? (settings.coolingEfficiency && settings.coolingEfficiency > 0.5 ? settings.coolingEfficiency : 3.0));
      const capKW_th = (
        (settings.maxCooling != null)       ? Number(settings.maxCooling)
        : (settings.coolingCapacity != null)? Number(settings.coolingCapacity)
        : (powerElKW > 0 ? powerElKW * Math.max(1, cop) : 0)
      );
      const capW_th = Math.max(0, capKW_th * KW_TO_W);

      coolingW_th = clamp(requiredW, 0, capW_th);

      // Elektrische Leistung (W) ~ Thermalleistung / COP (begrenzen auf el. P_max)
      const requiredElW = (cop > 0) ? (coolingW_th / cop) : powerElW;
      const elW = Math.min(requiredElW, powerElW);
      powerFrac = (powerElW > 0) ? clamp(elW / powerElW, 0, 1) : 0;

      // Wirkung: negative Wärmeleistung in Aggregat
      s._heatW = (s._heatW ?? 0) - coolingW_th;
    } else {
      powerFrac = 0;
    }

    this._lastPowerFrac = powerFrac;
  }

  estimateEnergyKWh(tickHours) {
    const tickH = Number(tickHours ?? this.runtimeCtx?.tickLengthInHours ?? env?.time?.tickLengthInHoursDefault ?? 3);
    const powerElKW = Number(this.settings?.power ?? this.settings?.powerInKilowatts ?? 0);
    return Math.max(0, powerElKW * clamp(this._lastPowerFrac ?? 0, 0, 1) * tickH);
  }
}
