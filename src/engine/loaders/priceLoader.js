/**
 * Loaders for device and strain price mappings.
 * @module engine/loaders/priceLoader
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Annahme: <root>/data/config/{devicePrices.json,strainPrices.json}
const CONFIG_DIR = path.resolve(__dirname, '../../../data/config');

async function readJson(fp) {
  const raw = await fs.readFile(fp, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Load price map for devices.
 * @returns {Promise<Map<string, any>>}
 */
export async function loadDevicePriceMap() {
  const fp = path.join(CONFIG_DIR, 'devicePrices.json');
  const json = await readJson(fp);
  // Struktur laut Datei: { devicePrices: { "<deviceId>": { capitalExpenditure, baseMaintenanceCostPerTick, costIncreasePer1000Ticks } } }
  // -> Map<string, {…}>
  return new Map(Object.entries(json.devicePrices || {}));
}

/**
 * Load price map for strains.
 * @returns {Promise<Map<string, any>>}
 */
export async function loadStrainPriceMap() {
  const fp = path.join(CONFIG_DIR, 'strainPrices.json');
  const json = await readJson(fp);
  // Struktur: { strainPrices: { "<strainId>": { seedPrice, harvestPricePerGram } } }
  return new Map(Object.entries(json.strainPrices || {}));
}
