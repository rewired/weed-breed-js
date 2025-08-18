# Bootstrapping Data

This guide shows minimal JSON snippets for defining structures, rooms, zones, plants and devices.
It also notes where to place the files within the `data/` directory and which loader reads them.

## Directory Overview

- `data/savegames/` – hierarchical definitions for structures, rooms, zones and optionally plants.
  Loaded by [`loadSavegame`](../../src/server/services/savegameLoader.js).
- `data/devices/` – device blueprints. Loaded by [`loadAllDevices`/`loadDeviceBySlug`](../../src/engine/loaders/deviceLoader.js).

For a complete example, see [`data/savegames/default.json`](../../data/savegames/default.json).

## Structure

```json
{
  "id": "main_building_01",
  "name": "Main Grow Facility",
  "usableArea": 200,
  "height": 3.0,
  "baseRent": 500
}
```

Structure, room and zone objects usually live inside a savegame file at `data/savegames/<name>.json`.

## Room

Rooms are defined inside a structure's `rooms` array:

```json
{
  "structure": {
    "id": "main_building_01",
    "rooms": [
      {
        "id": "room_a_grow",
        "name": "Grow Room A",
        "area": 60,
        "height": 3.0,
        "baseCost": 50
      }
    ]
  }
}
```

## Zone

Zones are nested inside a room's `zones` array:

```json
{
  "structure": {
    "rooms": [
      {
        "id": "room_a_grow",
        "zones": [
          {
            "id": "zone_a1",
            "name": "Zone A1",
            "area": 20,
            "height": 2.8,
            "devices": [
              { "blueprintId": "3b5f6ad7-672e-47cd-9a24-f0cc45c4101e", "count": 16 },
              { "blueprintId": "7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b", "count": 1 }
            ]
          }
        ]
      }
    ]
  }
}
```

### Zone Simulation (optional)

Zones can include a `simulation` block defining default strain and method:

```json
{
  "id": "zone_a1",
  "simulation": {
    "strainId": "550e8400-e29b-41d4-a716-446655440000",
    "methodId": "sog"
  }
}
```

### Device Overrides (optional)

Device entries inside a zone may override blueprint settings:

```json
{
  "blueprintId": "7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b",
  "count": 1,
  "overrides": { "targetTemperature": 24 }
}
```

## Plant

```json
{
  "id": "plant_1",
  "label": "AK-47 #1",
  "zoneId": "zone_a1",
  "area_m2": 0.25,
  "stage": "vegetative",
  "ageHours": 0,
  "health": 1.0
}
```

Plants can be embedded in savegames under `zones[].plants[]` or generated from strain blueprints via the plant factory.

## Device Blueprint

```json
{
  "id": "7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b",
  "kind": "ClimateUnit",
  "name": "CoolAir Split 3000",
  "quality": 0.9,
  "complexity": 0.4,
  "settings": {
    "power": 1.2,
    "coolingCapacity": 1.6,
    "airflow": 350,
    "targetTemperature": 24,
    "targetTemperatureRange": [18, 30],
    "coolingEfficiency": 0.05,
    "maxCooling": 0.4,
    "hysteresisK": 0.5,
    "fullPowerAtDeltaK": 5
  }
}
```

Device blueprints reside in `data/devices/` and are loaded by the device loader.
