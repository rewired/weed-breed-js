// src/engine/Plant.js
// Minimally integrated plant model with transpiration (→ RH) & CO₂ consumption.
// Adheres to the arcade formulas from "WB-Formeln.md" (§3.1, §3.2) and our naming conventions.

import { ensureEnv, addLatentWater, addCO2Delta } from './deviceUtils.js';
import { env } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';
import { createRng } from '../lib/rng.js';

export class Plant {
  constructor({
    id = uuidv4(),
    label = 'Plant',
    zoneId = null,
    area_m2 = 0.25,
    leafAreaIndex = null, // if null, default from env.plant
    health = 1.0,
    stage = 'vegetative', // 'seedling' | 'vegetative' | 'flowering' | 'harvestReady'
    ageHours = 0,
    rng = createRng(),
    strain = null,
    method = null,
    payload = {}
  } = {}) {
    this.id = id;
    this.label = label;
    this.zoneId = zoneId;
    this.area_m2 = area_m2;
    this.leafAreaIndex = (leafAreaIndex == null) ? env.plant.laiDefault : Number(leafAreaIndex);
    this.health = Number.isFinite(health) ? health : 1.0;
    this.stage = stage;
    this.ageHours = Number(ageHours || 0);
    this.rng = rng;
    this.strain = strain;
    this.method = method;
    this.payload = payload;

    // Apply genetic variance
    const variance = env.plant.geneticVariance ?? 0;
    this.geneticFactor = 1 + (this.rng.float() - 0.5) * variance;

    this.lastWaterConsumptionL = 0;
    this.stress = 0; // 0..1
    this.stressors = {};
    this.lastNutrientConsumption = { N: 0, P: 0, K: 0 };
  }

