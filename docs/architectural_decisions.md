# 🌱 Weed Breed – Architectural Decisions (ADR-Light)

> Status: 2025-08-09 — Node.js (ES Modules), **without TypeScript**

This file summarizes the architectural decisions made in the project. It serves as a reference for implementation, testing, and future extensions.

---

## Content
1. Goals & Guiding Principles
2. Data Model & Naming
3. Zone/Plant Logic (Container & Substrate)
4. Device Model (Blueprints, Prices, Physical Limits)
5. Simulation Core: Tick-based
6. Event Layer: RxJS as a Bus
7. Tick Orchestration via State Machine (XState)
8. Reproducibility, Logging & Dev Ergonomics
9. Package Stack (without TS) & Minimal Setups
10. Project Structure
11. Open Points / Next Steps

---

## 1) Goals & Guiding Principles

- **Deterministic, tick-based simulation** (no real-time thread).
- **Loose Coupling**: Core state through ticks, **events for telemetry only**.
- **JSON Blueprints + Factories** instead of hardcoding.
- **ES Modules** (`import`), **without TypeScript**.
- **SI units** are implicit, **no units in the key** (see naming conventions).
- UI/Visualization **decoupled** via event stream, not through core polling.

---

## 2) Data Model & Naming

- **Strains** (`strain.json`): Genetics, morphology, environment, nutrients/water, photoperiod, resistance, harvest window.
- **Cultivation Methods** (`cultivation_method.json`): Setup costs, labor intensity, **areaPerPlant**, **substrate**, **containerSpec** (new), compatibility, ideal conditions.
- **Devices** (`device.json`): Device blueprints incl. `settings` (performance-dependent). **Prices/Maintenance external** (`devicePrices.json`).
- **Strain Prices** (`strainPrices.json`): `seedPrice`, `harvestPricePerGram` (base, market modifies at runtime).

**Naming Rules (Excerpt):**
- `camelCase`, **no** suffixes like `_kw`, `_eur`, `_hours`.
- Time: **hours/days**; Area: m²; Power: kW; Light: µmol/m²·s.
- Examples: `vegetationDays`, `powerInKilowatts`, `coverageArea`, `lifespanInHours`.

---

## 3) Zone/Plant Logic (Container & Substrate)

**Zone Grid:** 0.25 m² per tile with a 2.5 m ceiling height (standard). A zone consists of n tiles.

**Method defines the setup** (Substrate + Container):
```json
"substrate": { "type": "soil", "costPerSquareMeter": 3.5, "maxCycles": 2 },
"containerSpec": {
  "type": "pot",
  "volumeInLiters": 11,
  "footprintArea": 0.20,
  "reusableCycles": 6,
  "costPerUnit": 2.0,
  "packingDensity": 0.95
}
```

**Capacity & Plausibility**
- Slots: `plantSlots = floor(zoneArea / areaPerPlant)`
- Plausibility check per plant:
  `requiredPerPlant = footprintArea / packingDensity`
  Warning if `requiredPerPlant > areaPerPlant`.

**Substrate consumption/cost:** proportional to occupied area; replacement after `substrate.maxCycles`.

---

## 4) Device Model (Blueprints, Prices, Physical Limits)

- Devices are **Blueprints** (JSON) → instantiated at runtime (Factory).
- **Price/Maintenance separate** (balancing without changing blueprints).
- **Physical limits** are considered:
  - **Lamps:** `coverageArea`, efficiency; multiple lamps needed for a larger zone.
  - **Climate Unit:** `airflow` (m³/h), `coolingCapacity`, `targetTemperature`.
- Effect is translated **per tick** into the zone's environmental data.

---

## 5) Simulation Core: Tick-based

- **Ticks are the source of truth** (state transitions only through ticks).
- Uniform tick length (e.g., 3 h sim time).
- Order per tick is **explicitly** defined (see §7).
- **Commit at tick end** (atomicity); centralized error handling.

---

## 6) Event Layer: RxJS as a Bus

**Motivation:** Visualization, telemetry, debugging — without polluting the core.
**Principle:** Events only reflect semantic changes, **no commands**.

_Minimal API:_
```js
// src/sim/eventBus.js
import { Subject } from 'rxjs';
import { bufferTime, filter, share } from 'rxjs/operators';

export const events$ = new Subject(); // { type, payload, tick, ts, level? }
export const uiStream$ = events$.pipe(
  filter(e => e.level !== 'debug'),
  bufferTime(50),
  share()
);
export function emit(type, payload, tick, level = 'info') {
  events$.next({ type, payload, tick, level, ts: Date.now() });
}
```

**Event Types (Examples):**
`plant.stageChanged`, `plant.healthAlert`, `plant.harvested`,
`device.degraded`, `device.failed`, `device.replaced`,
`zone.thresholdCrossed`, `market.saleCompleted`,
`sim.tickCompleted` (UI clock).

---

## 7) Tick Orchestration via State Machine (XState)

We model the **tick as a small state machine** (phase → phase) to facilitate order, testing, pause/step.

_Phase Overview:_
1. **applyDevices** – Apply device effects
2. **deriveEnvironment** – Derive effective environment
3. **irrigationAndNutrients** – Irrigate + NPK
4. **updatePlants** – Growth, stress, disease, stages
5. **harvestAndInventory** – Harvest, inventory booking
6. **accounting** – Costs, maintenance, market/sales
7. **commit** – Snapshot, bundle events

---

## 8) Reproducibility, Logging & Dev Ergonomics

- **RNG:** `seedrandom` – fixed seeds for reproducible runs.
- **Logging:** `pino` (+ `pino-pretty` in Dev) – fast JSON logger.
- **Hot-Reload Data:** `chokidar` watches `/data` and triggers a reload.
- **Configuration:** `.env` via `dotenv` (tick length, log level, seeds, flags).

---

## 9) Package Stack (without TS) & Minimal Setups


**We use:** `xstate`, `rxjs`, `pino`, `pino-pretty`, `seedrandom`, `dotenv`, `uuid`, `lodash`, `express`, `ws`.
**Only if needed:** `ajv`, `mathjs`, `convict`.

---

## 10) Project Structure (recommended)

```
.
├── data/              # JSON blueprints (strains, methods, devices, prices)
└── src/
    ├─ engine/        # Plant, Devices, Zone (base classes + logic)
    ├─ sim/           # tickMachine, eventBus, costEngine
    ├─ lib/           # logger, rng, time
    ├─ config/        # env.js
    ├─ dev/           # Development-related scripts
    ├─ server/        # Express server for UI
    └─ index.js       # Main simulation entry point

```

---

## 11) Open Points / Next Steps

- **Specify device effects** (light coverage, m³/h → °C delta modeling).
- **Formalize plant update** (stress/NPK/water effect per tick, stage triggers).
- **`Zone.addPlant()` validation** (slots, height, method compatibility, container/substrate inventory).
- **Cost model**: Degeneration + maintenance curves, replacement thresholds.
- **UI Adapter**: WebSocket forwarder for `uiStream$` + simple timeline demo.
