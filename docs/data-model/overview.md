# Data Model Overview

The simulation organizes cultivation data in a hierarchy: **Structure → Room → Zone → Plant → Device**.

See [naming rules](naming.md), [bootstrapping examples](bootstrapping.md) and [tick/unit conventions](../reference/tick-and-units.md) for shared terminology.

## Structure

Top-level facility container defining available area and rent.

```js
export class Structure {
  constructor({ id, name, usableArea, height, baseRent, runtime }) { /*...*/ }
}
```
// src/engine/Structure.js
[src/engine/Structure.js](../../src/engine/Structure.js)

| Field | Description |
| ----- | ----------- |
| `id` | Unique identifier |
| `usableArea` | Total area in m² |
| `height` | Default height in meters |
| `baseRent` | Rent per tick |

## Room

Physical room inside a structure.

```js
export class Room {
  constructor({ id, name, area, height, baseCost, structureId, runtime }) { /*...*/ }
}
```
// src/engine/Room.js
[src/engine/Room.js](../../src/engine/Room.js)

| Field | Description |
| ----- | ----------- |
| `area` | Room area in m² |
| `height` | Height, inherits from structure if null |
| `baseCost` | Maintenance per tick |
| `structureId` | Parent structure |

## Zone

Operational unit hosting plants and devices and updating environment each tick.

```js
export class Zone {
  constructor({ id, name, area, height, roomId, runtime }) { /*...*/ }
}
```
// src/engine/Zone.js
[src/engine/Zone.js](../../src/engine/Zone.js)

| Field | Description |
| ----- | ----------- |
| `area` | Zone area in m² |
| `roomId` | Parent room |
| `status` | Environment state (temperature, humidity, CO₂) |

## Plant

Represents a single plant with lifecycle and biomass state.

```js
export class Plant {
  constructor({ id, label, zoneId, area_m2, leafAreaIndex, stage, ageHours, health }) { /*...*/ }
}
```
// src/engine/Plant.js
[src/engine/Plant.js](../../src/engine/Plant.js)

| Field | Description |
| ----- | ----------- |
| `zoneId` | Zone reference |
| `stage` | Lifecycle stage |
| `ageHours` | Age in hours |
| `health` | 0..1 health state |

## Device

Devices modify zone environment and cost.

```js
export class BaseDevice {
  constructor(blueprint, runtime, overrides = {}) { /*...*/ }
}
```
// src/engine/BaseDevice.js
[src/engine/BaseDevice.js](../../src/engine/BaseDevice.js)

| Field | Description |
| ----- | ----------- |
| `kind` | Device type |
| `settings` | Blueprint settings with overrides |
| `status` | `ok` or `broken` |

Device implementations live in [`src/engine/devices`](../../src/engine/devices/).

## Tick Updates

Each tick the simulation:

1. Applies device effects to zones.
2. Derives environment state for each zone.
3. Updates plants (growth, stress, stages).
4. Accounts for costs via the cost engine.

Tick orchestration is handled by the [tick machine](../architecture/overview.md#tick-flow).
