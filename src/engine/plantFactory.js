// src/engine/plantFactory.js
// ESM - creates Plant states (or instances) from strain blueprints.
// Prices (seed/harvest) are optionally mixed in from /data/config/strainPrices.json.

import { randomUUID } from 'crypto';
import { loadStrainBySlug, loadStrainById } from './strainLoader.js';

/**
 * Creates an initial plant state from a strain object.
 * Independent of a specific Plant class; compatible for zone.addPlant(state).
 *
 * @param {object} strain - loaded strain JSON (via strainLoader)
 * @param {object} [opts]
 * @param {string} [opts.id] - fixed Plant-ID; default: UUID
 * @param {number} [opts.area_m2=0.25] - occupied area (m²), typically from CultivationMethod
 * @param {Date}   [opts.plantedAt=new Date()] - planting date
 * @param {string} [opts.label=strain.name] - display/plant name
 * @param {string} [opts.zoneId=null] - zone assignment
 * @param {Map}    [opts.strainPriceMap] - Map<strainId, { seedPrice, harvestPricePerGram }>
 * @returns {object} Plain state object
 */
export function buildPlantStateFromStrain(strain, opts = {}) {
  const {
    id = randomUUID(),
    area_m2 = 0.25,
    plantedAt = new Date(),
    label = strain?.name ?? 'Plant',
    zoneId = null,
    strainPriceMap
  } = opts;

  const state = {
    // Identity & Assignment
    id,
    label,
    zoneId,

    // Blueprint/Genetics (only relevant excerpts, deliberately kept flat)
    strain: {
      id: strain.id,
      name: strain.name,
      genotype: strain.genotype,
      photoperiod: strain.photoperiod,
      nutrientDemand: strain.nutrientDemand,
      waterDemand: strain.waterDemand,
      environmentalPreferences: strain.environmentalPreferences ?? null,
      diseaseResistance: strain.diseaseResistance ?? null,
      morphology: strain.morphology ?? null,
      chemotype: strain.chemotype ?? null,
      meta: strain.meta ?? {}
    },

    // Geometry/Area
    area_m2,

    // Time
    plantedAt: plantedAt.toISOString(),
    ageHours: 0,

    // Simulation state
    stage: 'seedling',     // seedling -> vegetation -> flowering -> harvestable
    biomass_g: 0,
    health: 1.0,           // 0..1
    stress: 0.0,           // 0..1
    infection: 0.0,        // 0..1
    isAlive: true,
    isHarvestable: false,

    // Resource buffer (engine-dependent, deliberately kept small)
    resources: {
      water_l: 0,
      npk: { N: 0, P: 0, K: 0 }
    },

    // Economy (optionally set, see below)
    pricing: null
  };

  // Inject prices (optional) from /data/config/strainPrices.json
  if (strainPriceMap && strainPriceMap.has(strain.id)) {
    const sp = strainPriceMap.get(strain.id);
    state.pricing = {
      seedPrice: sp.seedPrice ?? null,
      harvestPricePerGram: sp.harvestPricePerGram ?? null
    };
  }

  return state;
}

/**
 * Creates a Plant instance directly if a Plant class is available.
 * Expects: new PlantClass(plainState)
 */
export function createPlantInstance(PlantClass, strain, opts = {}) {
  const state = buildPlantStateFromStrain(strain, opts);
  return new PlantClass(state);
}

/**
 * Convenience: create by strain slug (filename without .json).
 * @param {string} slug - e.g., "ak-47"
 * @param {object} [opts] - see buildPlantStateFromStrain
 * @param {Function|null} [PlantClass=null] - optional: class for direct instantiation
 */
export async function createPlantFromStrainSlug(slug, opts = {}, PlantClass = null) {
  const strain = await loadStrainBySlug(slug);
  if (PlantClass) return createPlantInstance(PlantClass, strain, opts);
  return buildPlantStateFromStrain(strain, opts);
}

/**
 * Convenience: create by strain ID.
 * @param {string} id - Strain ID (not the filename)
 * @param {object} [opts] - see buildPlantStateFromStrain
 * @param {Function|null} [PlantClass=null] - optional: class for direct instantiation
 */
export async function createPlantFromStrainId(id, opts = {}, PlantClass = null) {
  const strain = await loadStrainById(id);
  if (PlantClass) return createPlantInstance(PlantClass, strain, opts);
  return buildPlantStateFromStrain(strain, opts);
}
