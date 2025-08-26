import path from 'node:path';
import { SimZone } from '../engine/Zone.js';
import { SimPlant } from '../engine/Plant.js';
import { DailyWriter } from '../lib/reporting/dailyWriter.mjs';

const days = Number(process.env.SIM_DAYS ?? 120);

const zone = new SimZone({ id: 'zone1' });
for (let i = 0; i < 5; i++) {
  zone.addPlant(new SimPlant({ strainName: 'DemoStrain' }));
}

const writer = new DailyWriter(path.resolve('reports', 'sim_daily.jsonl'));
zone.run({ days, writer });
