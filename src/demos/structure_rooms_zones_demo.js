// src/demos/structure_rooms_zones_demo.js
import 'dotenv/config';
import { createActor } from 'xstate';
import { initializeSimulation } from '../sim/simulation.js';

// --- CLI flag parser ------------------------------------------------------
const args = process.argv.slice(2);
for (const arg of args) {
  if (!arg.startsWith('--')) continue;
  const [k, v] = arg.slice(2).split('=');
  if (!k) continue;
  switch (k) {
    case 'env':
      if (v) process.env.NODE_ENV = v;
      break;
    case 'logLevel':
      if (v) process.env.LOG_LEVEL = v;
      break;
    case 'simDays':
      if (v) process.env.SIM_DAYS = String(Number(v));
      break;
    case 'ticksPerDay':
      if (v) process.env.TICKS_PER_DAY = String(Number(v));
      break;
    case 'runId':
      if (v) process.env.RUN_ID = v;
      break;
  }
}

// --- Simulation parameters -----------------------------------------------
const SIM_DAYS = Number(process.env.SIM_DAYS || 200);
const TICKS_PER_DAY = Number(process.env.TICKS_PER_DAY || 24);
const tickLengthInHours = 24 / TICKS_PER_DAY;

const { structure, costEngine, tickMachineLogic } = await initializeSimulation('default');
const zones = structure.rooms.flatMap(r => r.zones);
for (const z of zones) z.tickLengthInHours = tickLengthInHours;
const totalTicks = SIM_DAYS * TICKS_PER_DAY;

const { writeDailySnapshot } = await import('../lib/reporting/reportWriters.js');

for (let tick = 0; tick < totalTicks; tick++) {
  const absoluteTick = tick + 1;
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

  if (tick % TICKS_PER_DAY === TICKS_PER_DAY - 1) {
    const day = (tick + 1) / TICKS_PER_DAY;
    for (const zone of zones) {
      writeDailySnapshot(day, zone, {
        totalBiomass_g: zone.metrics.totalBiomass_g,
        totalBuds_g: zone.metrics.totalBuds_g,
        harvestedPlants: zone.stats.harvestedPlants,
        budsCollectedToday_g: zone.stats.budsCollectedToday_g,
        totalBudsCollected_g: zone.stats.totalBudsCollected_g
      });
    }
  }
}
