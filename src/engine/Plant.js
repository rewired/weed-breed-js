// src/engine/Plant.js
// Minimally integrated plant model with transpiration (→ RH) & CO₂ consumption.
// Adheres to the arcade formulas from "WB-Formeln.md" (§3.1, §3.2) and our naming conventions.

import { ensureEnv, addLatentWater, addCO2Delta, getZoneVolume } from './deviceUtils.js';
import { env } from '../config/env.js';
import { resolveTickHours } from '../lib/time.js';
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
    payload = {},
    onBiomassUpdate = null,
    noiseSeed = null
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

    this.onBiomassUpdate = onBiomassUpdate;

    // Biomass state
    this.state = {
      biomassDry_g: 0,
      biomassFresh_g: 0,
      biomassPartition: {
        leaves_g: 0,
        stems_g: 0,
        roots_g: 0,
        buds_g: 0,
      },
    };

    // Deterministic noise configuration
    const noiseCfg = strain?.noise ?? {};
    this.noise = {
      enabled: noiseCfg.enabled !== undefined ? noiseCfg.enabled : true,
      pct: Math.max(0, noiseCfg.pct ?? 0.02),
    };
    this.noiseSeed = noiseSeed ?? hashToSeed(this.id);
    this._rng = mulberry32(this.noiseSeed);

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
    const tickH = resolveTickHours({ tickLengthInHours: zone?.tickLengthInHours ?? tickLengthInHours });

    const difficulty = zone.runtime?.difficulty?.plantStress ?? {};
    const optimalRangeMultiplier = difficulty.optimalRangeMultiplier ?? 1.0;
    const stressAccumulationMultiplier = difficulty.stressAccumulationMultiplier ?? 1.0;

    // Determine if lights are expected to be on for this tick
    let lightsOn = zone.runtime?.lightsOn;
    if (typeof lightsOn !== 'boolean') {
      const lightCycle = this.strain?.environmentalPreferences?.lightCycle;
      if (lightCycle) {
        const cycle = lightCycle[this.stage] ?? lightCycle.default ?? [18, 6];
        const lightHours = cycle[0];
        const currentSimHour = (tickIndex * tickH) % 24;
        lightsOn = currentSimHour < lightHours;
      } else {
        lightsOn = true;
      }
    }

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
    const leafArea = this.area_m2 * (lai || 1);
    const maxAssim = Number(env.plant.maxAssimilationMolPerM2PerS ?? 30e-6);
    const uptakeMolPerSec = maxAssim * A * leafArea * this.geneticFactor;
    const uptakeMol = uptakeMolPerSec * 3600 * tickH; // mol per tick
    if (uptakeMol > 0) {
      const vol = getZoneVolume(zone);
      const airMolDen = Number(env.physics.airMolarDensityMolPerM3 ?? 41.6);
      const ppmDelta = uptakeMol / (airMolDen * vol) * 1e6;
      addCO2Delta(s, -ppmDelta);
    }

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

    if (this.health <= 0) {
      this.isDead = true;
      this.stage = 'dead';
      return;
    }


    // ---- Age & simple stage logic (optional/placeholder) ----
    this.ageHours += tickH;

    const vegDays = this.strain?.photoperiod?.vegetationDays ?? 21;
    const flowerDays = this.strain?.photoperiod?.floweringDays ?? 56;

    // Heuristic for stage change, now based on strain data
    if (this.stage === 'vegetative' && this.ageHours > 24 * vegDays) {
      this.stage = 'flowering';
    } else if (this.stage === 'flowering' && this.ageHours > 24 * (vegDays + flowerDays)) {
      this.stage = 'harvestReady';
    }

    this.updateBiomass({ zone });
  }

  getPhase() {
    return this.stage || 'vegetation';
  }

  /**
   * Daily Light Integral for a tick.
   * @param {number} ppfd - Photosynthetic photon flux density [µmol/m²/s]
   * @param {number} hours - Tick duration in hours
   * @returns {number} DLI [mol/m²/tick]
   */
  getDailyLightIntegral(ppfd, hours) {
    return Number(ppfd) * 1e-6 * 3600 * Number(hours);
  }

  /**
   * Biomass growth model based on light and stress factors.
   * @param {object} ctx - Simulation context { zone }
   */
  updateBiomass(ctx = {}) {
    const zone = ctx.zone ?? {};
    const h = Number(zone.tickLengthInHours ?? ctx.tickLengthInHours ?? 1);

    // -- Light driven potential growth --
    const DLI = this.getDailyLightIntegral(zone.ppfd ?? 0, h); // mol/m²/tick

    const strain = this.strain ?? {};
    const phase = this.getPhase();
    const growthModel = strain.growthModel ?? {};

    const LUE = growthModel.baseLUE_gPerMol ?? 0.9; // g/mol
    const LAI = clamp(0.5, strain.morphology?.leafAreaIndex ?? 3.0, 3.5);
    const dW_light = LUE * DLI * LAI; // g/tick potential dry mass

    // -- Stress factors --
    const Tref = growthModel.temperature?.T_ref_C ?? 25;
    const Q10 = growthModel.temperature?.Q10 ?? 2.0;
    const f_T = tempFactorQ10(zone.temperatureC ?? 25, Tref, Q10);
    const f_CO2 = co2Factor(zone.co2ppm ?? 400);
    const f_H2O = waterFactor(zone.water);
    const f_NPK = npkFactor(zone.npk);
    const f_RH = rhFactor(zone.humidity);
    const f_stress = clamp01(f_T * f_CO2 * f_H2O * f_NPK * f_RH);

    // -- Maintenance respiration --
    const maintFrac = growthModel.maintenanceFracPerDay ?? 0.01; // g/g/d
    const maintenance = maintFrac * this.state.biomassDry_g * (h / 24);

    // -- Logistic cap per phase --
    const maxDry = growthModel.maxBiomassDry_g ?? 180;
    const capMul = growthModel.phaseCapMultiplier?.[phase] ?? 1.0;
    const cap = maxDry * capMul;

    const growthRaw = dW_light * f_stress;
    const growthCapped = Math.max(0, growthRaw * (1 - (this.state.biomassDry_g / cap)));
    let dW_net = Math.max(0, growthCapped - maintenance);

    // -- Optional deterministic noise --
    if (this.noise.enabled && this.noise.pct > 0) {
      dW_net = applyNoise(this, dW_net, this.noise.pct);
    }

    // -- Accumulate biomass --
    if (Number.isFinite(dW_net) && dW_net > 0) {
      this.state.biomassDry_g += dW_net;
    }
    this.state.biomassDry_g = Math.max(0, this.state.biomassDry_g);

    const dmFrac = growthModel.dryMatterFraction?.[phase] ?? 0.22;
    this.state.biomassFresh_g = this.state.biomassDry_g / dmFrac;

    partitionBiomass(this.state, dW_net, phase, growthModel.harvestIndex, cap);

    // Telemetry hook
    this.onBiomassUpdate?.(this, {
      dW_net,
      growthRaw,
      maintenance,
      factors: { f_T, f_CO2, f_H2O, f_NPK, f_RH },
      phase,
    });
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

// ---- Helper functions ----
function tempFactorQ10(T, Tref, Q10) {
  // Q10 temperature response model
  const f = Math.pow(Q10, (Number(T) - Tref) / 10);
  return clamp(0, f, 1.2);
}

function co2Factor(ppm) {
  const f = 0.8 + ((Number(ppm) - 400) * 0.00025); // linear 400→0.8, 1200→1.0
  return clamp(0.6, f, 1.05);
}

function waterFactor(coverage = 1) {
  return clamp(0.3, Number(coverage), 1.0);
}

function npkFactor(coverage = 1) {
  return clamp(0.5, 0.5 + 0.5 * Number(coverage), 1.0);
}

function rhFactor(rh = 0.6) {
  if (!Number.isFinite(rh)) return 1.0;
  return (rh >= 0.4 && rh <= 0.7) ? 1.0 : 0.8;
}

function clamp(min, x, max) {
  return Math.min(max, Math.max(min, x));
}

function clamp01(x) {
  return clamp(0, x, 1);
}

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashToSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function applyNoise(self, x, pct) {
  const u = self._rng(); // deterministic [0,1)
  return x * (1 + pct * (2 * u - 1));
}

function partitionBiomass(state, dW, phase, harvestIndex, cap) {
  if (!Number.isFinite(dW) || dW <= 0) return;
  const p = state.biomassPartition;
  if (phase === 'flowering') {
    const target = harvestIndex?.targetFlowering ?? 0.7;
    const progress = clamp01(state.biomassDry_g / (cap || state.biomassDry_g));
    const budFrac = target * progress;
    const rootFrac = 0.10;
    const rest = 1 - budFrac - rootFrac;
    const leafFrac = rest * 0.6;
    const stemFrac = rest * 0.4;
    p.leaves_g += dW * leafFrac;
    p.stems_g += dW * stemFrac;
    p.roots_g += dW * rootFrac;
    p.buds_g += dW * budFrac;
  } else {
    p.leaves_g += dW * 0.55;
    p.stems_g += dW * 0.35;
    p.roots_g += dW * 0.10;
  }
}
