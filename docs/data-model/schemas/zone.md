# Zone Blueprint

Operational unit where devices and plants live.

*No JSON schema available yet.*

Implementation: [`src/engine/Zone.js`](../../../src/engine/Zone.js)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Zone identifier |
| `area` | number | Area in m² |
| `roomId` | string | Parent room |
| `status` | object | Environment state |
