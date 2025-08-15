// src/engine/loaders/strainLoader.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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

  const must = ['id', 'name', 'genotype', 'photoperiod', 'nutrientDemand', 'waterDemand'];
  for (const k of must) {
    if (!(k in s)) errors.push(`Missing key: ${k}`);
  }

  // very light checks - deliberately without AJV/Zod
  if (s.photoperiod && (typeof s.photoperiod.vegetationDays !== 'number' || typeof s.photoperiod.floweringDays !== 'number')) {
    errors.push('photoperiod.vegetationDays/floweringDays must be numbers');
  }

  return errors;
}

function normalizeStrain(s) {
  // Optional normalization: set sensible defaults without bending the input
  return {
    ...s,
    generalResilience: s.generalResilience ?? 0.5,
    diseaseResistance: s.diseaseResistance ?? {
      dailyInfectionIncrement: 0.02,
      infectionThreshold: 0.5,
      recoveryRate: 0.005,
      degenerationRate: 0.01,
      regenerationRate: 0.003,
      fatalityThreshold: 0.98
    },
  };
}

export async function loadStrainBySlug(slug) {
  const fp = path.join(STRAINS_DIR, `${slug}.json`);
  const strain = await readJson(fp);
  const errors = basicValidateStrain(strain);
  if (errors.length) {
    throw new Error(`Strain "${slug}" validation failed:\n- ${errors.join('\n- ')}`);
  }
  return normalizeStrain(strain);
}

export async function loadStrainById(id) {
  const files = await fs.readdir(STRAINS_DIR);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const s = await readJson(path.join(STRAINS_DIR, f));
    if (s.id === id) {
      const errors = basicValidateStrain(s);
      if (errors.length) throw new Error(`Strain "${f}" validation failed:\n- ${errors.join('\n- ')}`);
      return normalizeStrain(s);
    }
  }
  throw new Error(`Strain with id "${id}" not found in ${STRAINS_DIR}`);
}

export async function loadAllStrains() {
  const files = await fs.readdir(STRAINS_DIR);
  const strains = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const s = await readJson(path.join(STRAINS_DIR, f));
    const errors = basicValidateStrain(s);
    if (!errors.length) strains.push(normalizeStrain(s));
  }
  return strains;
}
