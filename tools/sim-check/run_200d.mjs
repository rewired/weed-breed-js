import fs from 'fs';
import { createActor } from 'xstate';
import { initializeSimulation } from '../../src/sim/simulation.js';
import { Plant } from '../../src/engine/Plant.js';
import { Zone } from '../../src/engine/Zone.js';
import { attach } from '../../src/instrumentation/attach.js';
import { bus, emit, on } from '../../src/instrumentation/eventBus.js';
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
const dailyStream = fs.createWriteStream('reports/sim_200d_daily.jsonl');

const events = [];
const dailyEvents = [];

on('phase-change', e => {
  events.push({ type: 'phase-change', ...e });
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
  events.push({ type: 'harvest', ...e });
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
  events.push({ type: 'death', ...e });
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
    const zone = zones.find(z => z.id === e.zoneId);
    if (zone) {
      const newPlant = new Plant({ strain: e.strain, method: e.method, rng: zone.rng });
      zone.addPlant(newPlant);
      emit('replant', { zoneId: zone.id, newPlantId: newPlant.id, previousPlantId: e.plantId, tick: e.tick, day: e.day });
    }
  }
});

on('replant', e => {
  events.push({ type: 'replant', ...e });
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

on('zone-daily', e => {
  dailyEvents.push(e);
  events.push({ type: 'zone-daily', ...e });
  dailyStream.write(JSON.stringify(e) + '\n');
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
}

logStream.end();
dailyStream.end();

const summary = buildReports({ zones, world, events, dailyEvents });
console.log('Simulation complete. Summary saved to reports/.');

