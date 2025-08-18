// src/config/env.js
// Central defaults/constants for the simulation (ES Modules)

export const env = {
  time: {
    // Global default tick length in hours (can be overridden per simulation/zone)
    tickLengthInHoursDefault: 1
  },
  physics: {
    // Air (at approx. 20–25°C)
    airDensity: 1.2,   // kg/m³
    airCp: 1005,       // J/(kg·K) – specific heat capacity
    airMolarDensityMolPerM3: 41.6 // mol/m³ at ~20 °C
  },
  factors: {
    kwToW: 1000,       // kW → W
    hourToSec: 3600    // h → s
  },
  defaults: {
    ceilingHeightM: 2.5,
    thermalMassMultiplier: 200,   // effective heat capacity (shell/water/inventory)
    passiveUaPerM2: 0.5,          // W/(m²·K) – Passive heat transfer per m² of shell area
    airChangesPerHour: 0.3,       // simple leakage to the outside
    outsideTemperatureC: 22,      // Outside temperature
    outsideHumidity: 0.5,         // Outside RH (0..1)
    outsideCo2ppm: 420,           // Outside CO₂
    temperatureC: 24,             // Start temperature
    humidity: 0.6,                // Start RH (0..1)
    co2ppm: 420,                  // Start CO₂
    moistureKg: 0,                // Start moisture pool (kg H2O)

    // Device reliability (Mean Time Between Failures) -> Default, if not in blueprint
    deviceMTBF_hours_default: 8760 // 1 year
  },
  humidity: {
    // Moisture pool model: Mv_max = moistureRefKgPerM3 * volume
    moistureRefKgPerM3: 0.017,   // kg/m³ at 20 °C (saturation)
    alpha: 1.0,                  // Normalization RH = alpha * (Mv/MvMax)
    deriveFromTemperature: true  // adjust saturation with temperature
  },
  clamps: {
    humidityMin: 0.30,
    humidityMax: 0.95,
    co2ppmMin: 350,
    co2ppmMax: 2000
  },
  plant: {
    // VPD/Transpiration & Photosynthesis (Arcade models; tunable)
    vpdBeta: 1.0,
    tBase: 10,                    // °C
    laiDefault: 1.0,
    transpiration_gvPerLAI: 2.5e-4, // kg/tick per (LAI=1) at VPD-Proxy=1
    L50: 400,                     // µmol/m²·s
    C50: 800,                     // ppm
    tOpt: 25,                     // °C
    sigmaT: 5,                    // °C
    rhOpt: 0.6,
    rhWidth: 0.4,
    co2KappaA: 1.0,               // ppm/tick per (A*LAI)
    maxAssimilationMolPerM2PerS: 30e-6, // mol CO₂/m²/s at A=1

    // Biology & Yield
    geneticVariance: 0.2,         // +/- 10% genetic variance (0.2 = 20%)
    baseYieldGramsPerM2: 450,     // g/m² under ideal conditions
    baseNutrientUptake: {         // mg/tick at A=1
      N: 1.0,
      P: 0.5,
      K: 1.2
    }
  }
};

// Convenient named exports (Backward-Compat)
export const AIR_DENSITY = env.physics.airDensity;
export const AIR_CP = env.physics.airCp;
export const TICK_HOURS_DEFAULT = env.time.tickLengthInHoursDefault;
export const HOUR_TO_SEC = env.factors.hourToSec;
export const OUTDOOR_TEMP_C = env.defaults.outsideTemperatureC;
export const THERMAL_MASS_MULTIPLIER = env.defaults.thermalMassMultiplier;
export const PASSIVE_UA_PER_M2 = env.defaults.passiveUaPerM2;

/**
 * Approximate saturation humidity (water vapor density) for a given temperature.
 * Uses the Magnus formula. Returns kg H₂O per m³ of air.
 * @param {number} tC - Temperature in °C
 * @returns {number} kg/m³
 */
export function saturationMoistureKgPerM3(tC = 20) {
  const t = Number(tC);
  const es = 610.94 * Math.exp((17.625 * t) / (243.04 + t)); // Pa
  const Rv = 461.5; // J/(kg·K)
  const Tk = t + 273.15; // K
  return es / (Rv * Tk);
}
