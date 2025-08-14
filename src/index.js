// src/index.js
import { TICK_HOURS_DEFAULT } from './config/env.js';
import { logger } from './lib/logger.js';
import { emit } from './sim/eventBus.js';
import { createActor } from 'xstate';
import { initializeSimulation } from './sim/simulation.js';

// --- Main -------------------------------------------------------------------
async function main() {
  const { zones, costEngine, tickMachineLogic } = await initializeSimulation();

  // Simulation run for this zone
  const durationTicks = 840; // 105 days, static for now
  const ticksPerDay = Math.round(24 / (zones[0]?.tickLengthInHours ?? TICK_HOURS_DEFAULT));

  logger.info(`--- STARTING SIMULATION (1 tick = ${zones[0]?.tickLengthInHours}h, 1 day = ${ticksPerDay} ticks) ---`);

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
