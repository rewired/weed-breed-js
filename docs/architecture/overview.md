# Architecture Overview

The Weed Breed simulation is built around a deterministic tick loop with modular entities configured via JSON blueprints.

## Core Principles

- Tick-based simulation, no real-time progression
- Loose coupling via an event bus for telemetry
- Base classes with factories loading JSON data
- Costs modeled as CapEx and OpEx

## World Hierarchy

The facility is organized as **Structure → Room → Zone → Plant → Device**. Each level aggregates costs and state upward.

## Event Bus

```js
import { Subject } from 'rxjs';

export const events$ = new Subject();
export function emit(type, payload = {}, tick = 0, level = 'info') {
  events$.next({ type, payload, tick, level, ts: Date.now() });
}
```
// src/sim/eventBus.js
[src/sim/eventBus.js](../../src/sim/eventBus.js)

The bus publishes semantic events for the UI and logging.

## Tick Flow

```js
export function createTickMachine() {
  return setup({ /* actors & actions */ }).createMachine({
    id: 'tick',
    initial: 'applyDevices',
    states: { /* ... */ }
  });
}
```
// src/sim/tickMachine.js
[src/sim/tickMachine.js](../../src/sim/tickMachine.js)

The machine orchestrates per-tick phases such as applying devices, updating plants and accounting.

## Devices

The base device class merges blueprint settings with runtime overrides and tracks failures.

```js
export class BaseDevice {
  constructor(blueprint, runtime, overrides = {}) { /*...*/ }
}
```
// src/engine/BaseDevice.js
[src/engine/BaseDevice.js](../../src/engine/BaseDevice.js)

Device subclasses live under [`src/engine/devices`](../../src/engine/devices/).

## Further Reading

Detailed decision records are available in the [architecture/adr](adr/) directory.
Common naming and unit rules live in [data-model/naming.md](../data-model/naming.md) and [reference/tick-and-units.md](../reference/tick-and-units.md).
