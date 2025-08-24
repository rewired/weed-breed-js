/**
 * Simulation entry point for running the game logic standalone.
 * @module index
 */
import { logger } from './lib/logger.js';
import { emit } from './sim/eventBus.js';
import { createActor } from 'xstate';
import { initializeSimulation } from './sim/simulation.js';
import { createRng } from './lib/rng.js';
import { SIM_DAYS_DEFAULT } from './config/env.js';

// --- Main -------------------------------------------------------------------
/**
 * Run the simulation for a predefined duration.
 */
async function main() {
  const rng = createRng();
  logger.debug({ sample: rng.float() }, 'Initialized RNG');
  const { structure, costEngine, tickMachineLogic, tickLengthInHours, world } = await initializeSimulation('default');
  const zones = structure.rooms.flatMap(r => r.zones);

  const inconsistentZones = zones.filter(z => z.tickLengthInHours !== tickLengthInHours);
  if (inconsistentZones.length) {
    logger.warn({ zoneIds: inconsistentZones.map(z => z.id) }, 'Zones with differing tick lengths detected');
  }

  // Simulation duration derived from tick length
  const ticksPerDay = Math.round(24 / tickLengthInHours);
  const envSimDays = Number(process.env.SIM_DAYS);
  const simDays = Number.isNaN(envSimDays) ? SIM_DAYS_DEFAULT : envSimDays;
  const durationTicks = simDays === -1 ? Infinity : simDays * ticksPerDay;

  logger.info(`--- STARTING SIMULATION (1 tick = ${tickLengthInHours}h, 1 day = ${ticksPerDay} ticks) ---`);

  for (let i = 1; i <= durationTicks; i++) {
    const absoluteTick = (costEngine._tickCounter || 0) + 1;
    costEngine.startTick(absoluteTick);

    for (const zone of zones) {
      const tickActor = createActor(tickMachineLogic, {
        input: {
          zone,
          tick: absoluteTick,
          tickLengthInHours: zone.tickLengthInHours,
          logger,
        },
      });

      await new Promise((resolve) => {
        tickActor.subscribe((snapshot) => {
          if (snapshot.status === 'done') {
            resolve(snapshot);
          }
        });
        tickActor.start();
      });
    }

    const tickTotals = costEngine.commitTick();
    emit('sim.tick', { tick: absoluteTick, ...tickTotals }, i, 'info');
  }

  // --- Final reports ---
  const zoneTable = zones.map(z => ({
    zoneId: z.id,
    startDayFlower: z.startDayFlower,
    harvestEvents: z.harvestEvents,
    firstHarvestDay: z.firstHarvestDay,
    lastHarvestDay: z.lastHarvestDay,
    totalBuds_g: z.totalBuds_g,
    harvestedPlants: z.harvestedPlants,
  }));
  console.log('\nZONE REPORT');
  console.table(zoneTable);

  const strainTable = Array.from(world.strainStats.entries()).map(([id, s]) => ({
    strainName: `${s.name}(${id})`,
    plantsTotal: s.plantsTotal,
    harvestedPlants: s.harvestedPlants,
    totalBuds_g: s.totalBuds_g,
    avgYieldPerPlant_g: s.harvestedPlants ? s.totalBuds_g / s.harvestedPlants : 0,
    avgFlowerDuration_days: s.harvestedPlants ? s.totalFlowerDurationDays / s.harvestedPlants : 0,
  }));
  console.log('\nSTRAIN SUMMARY');
  console.table(strainTable);
}

try {
  await main();
} catch (err) {
  logger.error({ err }, 'Fatal in src/index.js');
  throw err;
}
