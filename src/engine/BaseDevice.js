/**
 * Abstract device base according to ADR (§4).
 * Prices and maintenance are defined separately in `devicePrices.json`.
 * @module engine/BaseDevice
 */
import _ from 'lodash';
import { env } from '../config/env.js';
import { resolveTickHours } from '../lib/time.js';

const { pick } = _;

const ALLOWED_OVERRIDES = [
  'targetTemperature',
  'targetHumidity',
  'targetCO2',
  'mode'
];

/**
 * Base class for all devices.
 */
export class BaseDevice {
  /**
   * @param {object} blueprint - JSON blueprint (see device_schema.md)
   * @param {object} runtime   - { zone, tickLengthInHours }
   * @param {object} [overrides={}] - Runtime settings (e.g., setpoints)
   */
  constructor(blueprint, runtime, overrides = {}) {
    this.id = blueprint?.id ?? crypto.randomUUID?.() ?? String(Math.random());
    this.kind = blueprint?.kind ?? 'Device';
    this.name = blueprint?.name ?? 'Unnamed Device';
    this.quality = blueprint?.quality ?? 1.0;
    this.complexity = blueprint?.complexity ?? 0.0;
    this.blueprintId = blueprint?.blueprintId ?? blueprint?.id;

    // Back-compat: accept mtbf_hours, mtbfInHours; prefer lifespanInHours
    this.lifespanInHours =
      blueprint?.lifespanInHours ??
      blueprint?.mtbfInHours ??
      blueprint?.mtbf_hours ??
      null;

    // Safe merging of settings: Blueprint -> Overrides
    const safeOverrides = pick(overrides, ALLOWED_OVERRIDES);
    this.settings = {
      ...(blueprint?.settings ?? {}),
      ...safeOverrides
    };

    // Optional guard clause against unrealistic setpoints
    const tempRange = this.settings.targetTemperatureRange;
    if (tempRange && this.settings.targetTemperature != null) {
      this.settings.targetTemperature =
        Math.max(tempRange[0], Math.min(tempRange[1], this.settings.targetTemperature));
    }

    this.status = 'ok';
    this.ageTicks = 0;

    this.zoneRef = runtime?.zone ?? null;
    this.tickLengthInHours = resolveTickHours(runtime);
    this.runtimeCtx = runtime;
  }

  /**
   * Called by the zone at each simulation step.
   * Manages the internal state of the device (aging, failure).
   */
  tick() {
    this.ageTicks += 1;
    if (this.status !== 'ok') {
      return; // Already failed
    }

    // Simple failure model based on MTBF
    let mtbfHours = this.lifespanInHours ?? env.defaults.deviceMTBF_hours_default ?? (5 * 365 * 24);
    const tickHours = this.tickLengthInHours;

    // Apply difficulty modifier
    if (this.zoneRef?.runtime?.difficulty?.deviceFailure?.mtbfMultiplier) {
      mtbfHours *= this.zoneRef.runtime.difficulty.deviceFailure.mtbfMultiplier;
    }

    // Failure probability per tick, modulated by quality
    // Quality 1.0 -> standard MTBF, quality < 1.0 -> shorter MTBF
    const qualityFactor = 1.0 / (this.quality || 0.1);
    const failureProbPerTick = (tickHours / mtbfHours) * qualityFactor;

    const rnd = this.zoneRef?.rng?.float?.()
         ?? this.runtimeCtx?.rng?.float?.()
         ?? Math.random(); // Fallback
    if (rnd < failureProbPerTick) {
      this.status = 'broken';
      // Optional: Log event for failure
      this.zoneRef?.logger?.warn?.({ deviceId: this.id, name: this.name, ageTicks: this.ageTicks }, 'DEVICE FAILURE');
    }
  }

  // kW → kWh per tick
  powerConsumptionPerTick() {
    const power = Number(this.settings.power ?? 0); // kW
    return power * this.tickLengthInHours;          // kWh per tick
  }

  /**
   * Apply the effect to the zone/environment (no-op in base class)
   * Derived classes override this method.
   */
  applyEffect(/* zone */) {
    // Example: Lamps could increase PPFD/temperature
  }

  toJSON() {
    return {
      id: this.id,
      kind: this.kind,
      name: this.name,
      quality: this.quality,
      complexity: this.complexity,
      settings: this.settings
    };
  }
}
