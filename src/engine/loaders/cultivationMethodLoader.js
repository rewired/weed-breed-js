/**
 * Loader utilities for cultivation method definitions.
 * @module engine/loaders/cultivationMethodLoader
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Datenordner: <root>/data/cultivationMethods/*.json
const METHODS_DIR = path.resolve(__dirname, '../../../data/cultivationMethods');

async function readJson(fp) {
  const raw = await fs.readFile(fp, 'utf-8');
  return JSON.parse(raw);
}

function basicValidateMethod(m) {
  const errors = [];
  const must = ['id', 'name', 'areaPerPlant', 'minimumSpacing', 'substrate', 'containerSpec'];
  for (const k of must) if (!(k in m)) errors.push(`Missing key: ${k}`);

  if (m.areaPerPlant != null && typeof m.areaPerPlant !== 'number')
    errors.push('areaPerPlant must be number');
  if (m.minimumSpacing != null && typeof m.minimumSpacing !== 'number')
    errors.push('minimumSpacing must be number');

  if (m.substrate && typeof m.substrate !== 'object')
    errors.push('substrate must be object');
  if (m.containerSpec && typeof m.containerSpec !== 'object')
    errors.push('containerSpec must be object');

  return errors;
}

function normalizeMethod(m) {
  return {
    kind: 'CultivationMethod',
    setupCost: 0,
    laborIntensity: 0.3,
    maxCycles: 1,
    strainTraitCompatibility: { preferred: {}, conflicting: {} },
    idealConditions: {},
    meta: {},
    ...m
  };
}

/**
 * Load a cultivation method by slug.
 * @param {string} slug
 * @returns {Promise<object>}
 */
export async function loadCultivationMethod(slug) {
  const fp = path.join(METHODS_DIR, `${slug}.json`);
  const method = await readJson(fp);
  const errors = basicValidateMethod(method);
  if (errors.length) {
    throw new Error(`CultivationMethod "${slug}" validation failed:\n- ${errors.join('\n- ')}`);
  }
  return normalizeMethod(method);
}

/**
 * Load all cultivation methods.
 * @returns {Promise<Array<object>>}
 */
export async function loadAllCultivationMethods() {
  const files = await fs.readdir(METHODS_DIR);
  const methods = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const m = await readJson(path.join(METHODS_DIR, f));
    const errors = basicValidateMethod(m);
    if (!errors.length) methods.push(normalizeMethod(m));
  }
  return methods;
}
