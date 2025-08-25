// src/lib/reporting/reportWriters.js
// ESM helpers to write JSONL reports under logs/reports/<RUN_ID>
import fs from 'node:fs';
import path from 'node:path';

// Resolve run information once
export const RUN_ID = process.env.RUN_ID || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6}).*/, '$1_$2');
export const RUN_DIR = path.resolve('logs', 'reports', RUN_ID);
export const SIM_DAYS = Number(process.env.SIM_DAYS || 0);

fs.mkdirSync(RUN_DIR, { recursive: true });

/** Append one JSON object per line to a file (create directory if needed). */
export function appendJSONL(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const line = JSON.stringify(obj) + '\n';
  fs.appendFileSync(filePath, line, 'utf-8');
}

/**
 * Write end-of-day snapshot for a zone.
 * @param {number} day 1-based day number
 * @param {object} zone Minimal projection: { id, plants: [...] }
 * @param {object} stats { totalBiomass_g, totalBuds_g, harvestedPlants?, budsCollectedToday_g?, totalBudsCollected_g? }
 */
export function writeDailySnapshot(day, zone, stats) {
  const fname = SIM_DAYS > 0 ? `sim_${SIM_DAYS}d_daily.jsonl` : `sim_daily.jsonl`;
  const dailyPath = path.join(RUN_DIR, fname);
  const rec = {
    day,
    zoneId: zone.id,
    plantsTotal: Array.isArray(zone.plants) ? zone.plants.length : undefined,
    totalBiomass_g: stats.totalBiomass_g,
    totalBuds_g: stats.totalBuds_g,
    harvestedPlants: stats.harvestedPlants,
    budsCollectedToday_g: stats.budsCollectedToday_g,
    totalBudsCollected_g: stats.totalBudsCollected_g
  };
  appendJSONL(dailyPath, rec);
}

/** Append a harvest event record */
export function writeHarvestEvent(evt) {
  const eventsPath = path.join(RUN_DIR, 'events.jsonl');
  appendJSONL(eventsPath, evt);
}
