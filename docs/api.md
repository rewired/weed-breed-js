# Weed Breed JS – API Reference

This document describes all backend endpoints provided by the Weed Breed simulation. Frontend assets are intentionally excluded.

---

## General

- **Base URL:** `http://<host>:<port>` (default port `3000`)
- **Data format:** JSON encoded as UTF‑8
- **Authentication:** none
- **Environment variables:**
  - `PORT` – server port
  - `SSE_ALLOW_ORIGIN` – CORS origin for Server‑Sent Events (`http://localhost:5173` by default)

---

## 1. Simulation Control

### 1.1 Legacy Endpoints (`/simulation/*`)

| Method | Path                  | Description                                 |
|--------|----------------------|---------------------------------------------|
| POST   | `/simulation/start`  | Start a new simulation.                     |
| POST   | `/simulation/pause`  | Pause the running simulation.               |
| POST   | `/simulation/resume` | Resume a paused simulation.                 |
| GET    | `/simulation/status` | Retrieve current status and key figures.    |

#### Request and response examples

- **POST `/simulation/start`**

  ```json
  {
    "preset": "normal",      // optional: slow|normal|fast|turbo|insane
    "savegame": "default",   // optional: name of the savegame in data/savegames
    "difficulty": "normal"   // optional
  }
  ```

  **Response:** `200 OK` with `{ "message": "...", "..." }` or 4xx/5xx on error.

- **POST `/simulation/pause`**

  No parameters. Response: `{ "message": "Simulation paused." }`

- **POST `/simulation/resume`**

  ```json
  { "preset": "normal" }     // optional
  ```

  **Response:** `{ "message": "Simulation resumed." }`

- **GET `/simulation/status`**

  **Response (`200 OK`):**

  ```json
  {
    "status": "running|paused|stopped",
    "tick": 42,
    "isoTime": "2024-05-14T12:00:00.000Z",
    "tickIntervalHours": 2,
    "day": 4,
    "balance": 1234.56,
    "structure": { ... },
    "grandTotals": { ... }
  }
  ```

### 1.2 Modern Control (`/api/sim/*`)

| Method | Path               | Description                                                        |
|--------|--------------------|--------------------------------------------------------------------|
| GET    | `/api/sim/state`   | Return the current simulation state.                              |
| POST   | `/api/sim/command` | Execute a command (`play`, `pause`, `step`, `reset`, `setSpeed`). |

#### Example for `POST /api/sim/command`

```json
{
  "type": "step",
  "steps": 5,          // only for type=step
  "speed": 2           // only for type=setSpeed
}
```

**Response:** current state `{ "running": true, "tick": 123, "speed": 1 }` or HTTP 400 for invalid commands.

---

## 2. Zone and Plant Information

| Method | Path                                        | Description                              |
|--------|---------------------------------------------|------------------------------------------|
| GET    | `/api/zones/:zoneId/overview`               | Condensed metrics for a zone.            |
| GET    | `/api/zones/:zoneId/details`                | Environment targets, stress, plant list. |
| GET    | `/api/zones/:zoneId/plants/:plantId`        | Detailed data for a single plant.        |

### 2.1 Zone Overview (`/api/zones/{zoneId}/overview`)

Example response (shortened):

```json
{
  "capacity": {
    "plantsCount": 24,
    "capacitySlots": 32,
    "occupancyPct": 75,
    "dominantStage": "vegetation",
    "stageMix": [{ "stage": "vegetation", "count": 24, "pct": 100 }]
  },
  "predictions": { "harvestEtaDays": 30, "yieldForecastGrams": 2500 },
  "environment": {
    "temperature": { "set": 24, "actual": 23.5, "delta": -0.5, "stability": 0 },
    "humidity":    { "set": 0.6, "actual": 0.58, "delta": -0.02, "stability": 0 },
    "co2":         { "set": 800, "actual": 820, "delta": 20, "stability": 0 },
    "ppfd":        { "set": 700, "actual": 680, "delta": -20, "stability": 0 }
  },
  "plantStress": { "avgStress": 0.1, "breakdown": { "temperature": { "count": 2, "avgStress": 0.2 } } },
  "controllers": {
    "co2Injector": { "status": "idle", "dutyCyclePct24h": 0, "targetRange": [775, 825], "mode": "auto" }
  },
  "resourcesDaily": { "energyKWh": 0, "waterL": 0, "co2g": 0, "topConsumers": [] },
  "opexDailyEUR": { "total": 0, "breakdown": { "energy": 0, "water": 0, "maintenance": 0, "rentShare": 0, "labor": 0 } },
  "devices": { "active": 3, "total": 4, "avgHealth": 98, "maintenanceDueInTicks": 0, "warnings24h": 0 },
  "plantPackages": [
    { "label": "AK-47 (vegetation)", "count": 24, "avgAgeDays": 10, "avgHealth": 96, "biomassIndex": 12 }
  ],
  "alerts": [],
  "actions": []
}
```

