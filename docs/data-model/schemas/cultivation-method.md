# Cultivation Method Schema

Defines layout constraints and labor for planting strategies.

- JSON Schema: [`packages/wb-model/schemas/cultivation_method.schema.json`](../../../packages/wb-model/schemas/cultivation_method.schema.json)
- Loader: [`src/engine/loaders/cultivationMethodLoader.js`](../../../src/engine/loaders/cultivationMethodLoader.js)

## Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Method name |
| `areaPerPlant` | number | Required area per plant (m²) |
| `containerSpec` | object | Container type and volume |
| `substrate` | object | Substrate type and max cycles |

## Example

```json
{
  "id": "scrog",
  "name": "SCROG",
  "areaPerPlant": 0.5,
  "containerSpec": { "type": "pot", "volumeInLiters": 11 },
  "substrate": { "type": "soil", "maxCycles": 2 }
}
```
// data/cultivationMethods/scrog.json
[data/cultivationMethods/scrog.json](../../../data/cultivationMethods/scrog.json)
