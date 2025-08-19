/**
 * Simulation entry point for running the game logic standalone.
 * @module index
 */
import { logger } from './lib/logger.js';
import { emit } from './sim/eventBus.js';
import { createActor } from 'xstate';
import { initializeSimulation } from './sim/simulation.js';
import { resolveTickHours } from './lib/time.js';
import { createRng } from './lib/rng.js';
import { SIM_DAYS_DEFAULT } from './config/env.js';

// --- Main -------------------------------------------------------------------
/**
 * Run the simulation for a predefined duration.
 */
async function main() {
  const rng = createRng();
  logger.debug({ sample: rng.float() }, 'Initialized RNG');
  const { zones, costEngine, tickMachineLogic } = await initializeSimulation('default');

  // Simulation duration derived from tick length
  const tickLengthInHours = resolveTickHours(zones[0]);
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
}

try {
  await main();
} catch (err) {
  logger.error({ err }, 'Fatal in src/index.js');
  throw err;
}
