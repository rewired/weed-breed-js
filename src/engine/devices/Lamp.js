/**
 * Lighting device affecting PPFD and heat.
 * @module engine/devices/Lamp
 */
import { BaseDevice } from '../BaseDevice.js';
import { ensureEnv, readPowerKw, readPPFD } from '../deviceUtils.js';
import { env } from '../../config/env.js';
import { resolveTickHours } from '../../lib/time.js';

/**
 * Lamp device controlling light and heat output.
 */
export class Lamp extends BaseDevice {
  constructor(json, runtimeCtx) {
    super(json, runtimeCtx);
    this.state = 'on'; // 'on' or 'off'
  }

  /**
   * Toggle lamp state.
   * @param {'on'|'off'} [forceState]
   */
  toggle(forceState) {
    if (forceState === 'on' || forceState === 'off') {
      this.state = forceState;
    } else {
      this.state = this.state === 'on' ? 'off' : 'on';
    }
  }

  /**
   * Apply lamp effects to the zone.
   * @param {object} zone
   */
  applyEffect(zone) {
    if (this.state === 'off') {
      return;
    }
    const s = ensureEnv(zone);
    const settings = this.settings ?? {};

    // Leistung & Wärmeanteil
    const powerKW = readPowerKw(settings);
    const heatFrac = (settings.heatFraction != null) ? Number(settings.heatFraction) : 0.9;
    const heatW = powerKW * (env?.factors?.kwToW ?? 1000) * heatFrac;
    s._heatW = (s._heatW ?? 0) + heatW;

    // PPFD
    let ppfd = readPPFD(settings);
    if (!ppfd) {
      // Falls kein PPFD gesetzt: PPE * P(W) / coverageArea
      const ppe = Number(settings.ppeUmolPerJ ?? settings.ppe ?? 0); // µmol/J
      const coverage = Number(settings.coverageArea ?? zone.area ?? 1);
      if (ppe > 0 && powerKW > 0 && coverage > 0) {
        const powerW = powerKW * (env?.factors?.kwToW ?? 1000);
        const geom = Number(settings.geometryFactor ?? 1.0);
        ppfd = (ppe * powerW * geom) / coverage; // µmol/m²·s
      }
    }

    if (ppfd > 0) {
      // Wenn coverage kleiner als Zonenfläche ist, mitteln wir über die Zone
      const coverage = Number(settings.coverageArea ?? zone.area ?? 1);
      const scale = Math.min(1, Math.max(coverage, 0) / Math.max(zone.area, 1e-6));
      s.ppfd = (s.ppfd ?? 0) + ppfd * scale;
    }
  }

  /**
   * Estimate energy usage for a tick.
   * @param {number} tickHours
   * @returns {number}
   */
  estimateEnergyKWh(tickHours) {
    if (this.state === 'off') {
      return 0;
    }
    const h = resolveTickHours({ tickLengthInHours: tickHours ?? this.runtimeCtx?.tickLengthInHours });
    const powerKW = readPowerKw(this.settings ?? {});
    return Math.max(0, powerKW * h);
  }
}
