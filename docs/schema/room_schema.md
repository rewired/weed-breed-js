# Schema: Room

The `room` object represents a physical room inside a [`Structure`](./structure_schema.md). It contains one or more [`Zone`](./zone_schema.md) objects.

## Fields

| Key        | Type                               | Description                                                                                              | Required | Default            |
|------------|------------------------------------|----------------------------------------------------------------------------------------------------------|----------|--------------------|
| `id`       | `string`                           | A unique identifier for the room.                                                                        | Yes      |                    |
| `name`     | `string`                           | A human-readable name for the room.                                                                      | Yes      |                    |
| `area`     | `number`                           | The total floor area of the room in square meters (m²). The sum of all contained zone areas cannot exceed this. | Yes      |                    |
| `height`   | `number`                           | The ceiling height in meters (m). If not provided, it is inherited from the parent `Structure`.          | No       | Inherited          |
| `baseCost` | `number`                           | A base operational cost for the room (e.g., for lighting, ventilation), applied per tick.                | No       | `0`                |
| `zones`    | `Array<`[`Zone`](./zone_schema.md)`>` | An array of Zone objects that are located within this room.                                              | Yes      | `[]` (empty array) |

## Example `room` object in `savegame.json`

```json
{
  "id": "room_a_grow",
  "name": "Grow Room A",
  "area": 60,
  "height": 2.8,
  "baseCost": 50,
  "zones": [
    {
      "id": "zone_a1_ak47",
      "name": "Zone A1 (AK-47)",
      "area": 20,
      // ... other zone properties
    }
  ]
}
```

---
*Back to: [`Architectural Guide`](../architectural_guide.md)*
