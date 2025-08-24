# Device Schema

Blueprints describe devices that modify zone environment.
Pricing and maintenance costs are stored separately in [`data/devicePrices.json`](../../../data/devicePrices.json).

- JSON Schema: [`packages/wb-model/schemas/device.schema.json`](../../../packages/wb-model/schemas/device.schema.json)
- Loader: [`src/engine/loaders/deviceLoader.js`](../../../src/engine/loaders/deviceLoader.js)

## Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID of the device |
| `kind` | string | Device type (e.g., `ClimateUnit`, `Lamp`) |
| `name` | string | Display name |
| `quality` | number | Quality factor 0–1 |
| `complexity` | number | Setup/maintenance complexity |
| `lifespanInHours` | integer | Expected mean time between failures |
| `settings` | object | Device-specific parameters |

## Example

```json
{
  "id": "7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b",
  "kind": "ClimateUnit",
  "name": "CoolAir Split 3000",
  "quality": 0.9,
  "complexity": 0.4,
  "lifespanInHours": 35040,
  "settings": { "power": 1.2, "airflow": 350 }
}
```
// data/devices/climate_unit_01.json
[data/devices/climate_unit_01.json](../../../data/devices/climate_unit_01.json)
