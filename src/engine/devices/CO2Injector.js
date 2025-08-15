// src/engine/devices/CO2Injector.js
// CO₂-Injektor: addiert ppm-Pulse pro Tick (einfache Hysterese um Setpoint)
import { BaseDevice } from '../BaseDevice.js';
import { ensureEnv, addCO2Delta } from '../deviceUtils.js';

export class CO2Injector extends BaseDevice {
  constructor(json, runtimeCtx) {
    super(json, runtimeCtx);
    this._lastOn = false;
  }

  applyEffect(zone) {
    const s = ensureEnv(zone);
    const target   = Number(this.settings?.targetCO2 ?? this.settings?.setpoint ?? 1100); // ppm
    const hyster   = Number(this.settings?.hysteresis ?? 50);                             // ppm
    const pulse    = Number(this.settings?.pulsePpmPerTick ?? 150);                       // ppm/Tick
    const mode     = this.settings?.mode ?? 'auto';

    if (mode === 'off') {
      this._lastOn = false;
      return;
    }

    const onLow   = target - hyster * 0.5;
    const offHigh = target + hyster * 0.5;

    if (s.co2ppm >= onLow && s.co2ppm <= offHigh) {
      this._lastOn = false;
      return;
    }

    if (s.co2ppm < onLow) this._lastOn = true;
    if (s.co2ppm > offHigh) this._lastOn = false;

    if (this._lastOn && pulse > 0) {
      addCO2Delta(s, pulse);
      this.runtimeCtx?.zone?.costEngine?.bookCO2(pulse, { zoneId: this.runtimeCtx?.zone?.id, deviceId: this.id });
    }
  }

  estimateEnergyKWh(_tickHours) {
    // in der Regel Gas/Flasche -> 0 kWh
    return 0;
  }
}
