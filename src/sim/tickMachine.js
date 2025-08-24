/**
 * XState based tick orchestration logic.
 * @module sim/tickMachine
 */

import { createMachine, assign, setup, fromPromise } from 'xstate';
import { emit } from './eventBus.js';
import { resolveTickHours } from '../lib/time.js';

/**
 * Create the tick state machine logic.
 * @returns {import('xstate').StateMachine<any, any, any>}
 */
export function createTickMachine() {
  return setup({
    actors: {
      updatePlantsActor: fromPromise(async ({ input }) => {
        const { zone, tickLengthInHours, tick } = input;
        if (!zone) {
            // Wenn keine Zone vorhanden ist, können wir nichts tun.
            return;
        }
        await zone.updatePlants(tickLengthInHours, tick);
      })
    },
    actions: {
      onApplyDevices: ({ context }) => {
        if (!context.zone) {
          context.logger?.warn?.('⚠️ Zone missing in onApplyDevices');
          return;
        }
        context.zone.applyDevices?.(context.tick);
      },
      onDeriveEnvironment: ({ context }) => {
        if (!context.zone) {
          context.logger?.warn?.('⚠️ Zone missing in onDeriveEnvironment');
          return;
        }
        // Update environmental values for the zone
        context.zone.deriveEnvironment?.();

        // Telemetry snapshot after deriving environment
        try {
          const status = context.zone.status ?? {};
          const tempC = status.temperatureC;
          const { humidity, co2ppm } = status;
          let netEUR = 0;

          const ce = context.zone.costEngine;
          if (ce) {
            if (typeof ce.getTotals === 'function') {
              netEUR = ce.getTotals().netEUR ?? 0;
            } else if (ce.ledger) {
              netEUR = ce.ledger.netEUR ?? 0;
            }
          }

          emit(
            'zone.telemetry',
            { zoneId: context.zone.id, tempC, humidity, co2ppm, netEUR },
            context.tick
          );
        } catch (err) {
          context.logger?.error?.({ err }, 'Failed to emit zone.telemetry');
        }
      },
      onIrrigationAndNutrients: ({ context }) => {
        if (!context.zone) {
          context.logger?.warn?.('⚠️ Zone missing in onIrrigationAndNutrients');
          return;
        }
        context.zone.irrigateAndFeed?.();
      },
      onHarvestAndInventory: ({ context }) => {
        if (!context.zone) {
          context.logger?.warn?.('⚠️ Zone missing in onHarvestAndInventory');
          return;
        }
        context.zone.harvestAndInventory?.(context.tick);
      },
      onAccounting: ({ context }) => {
        if (!context.zone) {
          context.logger?.warn?.('⚠️ Zone missing in onAccounting');
          return;
        }
        context.zone.accounting?.(context.tick);
      },
      commitAndIncrementTick: assign({
        tick: ({ context }) => {
            if (context.zone?.id) {
                const eventPayload = {
                  structureId: context.zone.structureId,
                  roomId: context.zone.roomId,
                  zoneId: context.zone.id,
                };
                emit('sim.tickCompleted', eventPayload, context.tick);
              } else {
                emit('sim.tickCompleted', { zoneId: null }, context.tick, 'warn');
              }
              const ticksPerDay = Math.round(24 / context.tickLengthInHours);
              if (context.tick % ticksPerDay === 0) {
                let netEUR = 0;
                const ce = context.zone?.costEngine;
                if (ce) {
                  if (typeof ce.getTotals === 'function') {
                    netEUR = ce.getTotals().netEUR ?? 0;
                  } else if (ce.ledger) {
                    netEUR = ce.ledger.netEUR ?? 0;
                  }
                }
                const plantCount = context.zone?.plants?.length ?? 0;
                context.logger?.info?.({
                  tick: context.tick,
                  zoneId: context.zone?.id,
                  netEUR,
                  plantCount
                }, 'tick completed');
                context.zone?.debugDailyLog?.(context.tick / ticksPerDay);
              }
              return context.tick + 1;
        }
      })
    }
  }).createMachine(
    {
      id: 'tick',
      initial: 'applyDevices',
      // The context is now filled by 'input' when creating the actor.
      // We only define the structure and default values here.
      context: ({ input }) => ({
        zone: input.zone ?? null,
        tick: input.tick ?? 0,
        tickLengthInHours: resolveTickHours(input.zone || { tickLengthInHours: input.tickLengthInHours }),
        logger: input.logger ?? console,
      }),
      states: {
        applyDevices: {
          entry: 'onApplyDevices',
          always: 'deriveEnvironment'
        },
        deriveEnvironment: {
          entry: 'onDeriveEnvironment',
          always: 'updatePlants'
        },
        updatePlants: {
          invoke: {
            src: 'updatePlantsActor',
            input: ({ context }) => ({
              zone: context.zone,
              tickLengthInHours: context.tickLengthInHours,
              tick: context.tick
            }),
            onDone: {
              target: 'irrigationAndNutrients'
            },
            onError: {
              // TODO: Add proper error handling
              actions: ({ context, event }) => context.logger.error({ err: event.data }, 'Error in updatePlants actor'),
              target: 'irrigationAndNutrients'
            }
          }
        },
        irrigationAndNutrients: {
          entry: 'onIrrigationAndNutrients',
          always: 'harvestAndInventory'
        },
        harvestAndInventory: {
          entry: 'onHarvestAndInventory',
          always: 'accounting'
        },
        accounting: {
          entry: 'onAccounting',
          always: 'commit'
        },
        commit: {
          entry: 'commitAndIncrementTick',
          type: 'final'
        }
      }
    }
  );
}
