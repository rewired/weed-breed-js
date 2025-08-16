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
| `simulation`| `object`| Configuration for the plants to be grown in this zone, including `strainId` and `methodId`.          | No       |                    |

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
    "strainId": "550e8400-e29b-41d4-a716-446655440000",
    "methodId": "sog"
  },
  "devices": [
    { "blueprintId": "3b5f6ad7-672e-47cd-9a24-f0cc45c4101e", "count": 8 },
    { "blueprintId": "7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b", "count": 2 }
  ]
}
```

---
*Back to: [`Architectural Guide`](../architectural_guide.md)*
