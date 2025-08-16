// src/demos/structure_rooms_zones_demo.js
import { logger } from '../lib/logger.js';
import { createActor } from 'xstate';
import { initializeSimulation } from '../sim/simulation.js';
import { resolveTickHours } from '../lib/time.js';
import { inspect } from 'util'; // For deep logging

// A helper to log deep objects
const logDeep = (obj) => {
  console.log(inspect(obj, { depth: null, colors: true }));
};

// --- Main -------------------------------------------------------------------
async function main() {
  // Initialize the simulation with the new hierarchical structure
  const { structure, costEngine, tickMachineLogic } = await initializeSimulation();

  const durationTicks = 10;
  const tickLengthInHours = resolveTickHours(structure.rooms[0]?.zones[0]);
  const ticksPerDay = Math.round(24 / tickLengthInHours);

  logger.info(`--- STARTING HIERARCHICAL SIMULATION (1 tick = ${tickLengthInHours}h, 1 day = ${ticksPerDay} ticks) ---`);
  logDeep({
    structure: { id: structure.id, name: structure.name },
    rooms: structure.rooms.map(r => ({ id: r.id, name: r.name, zones: r.zones.map(z => ({ id: z.id, name: z.name })) }))
  });

  for (let i = 1; i <= durationTicks; i++) {
    const absoluteTick = (costEngine._tickCounter || 0) + 1;
    costEngine.startTick(absoluteTick);

    logger.info(`\n\n--- Starting Tick #${absoluteTick} ---`);

    // Iterate through the hierarchy to run the simulation for each zone
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        // The logger passed here is already contextualized
        const tickActor = createActor(tickMachineLogic, {
          input: {
            zone,
            tick: absoluteTick,
            tickLengthInHours: zone.tickLengthInHours,
            logger: zone.logger,
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
    }

    // After all zones are ticked, get the aggregated costs
    const costReport = structure.getTickCosts(absoluteTick);
    logger.info({ tick: absoluteTick }, '--- Tick Cost Aggregation Report ---');
    logDeep(costReport);

    // The global cost engine commit is still useful for grand totals
    const tickTotals = costEngine.commitTick();
    logger.info({ tick: absoluteTick, netEUR: tickTotals.netEUR, closingBalance: tickTotals.closingBalanceEUR }, 'Global CostEngine committed.');
  }

  logger.info('\n\n--- SIMULATION COMPLETE ---');
  logDeep(costEngine.getGrandTotals());
}

try {
  await main();
} catch (err) {
  logger.error({ err }, 'Fatal in structure_rooms_zones_demo.js');
  // Use console.error for better stack trace visibility in some environments
  console.error(err);
  throw err;
}
