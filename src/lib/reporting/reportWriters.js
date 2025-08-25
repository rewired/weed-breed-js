import fs from 'node:fs';
import path from 'node:path';

export const RUN_ID = process.env.RUN_ID || new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0,15);
export const RUN_DIR = path.resolve('logs', 'reports', RUN_ID);
fs.mkdirSync(RUN_DIR, { recursive: true });

export function appendJSONL(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(obj) + '\n', 'utf-8');
}

export function writeDailySnapshot(day, zone, stats) {
  const simDays = Number(process.env.SIM_DAYS || stats.simDays || 0);
  const file = `sim_${simDays}d_daily.jsonl`;
  const dailyPath = path.join(RUN_DIR, file);
  const rec = {
    day,
    zoneId: zone.id,
    plantsTotal: zone.plants?.length,
    totalBiomass_g: stats.totalBiomass_g,
    totalBuds_g: stats.totalBuds_g,
    harvestedPlants: stats.harvestedPlants,
    budsCollectedToday_g: stats.budsCollectedToday_g,
    totalBudsCollected_g: stats.totalBudsCollected_g
  };
  appendJSONL(dailyPath, rec);
}

export function writeHarvestEvent(evt) {
  const eventsPath = path.join(RUN_DIR, 'events.jsonl');
  appendJSONL(eventsPath, evt);
}
