# Schema: Structure

The `structure` object is the top-level container in a simulation savegame. It represents a single building and contains all rooms and zones.

## Fields

| Key           | Type                               | Description                                                                                             | Required | Default            |
|---------------|------------------------------------|---------------------------------------------------------------------------------------------------------|----------|--------------------|
| `id`          | `string`                           | A unique identifier for the structure.                                                                  | Yes      |                    |
| `name`        | `string`                           | A human-readable name for the structure.                                                                | Yes      |                    |
| `usableArea`  | `number`                           | The total usable floor area in square meters (m²). The sum of all contained room areas cannot exceed this. | Yes      |                    |
| `height`      | `number`                           | The default ceiling height in meters (m) for the structure and all rooms/zones within it. Can be overridden. | No       | `3.0`              |
| `baseRent`    | `number`                           | The base rent cost for the structure, applied per tick.                                                 | No       | `0`                |
| `rooms`       | `Array<`[`Room`](./room_schema.md)`>` | An array of Room objects that are located within this structure.                                        | Yes      | `[]` (empty array) |

## Example `structure` object in `savegame.json`

```json
{
  "id": "main_building_01",
  "name": "Main Grow Facility",
  "usableArea": 200,
  "height": 3.0,
  "baseRent": 500,
  "rooms": [
    {
      "id": "room_a_grow",
      "name": "Grow Room A",
      "area": 60,
      "baseCost": 50,
      "zones": [
        // ... zone objects
      ]
    }
  ]
}
```

---
*Back to: [`Architectural Guide`](../architectural_guide.md)*
