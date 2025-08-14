# Schema: Zone

The `zone` object is the primary logical and physical unit where plants are grown and devices operate. A `Zone` must be contained within a [`Room`](./room_schema.md).

## Fields in Configuration (`savegame.json`)

These are the fields defined in the JSON configuration.

| Key        | Type     | Description                                                                                             | Required | Default            |
|------------|----------|---------------------------------------------------------------------------------------------------------|----------|--------------------|
| `id`       | `string` | A unique identifier for the zone.                                                                       | Yes      |                    |
| `name`     | `string` | A human-readable name for the zone.                                                                     | Yes      |                    |
| `area`     | `number` | The floor area of the zone in square meters (m²).                                                       | Yes      |                    |
| `height`   | `number` | The ceiling height in meters (m). If not provided, it is inherited from the parent `Room`.                | No       | Inherited          |
| `devices`  | `Array`  | An array of device configurations to be created within this zone.                                       | No       | `[]` (empty array) |
| `simulation`| `object`| Configuration for the plants to be grown in this zone, including `strainSlug` and `methodId`.          | No       |                    |

## Runtime-Injected Fields

These fields are added to the `Zone` instance at runtime by the simulation engine. They are not part of the configuration file.

| Key           | Type     | Description                                         |
|---------------|----------|-----------------------------------------------------|
| `structureId` | `string` | The ID of the parent `Structure`.                   |
| `roomId`      | `string` | The ID of the parent `Room`.                        |

## Example `zone` object in `savegame.json`

```json
{
  "id": "zone_a1_ak47",
  "name": "Zone A1 (AK-47)",
  "area": 20,
  "height": 2.8,
  "simulation": {
    "strainSlug": "ak-47",
    "methodId": "sog"
  },
  "devices": [
    { "kind": "Lamp", "count": 8 },
    { "kind": "ClimateUnit", "count": 2 }
  ]
}
```

---
*Back to: [`Architectural Guide`](../architectural_guide.md)*
