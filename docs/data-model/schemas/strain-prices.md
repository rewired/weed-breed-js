# Strain Prices Schema

Maps strain IDs to economic values used at runtime.

- JSON Schema: [`packages/wb-model/schemas/strainPrices.schema.json`](../../../packages/wb-model/schemas/strainPrices.schema.json)
- Loader: [`src/engine/loaders/priceLoader.js`](../../../src/engine/loaders/priceLoader.js)

## Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `strainId` | string | ID of the strain |
| `seedPrice` | number | Purchase price per seed (EUR) |
| `harvestPricePerGram` | number | Base sale price per gram (EUR) |

## Example

```json
{
  "strainId": "ak-47",
  "seedPrice": 5.0,
  "harvestPricePerGram": 3.2
}
```
// data/config/strainPrices.json
[data/config/strainPrices.json](../../../data/config/strainPrices.json)
