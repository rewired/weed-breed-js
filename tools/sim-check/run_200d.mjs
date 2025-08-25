import fs from 'fs';
import { appendFile } from 'node:fs/promises';
import { createActor } from 'xstate';
import { initializeSimulation } from '../../src/sim/simulation.js';
import { Plant } from '../../src/engine/Plant.js';
import { Zone } from '../../src/engine/Zone.js';
import { attach } from '../../src/instrumentation/attach.js';
import { emit, on } from '../../src/instrumentation/eventBus.js';
import { buildReports } from './reporters.mjs';

const SIM_DAYS = Number(process.env.SIM_DAYS || 200);
const AUTO_REPLANT = (process.env.AUTO_REPLANT ?? 'true') !== 'false';
const WB_SEED = process.env.WB_SEED || 'codex-checkup-001';
process.env.WB_SEED = WB_SEED;

attach({ Plant, Zone });

const { structure, costEngine, tickMachineLogic, tickLengthInHours, world } = await initializeSimulation('default');

const zones = structure.rooms.flatMap(r => r.zones);
const ticksPerDay = Math.round(24 / tickLengthInHours);
const totalTicks = SIM_DAYS * ticksPerDay;

fs.mkdirSync('reports', { recursive: true });
const logStream = fs.createWriteStream('reports/sim_200d_log.csv');
logStream.write('event,tick,day,plantId,zoneId,buds_g,reason,newPlantId,previousPlantId,from,to\n');

/** Pending replant requests executed after daily snapshots. */
const pendingReplants = [];

/**
 * Append an object as JSON to a line oriented file.
 * @param {string} file
 * @param {object} obj
 */
async function writeJsonl(file, obj) {
  await appendFile(file, JSON.stringify(obj) + '\n', 'utf8');
}

/**
 * Compute a per-zone end-of-day snapshot. Do not carry over accumulators across days.
 * @param {Zone} zone
 * @param {number} day
 */
function snapshotZone(zone, day) {
  const plants = (zone.activePlants ?? zone.plants ?? []).filter(p => !p.isDead);
  const totalBiomass_g = plants.reduce((a, p) => a + (p.state?.biomassFresh_g ?? 0), 0);
  const totalBuds_g = plants.reduce((a, p) => a + (p.state?.biomassPartition?.buds_g ?? 0), 0);

  const env = zone.env?.daily ?? {};
  const flowering = zone.env?.flowering ?? {};

  const row = {
    zoneId: zone.id,
    zoneName: zone.name,
    day,
    plantsTotal: plants.length,
    totalBiomass_g,
    totalBuds_g
  };

  if (typeof env.dli === 'number') row.avgDLI_mol_m2d = env.dli;
  if (typeof env.ppfd === 'number') row.avgPPFD_umol_m2s = env.ppfd;
  if (typeof flowering.meanTemp === 'number') row.meanTempFlower_C = flowering.meanTemp;
  if (typeof env.maxTemp === 'number') row.maxTemp_C = env.maxTemp;

  return row;
}

on('phase-change', e => {
  logStream.write([
    'phase-change',
    e.tick,
    e.day,
    e.plantId,
    e.zoneId || '',
    '',
    '',
    '',
    '',
    e.from,
    e.to
  ].join(',') + '\n');
});

on('harvest', e => {
  logStream.write([
    'harvest',
    e.tick,
    e.day,
    e.plantId,
    e.zoneId,
    e.buds_g || 0,
    '',
    '',
    '',
    '',
    ''
  ].join(',') + '\n');
});

on('death', e => {
  logStream.write([
    'death',
    e.tick,
    e.day,
    e.plantId,
    e.zoneId,
    '',
    e.reason || '',
    '',
    '',
    '',
    ''
  ].join(',') + '\n');
  if (AUTO_REPLANT) {
    pendingReplants.push({ zoneId: e.zoneId, plantId: e.plantId, strain: e.strain, method: e.method, tick: e.tick, day: e.day });
  }
});

on('replant', e => {
  logStream.write([
    'replant',
    e.tick,
    e.day,
    '',
    e.zoneId,
    '',
    '',
    e.newPlantId,
    e.previousPlantId || '',
    '',
    ''
  ].join(',') + '\n');
});

for (let tick = 1; tick <= totalTicks; tick++) {
  const absoluteTick = (costEngine._tickCounter || 0) + 1;
  costEngine.startTick(absoluteTick);
  for (const zone of zones) {
    const actor = createActor(tickMachineLogic, {
      input: { zone, tick: absoluteTick, tickLengthInHours: zone.tickLengthInHours, logger: console }
    });
    await new Promise(resolve => {
      actor.subscribe(state => { if (state.status === 'done') resolve(); });
      actor.start();
    });
  }
  costEngine.commitTick();
  if (tick % ticksPerDay === 0) {
    const day = tick / ticksPerDay;
    for (const zone of zones) {
      const row = snapshotZone(zone, day);
      await writeJsonl('reports/sim_200d_daily.jsonl', row);
    }
    if (AUTO_REPLANT && pendingReplants.length) {
      for (const r of pendingReplants.splice(0)) {
        const zone = zones.find(z => z.id === r.zoneId);
        if (zone) {
          const newPlant = new Plant({ strain: r.strain, method: r.method, rng: zone.rng });
          zone.addPlant(newPlant);
          emit('replant', { zoneId: zone.id, newPlantId: newPlant.id, previousPlantId: r.plantId, tick: (costEngine._tickCounter || 0), day: day + 1 });
        }
      }
    }
  }
}

logStream.end();

await buildReports();
console.log('Simulation complete. Summary saved to reports/.');

