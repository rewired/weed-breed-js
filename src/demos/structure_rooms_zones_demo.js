// src/demos/structure_rooms_zones_demo.js
import { createActor } from 'xstate';
import { initializeSimulation } from '../sim/simulation.js';
import { writeDailySnapshot } from '../server/reporting/reportWriters.js';

const SIM_DAYS = Number(process.env.SIM_DAYS || 200);

const { structure, costEngine, tickMachineLogic, tickLengthInHours } = await initializeSimulation('default');
const zones = structure.rooms.flatMap(r => r.zones);
const ticksPerDay = Math.round(24 / tickLengthInHours);
const totalTicks = SIM_DAYS * ticksPerDay;

for (let tick = 0; tick < totalTicks; tick++) {
  const absoluteTick = tick + 1;
  costEngine.startTick(absoluteTick);
  for (const zone of zones) {
    const actor = createActor(tickMachineLogic, {
      input: { zone, tick: absoluteTick, tickLengthInHours, logger: console }
    });
    await new Promise(resolve => {
      actor.subscribe(state => { if (state.status === 'done') resolve(); });
      actor.start();
    });
  }
  costEngine.commitTick();

  if (tick % ticksPerDay === ticksPerDay - 1) {
    const day = (tick + 1) / ticksPerDay;
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
