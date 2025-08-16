// src/sim/tickMachine.js
// XState-basierte Tick-Orchestrierung gemäß ADR (§7), aktualisiert für XState v5

import { createMachine, assign, setup, fromPromise } from 'xstate';
import { emit } from './eventBus.js';
import { resolveTickHours } from '../lib/time.js';

/**
 * Creates the tick state machine logic.
 * This function defines the machine, which is then brought to life with createActor and input.
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
        context.zone.deriveEnvironment?.();
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
              context.logger?.info?.({ tick: context.tick, zoneId: context.zone.id }, 'tick completed');
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
