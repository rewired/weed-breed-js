# Room Blueprint

Defines a room inside a structure containing zones.

*No JSON schema available yet.*

Implementation: [`src/engine/Room.js`](../../../src/engine/Room.js)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Room identifier |
| `area` | number | Floor area in m² |
| `height` | number | Ceiling height in m |
| `baseCost` | number | Maintenance per tick |
| `structureId` | string | Parent structure |
