# Strain Schema

Defines genetics and growth properties for plants.

- JSON Schema: [`packages/wb-model/schemas/strain.schema.json`](../../../packages/wb-model/schemas/strain.schema.json)
- Loader: [`src/engine/loaders/strainLoader.js`](../../../src/engine/loaders/strainLoader.js)

## Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Strain name |
| `genotype` | object | Sativa/indica/ruderalis fractions |
| `morphology` | object | Growth traits and `leafAreaIndex` |
| `environmentalPreferences` | object | Light, temperature, humidity ranges |
| `dailyNutrientDemand` | object | NPK requirements per phase |

## Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "AK-47",
  "genotype": { "sativa": 0.35, "indica": 0.65, "ruderalis": 0 },
  "morphology": { "leafAreaIndex": 2.2 },
  "vegetationDays": 28,
  "floweringDays": 63
}
```
// data/strains/ak-47.json
[data/strains/ak-47.json](../../../data/strains/ak-47.json)
