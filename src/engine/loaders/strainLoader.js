/**
 * Loader utilities for strain definitions with UUID enforcement and slug lookups.
 * @module engine/loaders/strainLoader
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { validate as isUuid, version as uuidVersion } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assumption: Project structure: <root>/src/engine/* and <root>/data/strains/*.json
const STRAINS_DIR = path.resolve(__dirname, '../../../data/strains');

async function readJson(fp) {
  const raw = await fs.readFile(fp, 'utf-8');
  return JSON.parse(raw);
}

function basicValidateStrain(s) {
  const errors = [];
  const must = ['id', 'name', 'genotype', 'nutrientDemand', 'waterDemand'];
  for (const k of must) {
    if (!(k in s)) errors.push(`Missing key: ${k}`);
  }

  if (!isUuid(s.id) || uuidVersion(s.id) !== 4) {
    errors.push('id must be UUIDv4');
  }

  if (s.photoperiod) {
    if (typeof s.photoperiod.vegetationDays !== 'number' || typeof s.photoperiod.floweringDays !== 'number') {
      errors.push('photoperiod.vegetationDays/floweringDays must be numbers');
    }
  }

  return errors;
}

function normalizeStrain(s, slugHint) {
  const defaults = {
    photoperiodic: true,
    vegDays: s.photoperiod?.vegetationDays ?? 28,
    flowerDays: s.photoperiod?.floweringDays ?? 56,
    autoFlowerDays: null,
    light: {
      ppfdOpt_umol_m2s: 700,
      ppfdMax_umol_m2s: 1100,
      dliHalfSat_mol_m2d: 20,
      dliMax_mol_m2d: 40,
    },
    coeffs: {
      budGrowthBase_g_per_day: 1.5,
      tempOptC: 26,
      tempWidthC: 6,
      co2HalfSat_ppm: 900,
    },
    generalResilience: 0.5,
    diseaseResistance: {
      dailyInfectionIncrement: 0.02,
      infectionThreshold: 0.5,
      recoveryRate: 0.005,
      degenerationRate: 0.01,
      regenerationRate: 0.003,
      fatalityThreshold: 0.98,
    },
  };

  return {
    ...defaults,
    ...s,
    slug: s.slug ?? slugHint,
    light: { ...defaults.light, ...(s.light || {}) },
    coeffs: { ...defaults.coeffs, ...(s.coeffs || {}) },
    diseaseResistance: { ...defaults.diseaseResistance, ...(s.diseaseResistance || {}) },
  };
}

let cache = null;
let idMap = new Map();
let slugMap = new Map();

async function ensureCache() {
  if (cache) return cache;
  cache = [];
  idMap = new Map();
  slugMap = new Map();

  const files = await fs.readdir(STRAINS_DIR);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const fp = path.join(STRAINS_DIR, f);
    const raw = await readJson(fp);
    const errors = basicValidateStrain(raw);
    if (errors.length) continue;
    const fileSlug = path.basename(f, '.json');
    const norm = normalizeStrain(raw, fileSlug);
    cache.push(norm);
    idMap.set(norm.id, norm);
    slugMap.set(norm.slug, norm);
    // legacy filename mapping
    if (norm.slug !== fileSlug) slugMap.set(fileSlug, norm);
  }
  return cache;
}

/**
 * Load all strains available in the data directory.
 * @returns {Promise<Array<object>>}
 */
export async function loadAllStrains() {
  await ensureCache();
  return cache;
}

/**
 * Load a strain by its UUID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function loadStrainById(id) {
  await ensureCache();
  return idMap.get(id) || null;
}

/**
 * Load a strain by slug/alias.
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export async function loadStrainBySlug(slug) {
  await ensureCache();
  return slugMap.get(slug) || null;
}

