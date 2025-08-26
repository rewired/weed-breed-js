import path from 'node:path';
import fs from 'node:fs';
import { loadFromSavegame } from '../engine/loaders/savegameLoader.mjs';
import { DailyWriter } from '../lib/reporting/dailyWriter.mjs';

const argv = process.argv.slice(2);
let days = Number(process.env.SIM_DAYS ?? 120);
let seed = 'demo';
let save = process.env.SAVEGAME_PATH;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--days' && i + 1 < argv.length) {
    days = Number(argv[++i]);
  } else if (a === '--seed' && i + 1 < argv.length) {
    seed = argv[++i];
  } else if (a === '--save' && i + 1 < argv.length) {
    save = argv[++i];
  }
}
if (!save) save = 'data/savegames/default.json';
process.env.SAVEGAME_PATH = save;

const logger = { child: () => logger, info: () => {}, warn: () => {}, error: () => {} };
const runtime = { seed, logger };
const { zones } = await loadFromSavegame({ path: save, runtime });

const reportPath = path.resolve('reports', 'sim_default_daily.jsonl');
try { await fs.promises.unlink(reportPath); } catch { /* ignore */ }
const writer = new DailyWriter(reportPath);

for (const zone of zones) {
  zone.run({ days, writer });
}
