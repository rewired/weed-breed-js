import { createMachine, assign, interpret } from 'xstate';

export const plantMachine = createMachine({
  id: 'plant',
  initial: 'seed',
  context: { ageHours: 0, biomass: 0, stress: 0 },
  states: {
    seed: {
      on: { GERMINATE: 'vegetative' }
    },
    vegetative: {
      on: { BLOOM_TRIGGER: 'flowering' }
    },
    flowering: {
      on: { HARVEST_READY: 'harvest' }
    },
    harvest: { type: 'final' }
  },
}, {
  actions: {
    // später: assign(...) bei jedem Tick
  }
});

export function spawnPlant() {
  const service = interpret(plantMachine);
  service.start();
  return service;
}