### 2.2 Zone Detail (`/api/zones/{zoneId}/details`)

```json
{
  "environment": {
    "temperature": { "actual": 23.5, "target": [22, 26], "delta": -0.5 },
    "humidity":    { "actual": 0.58, "target": [0.55, 0.65], "delta": 0.03 },
    "co2":         { "actual": 820, "target": 800, "delta": 20 },
    "light":       { "actual": 680, "target": [600, 750], "delta": -10 }
  },
  "stress": {
    "avg": 0.1,
    "breakdown": { "temperature": { "count": 2, "avg": 0.2 }, "humidity": { "count": 0, "avg": 0 } }
  },
  "plants": [
    {
      "id": "ab12cd34",
      "strain": "AK-47",
      "stage": "vegetation",
      "ageHours": 240,
      "health": 96.3,
      "stress": 8.5,
      "stressors": { "temperature": 0.2 }
    }
  ]
}
```

### 2.3 Plant Detail (`/api/zones/{zoneId}/plants/{plantId}`)

```json
{
  "environment": {
    "temperature": { "set": [22,26], "actual": 23.5 },
    "humidity":    { "set": [0.55,0.65], "actual": 0.58 },
    "co2":         { "set": 800, "actual": 820 },
    "light":       { "set": [600,750], "actual": 680 }
  },
  "stressFactors": {
    "avgStress": 0.1,
    "breakdown": { "temperature": { "count": 2, "avg": 0.2 } }
  },
  "plants": [
    { "id": "ab12cd34", "shortId": "ab12cd34", "strain": "AK-47", "ageDays": 10, "health": 96.3, "stress": 8.5 }
  ]
}
```

---

## 3. Strain Management (`/api/strains`)

| Method | Path                | Description                                                  |
|--------|---------------------|--------------------------------------------------------------|
| GET    | `/api/strains`      | List all strains (`id`, `name`).                             |
| GET    | `/api/strains/{id}` | Retrieve full strain definition.                            |
| POST   | `/api/strains`      | Create or overwrite a strain (existing files are backed up).|
| PUT    | `/api/strains/{id}` | Update a strain (existing file backed up first).            |

- **Strain object:** must follow the JSON schema at `packages/wb-model/schemas/strain.schema.json`.
- **Backups:** existing files are zipped and moved to `data/strains/backup` before overwrite.

---

## 4. Streaming & Real‑Time Interfaces

### 4.1 Server‑Sent Events (SSE)

- **Endpoint:** `GET /sse`
- **Description:** Emits continuous UI events (`event: ui.batch`) as NDJSON stream.
- **CORS:** Allowed origin controlled by `SSE_ALLOW_ORIGIN`.

### 4.2 WebSocket

- **Path:** `ws://<host>:<port>/ws`
- **Description:**
  - On connection, periodic status updates are sent. Example payload:

    ```json
    {
      "tick": 123,
      "time": "12:34:56",
      "day": 6,
      "isoTime": "2024-05-14T12:34:56.000Z",
      "tickIntervalHours": 2,
      "balance": 1234.56,
      "zoneSummaries": [ { "id": "...", "name": "...", "plantCount": 24, ... } ],
      "roomSummaries": [ { "id": "...", "revenueEUR": 0, ... } ],
      "dailyEnergyKWh": 3.2,
      "dailyWaterL": 12,
      "revenueEUR": 0,
      "energyEUR": 0.5,
      "waterEUR": 0.1,
      "fertilizerEUR": 0,
      "rentEUR": 1.2,
      "maintenanceEUR": 0,
      "capexEUR": 0,
      "otherExpenseEUR": 0,
      "energyKWh": 0.13,
      "waterL": 0.5,
      "aggregates": { "24h": {...}, "7d": {...}, "1m": {...} },
      "grandTotals": { "finalBalanceEUR": 1234.56, ... }
    }
    ```

  - Client messages can optionally be handled (e.g. `{ "event": "changeSpeed", "payload": {...} }`), but no concrete logic is implemented yet.

---

## 5. Data Sources

- `data/` – default JSON definitions for devices, methods, strains, configuration, etc.
- `packages/wb-model/schemas` – JSON schemas for model objects (e.g. `strain`, `device`, `cultivation_method`, `strainPrices`).

---

## 6. Architecture Overview

The simulation organizes entities hierarchically:

```shell
Structure → Room → Zone → Plant → Device
```

Further details are documented in the Markdown files under `docs/`, especially `docs/data-model/overview.md` and `docs/reference/tick-and-units.md`.

---

This documentation is generated from static analysis of source code and existing Markdown files. Future changes may not be reflected.
