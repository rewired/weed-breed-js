import 'dotenv/config';
import { Zone } from '../sim/Zone.js';
import { Plant } from '../sim/Plant.js';

// CLI flags override process.env
const args = process.argv.slice(2);
for (const arg of args) {
  if (!arg.startsWith('--')) continue;
  const [k, v] = arg.slice(2).split('=');
  if (!k) continue;
  switch (k) {
    case 'env': if (v) process.env.NODE_ENV = v; break;
    case 'logLevel': if (v) process.env.LOG_LEVEL = v; break;
    case 'simDays': if (v) process.env.SIM_DAYS = String(Number(v)); break;
    case 'ticksPerDay': if (v) process.env.TICKS_PER_DAY = String(Number(v)); break;
    case 'runId': if (v) process.env.RUN_ID = v; break;
  }
}

process.env.SIM_DAYS = String(Number(process.env.SIM_DAYS) || 200);
process.env.TICKS_PER_DAY = String(Number(process.env.TICKS_PER_DAY) || 24);
const SIM_DAYS = Number(process.env.SIM_DAYS);
const TICKS_PER_DAY = Number(process.env.TICKS_PER_DAY);
const totalTicks = SIM_DAYS * TICKS_PER_DAY;

const { writeDailySnapshot } = await import('../lib/reporting/reportWriters.js');

const zone = new Zone({ id: 'zone1' });
for (let i = 0; i < 5; i++) zone.addPlant(new Plant());

for (let tick = 0; tick < totalTicks; tick++) {
  const day = Math.floor(tick / TICKS_PER_DAY) + 1;
  zone.update({ tick, day, TICKS_PER_DAY });
  if (tick % TICKS_PER_DAY === TICKS_PER_DAY - 1) {
    zone.recomputeMetrics();
    writeDailySnapshot(day, zone, {
      totalBiomass_g: zone.metrics.totalBiomass_g,
      totalBuds_g: zone.metrics.totalBuds_g,
      harvestedPlants: zone.stats.harvestedPlants,
      budsCollectedToday_g: zone.stats.budsCollectedToday_g,
      totalBudsCollected_g: zone.stats.totalBudsCollected_g,
      simDays: SIM_DAYS
    });
  }
}