  /**
   * One tick of plant logic:
   * - Transpiration (E_plant) → addLatentWater(+kg)
   * - CO₂ consumption (δC) → addCO2Delta(−ppm)
   * - (optional) Stage & growth (deliberately kept simple here)
   */
  async tick(zone, tickLengthInHours, tickIndex) {
    const s = ensureEnv(zone);
    const L = Number(s.ppfd ?? 0);           // µmol/m²·s
    const T = Number(s.temperature ?? 24);   // °C
    const RH = Number(s.humidity ?? 0.6);    // 0..1

    const difficulty = zone.runtime?.difficulty?.plantStress ?? {};
    const optimalRangeMultiplier = difficulty.optimalRangeMultiplier ?? 1.0;
    const stressAccumulationMultiplier = difficulty.stressAccumulationMultiplier ?? 1.0;

    // ---- Transpiration (VPD-Proxy) ----
    const lai = this.leafAreaIndex ?? env.plant.laiDefault;
    const vpdProxy = Math.max(0, (1 - RH) * Math.max(0, T - env.plant.tBase)) * (env.plant.vpdBeta ?? 1);
    const fLight = L > 0 ? (L / (L + env.plant.L50)) : 0;
    const fHealth = Math.max(0, Math.min(1, this.health));
    const gv = env.plant.transpiration_gvPerLAI; // kg/tick pro LAI bei vpdProxy=1

    const Eplant = gv * (lai || 1) * vpdProxy * fLight * fHealth * this.geneticFactor; // kg/tick
    this.lastWaterConsumptionL = Eplant;
    if (Eplant > 0) addLatentWater(s, Eplant);

    // ---- CO₂ consumption (Arcade) ----
    const fCO2 = s.co2ppm > 0 ? (s.co2ppm / (s.co2ppm + env.plant.C50)) : 0;
    const fT   = Math.exp(-Math.pow((T - env.plant.tOpt) / env.plant.sigmaT, 2));
    const fRH  = 1 - Math.min(1, Math.abs(RH - env.plant.rhOpt) / env.plant.rhWidth);

    const A = (1.0) * fLight * fCO2 * fT * fRH; // A_max=1 as game scaling
    const deltaC = (env.plant.co2KappaA ?? 1) * A * (lai || 1) * this.geneticFactor; // ppm/tick
    if (deltaC > 0) addCO2Delta(s, -deltaC);

    // ---- Nutrient Consumption ----
    const baseUptake = env.plant.baseNutrientUptake;
    const demand = {
      N: baseUptake.N * A,
      P: baseUptake.P * A,
      K: baseUptake.K * A,
    };
    this.lastNutrientConsumption = demand;

    // ---- Stress & Health ----
    this.stressors = {};
    const tOpt = this.strain?.environmentalPreferences?.idealTemperature?.[this.stage]?.[0] ?? env.plant.tOpt;
    const rhOpt = this.strain?.environmentalPreferences?.idealHumidity?.[this.stage]?.[0] ?? env.plant.rhOpt;
    const lightPreferences = this.strain?.environmentalPreferences?.lightIntensity?.[this.stage] ?? [400, 800];

    // Environmental stress
    // Environmental stress
    const tStress = Math.abs(T - tOpt) / (env.plant.sigmaT * optimalRangeMultiplier);
    if (tStress > 0.1) this.stressors.temperature = { actual: T, target: tOpt };

    const rhStress = Math.abs(RH - rhOpt) / (env.plant.rhWidth * optimalRangeMultiplier);
    if (rhStress > 0.1) this.stressors.humidity = { actual: RH, target: rhOpt };

    const lightsOn = zone?.runtime?.lightsOn !== false;
    let lStress = 0;
    if (lightsOn) {
      lStress = (L < lightPreferences[0] || L > lightPreferences[1]) ? 0.2 : 0;
      if (lStress > 0) this.stressors.light = { actual: L, target: lightPreferences };
    }

    const envStress = Math.min(1, (tStress + rhStress + lStress) / 3);

    // Nutrient stress
    const nutrientStress = this.payload.nutrientStress ?? 0;
    if (nutrientStress > 0) this.stressors.nutrients = { level: 'low' };

    // Combine stresses
    const totalStress = Math.min(1, envStress + nutrientStress);

    // Factor in resilience
    const resilienceFactor = 1 - (this.strain?.generalResilience ?? 0.5);

    // Decay old stress and add new stress, with some variance
    const stressDecay = 0.9;
    const stressVariance = (this.rng.float() - 0.5) * 0.05; // +/- 2.5%
    const newStress = totalStress * resilienceFactor * stressAccumulationMultiplier;
    this.stress = this.stress * stressDecay + (1 - stressDecay) * newStress;
    this.stress = Math.max(0, Math.min(1, this.stress + stressVariance));

    // Health update: damage from stress, recovery from low stress
    const healthImpactFactor = 0.05;
    const recoveryFactor = 0.01;
    let healthChange = -this.stress * healthImpactFactor;
    if (this.stress < 0.1) {
      healthChange += (1 - this.stress) * recoveryFactor; // Recover when stress is low
    }
    this.health += healthChange;
    this.health = Math.max(0, Math.min(1, this.health));


    // ---- Age & simple stage logic (optional/placeholder) ----
    this.ageHours += Number(tickLengthInHours || env.time.tickLengthInHoursDefault || 3);

    const vegDays = this.strain?.photoperiod?.vegetationDays ?? 21;
    const flowerDays = this.strain?.photoperiod?.floweringDays ?? 56;

    // Heuristic for stage change, now based on strain data
    if (this.stage === 'vegetative' && this.ageHours > 24 * vegDays) {
      this.stage = 'flowering';
    } else if (this.stage === 'flowering' && this.ageHours > 24 * (vegDays + flowerDays)) {
      this.stage = 'harvestReady';
    }
  }

  /**
   * Calculates the yield of this plant in grams.
   * @returns {number} - Yield in grams
   */
  calculateYield() {
    const baseYield = env.plant.baseYieldGramsPerM2 ?? 400;
    const yieldGrams = baseYield * this.area_m2 * this.health * this.geneticFactor;
    return Math.max(0, yieldGrams);
  }
}
