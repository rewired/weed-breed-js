# Product Requirements Document (PRD)

## Modular Plant Growth Simulation (Open Architecture)

### Document Status

* **Owner:** Björn Ahlers
* **Audience:** Backend (Node.js) & Frontend (React) engineers, QA, DevOps
* **Version:** v1.0 (Initial)
* **References:** Architecture & naming conventions and domain schemas from the Weed Breed project are authoritative for units, tick semantics, and data blueprints.  &#x20;

---

## 1) Goals & Non-Goals

### 1.1 Goals

* Deliver a **modular, extensible** simulation of plant physiology and climate that runs on Node.js and streams real-time telemetry to a web dashboard.
* Favor **proven libraries** (math/units, schema validation, charts, state management) over bespoke implementations.
* Ensure **determinism and replaceability** of the biology/physics module: drop-in upgrade of formulas without ripple effects.
* Provide **save/load** (JSON) with schema validation and versioning.

### 1.2 Non-Goals (v1)

* No 3D rendering or heavy CFD/psychrometrics (advanced models may be introduced later).&#x20;
* No multiplayer game logic (prepare event stream but keep single-user focus).&#x20;
* No persistence layer beyond file-based saves (DB offloading can be evaluated later).

---

## 2) Users, Personas & Use Cases

### 2.1 Personas

* **Simulation Engineer:** Develops & calibrates env/plant models; needs fast iteration and testability.
* **Gameplay/UX Engineer:** Builds dashboards and controls; needs stable event API and compact payloads.
* **Tuner/Designer:** Adjusts parameters (light setpoints, schedules, strain/method blueprints) without code changes.

### 2.2 Primary Use Cases

1. **Run a tick-based simulation** with configurable tick length (e.g., 1–10 minutes of sim time per tick).
2. **Adjust conditions at runtime** (pause/resume, tick rate, setpoints for light/temperature/CO₂).
3. **Visualize telemetry** (time-series charts for T, RH, VPD, PPFD; tables for plants/devices).
4. **Save & load** full state with schema validation and versioning.

---

## 3) System Overview

### 3.1 Architecture Summary

* **Backend (Node.js, ESM):** Simulation core (physics & plant model), scheduler/loop, event bus, save/load, Socket.IO gateway. Event-driven and deterministic.&#x20;
* **Frontend (React + Vite):** Real-time dashboard using Socket.IO, Zustand store, Recharts, TanStack Table.
* **Contracts:** JSON event payloads & schemas; SI units & naming conventions uniform across modules.&#x20;

### 3.2 World Model (v1)

* Hierarchy: **Building → Rooms → Zones → Plants**; zone-scoped environment state feeds plant model each tick.&#x20;
* Geometry utilities: room volumes, zone areas; coverage/limits of devices (lamp coverage m², HVAC airflow m³/h). &#x20;

---

## 4) Functional Requirements

### 4.1 Plant Physiology & Bioclimatics Module

* **Inputs per tick:** temperature (°C), relative humidity (0–1), CO₂ (ppm), PPFD (µmol·m⁻²·s⁻¹), zone volume (m³), leaf area index (LAI), water/nutrient status.
* **Outputs per tick:** VPD proxy, transpiration, photosynthesis rate, biomass increment, health/stress indicators.
* **Implementation Guidance:**

  * Provide a lightweight closed-form **VPD proxy, transpiration, and photosynthesis** (“arcade” model) with tunables and clamps.&#x20;
  * Keep all formulas in one module (e.g., `src/engine/plantModel.js` + `src/engine/envPhysics.js`) to allow **drop-in replacement** with more advanced models (e.g., Penman-Monteith) later.&#x20;
  * Use **Math.js** for unit handling/expressions where helpful; base units SI (implicit).&#x20;
* **Acceptance Examples (physics sanity):**

  * If **PPFD = 0**, photosynthesis increment must be \~0 (respiration ignored in v1).
  * If **RH decreases** (other factors constant), **VPD increases**, raising transpiration until clamped.
  * If **T deviates** strongly from `T_opt`, growth/stress functions reflect penalties.&#x20;

### 4.2 Simulation Loop & Scheduler

* Fixed or adjustable **tick length** (default minutes of sim time per tick), **pause/resume**, **step**, **fast-forward**.
* After each tick, emit an event `sim.tickCompleted` with snapshot/diff payloads for UI.&#x20;
* Provide optional discrete-event lib evaluation later; v1: Node timers + state machine orchestration.
* **Tick phase order (must):**

  1. `applyDevices` → 2) `deriveEnvironment` → 3) `irrigationAndNutrients` → 4) `updatePlants` → 5) `harvestAndInventory` → 6) `accounting` → 7) `commit`.&#x20;

### 4.3 Geometry & Environment Model

* **Room/Zone data:** area (m²), height (m), volume (m³), environmental state (T, RH, CO₂, PPFD).
* **Utilities:** `getVolume(room)`, lamp **coverageArea** checks, HVAC airflow → temperature delta via capacity model. &#x20;
* **Extensibility:** Prepared for later 2D/3D grid and more accurate psychrometrics (Magnus/psychrolib).&#x20;

### 4.4 Formula Evaluation & Units

* **Units:** SI throughout; **no unit suffixes** in keys. Convert at edges if needed.&#x20;
* **Dynamic formulas:** Concentrate tunables (e.g., `L50`, `C50`, `T_opt`) in config so designers can calibrate without code.&#x20;
* **Validation:** On load, verify formulas/parameters; surface precise errors.

### 4.5 Data Serialization (Save/Load) & Schema

* **Savegames:** Serialize full simulation state to **JSON** with `version`, timestamp, and deterministic RNG seed.
* **Schema Validation:** Use JSON Schema (Ajv) or Zod to validate saves & blueprints; include **versioning** for migration.
* **Blueprint Inputs:**

  * **Strains:** genotype, chemotype, morphology, environment prefs, photoperiod, disease & harvest windows.&#x20;
  * **Cultivation Methods:** area per plant, substrate, containerSpec, compatibility.&#x20;
  * **Devices:** kind, settings (power, airflow, cooling…), meta; prices/maintenance externalized.&#x20;
  * **Strain Prices:** `seedPrice`, `harvestPricePerGram` (max at quality=1; runtime modifiers apply).&#x20;

### 4.6 WebSocket Communication (Socket.IO)

* **Events (server → client):**

  * `simulationUpdate` (batched diff/min snapshot per tick),
  * `sim.tickCompleted`, domain events (`plant.stageChanged`, `plant.harvested`, `device.degraded`, `zone.thresholdCrossed`, `market.saleCompleted`).&#x20;
* **Events (client → server):**

  * `simulationControl` (`play|pause|step|fastForward`, `setTickLength`, `setSetpoint`),
  * `config.update` (optional gated: update tunables).
* **Payloads:** JSON, compact, with SI units implied; include `tick` and monotonic millisecond `ts`.

### 4.7 Client Application (React)

* **State:** Zustand global store; normalized slices for env time-series, plant/device tables.
* **Visualization:** Recharts (line for T/RH/PPFD/CO₂, small multiples), TanStack Table for inventory & events.
* **Controls:** Play/pause/step, tick rate slider, setpoint inputs (T, RH/target VPD, CO₂, light).
* **Performance:** Throttle chart updates (e.g., last N points), virtualize tables if needed.

### 4.8 Testing & Validation

* **Unit tests:** VPD, growth/stress clamps, device coverage checks, unit conversions.
* **Integration tests:** Multi-tick scenarios (e.g., lights off → zero growth; humidity drop → VPD↑ → transpiration↑).&#x20;
* **Schema tests:** Round-trip save/load; validate blueprints (strain/device/method/price).
* **Benchmarks:** Target per-tick compute **≤ 100 ms** at 10 ticks/sec on a dev laptop.

---

## 5) Non-Functional Requirements

* **Determinism:** Given same seed and inputs, state must be identical across runs.
* **Extensibility:** Hot-swappable plant/physics modules without touching loop, UI, or schemas.
* **Observability:** Structured logs (pino); event bus mirrors key domain events for UI and debugging.&#x20;
* **Resilience:** Graceful error handling at phase boundaries; no partial commits (commit-at-end per tick).&#x20;
* **Config:** `.env` for tick length, log level, seed; JSON for tunables & blueprints.

---

## 6) Detailed Design

### 6.1 Tick Orchestration

* Implement the tick order as a small **state machine** (XState) for clarity and testability; transitions on success/failure; **commit** at end.&#x20;

### 6.2 Event Bus

* Internal bus (RxJS Subject) with `emit(type, payload, tick, level)`, UI stream is buffered/throttled and forwarded to Socket.IO.&#x20;
* Event types use dotted namespaces (`plant.*`, `device.*`, `sim.*`, `market.*`).

### 6.3 Devices & Physical Limits

* Device blueprints define **settings**; runtime instantiation accounts for **coverageArea** (lamps), **airflow** and **coolingCapacity** (HVAC). Multiple devices may be needed for larger zones. &#x20;

### 6.4 Data & Naming Rules

* Use camelCase, **no unit suffixes**, SI implied, time in **hours/days**, prices in EUR (implicit), as per conventions.&#x20;

---

## 7) Interfaces & Payloads (Examples)

### 7.1 `simulationUpdate` (server → client)

```json
{
  "type": "simulationUpdate",
  "tick": 124,
  "ts": 1725712345678,
  "env": {
    "zoneId": "zone-a1",
    "temperature": 25.3,
    "humidity": 0.62,
    "co2": 980,
    "ppfd": 540,
    "vpd": 1.3
  },
  "plants": [
    { "id": "p-01", "stage": "vegetation", "biomass_g": 142.1, "health": 0.93 }
  ],
  "events": [
    { "type": "device.degraded", "deviceId": "lamp-01", "severity": "info" }
  ]
}
```

### 7.2 `simulationControl` (client → server)

```json
{ "type": "simulationControl", "action": "pause" }
```

```json
{ "type": "simulationControl", "action": "setTickLength", "minutes": 3 }
```

```json
{ "type": "simulationControl", "action": "setSetpoint", "target": "temperature", "value": 24 }
```

### 7.3 Savegame Header

```json
{
  "kind": "WeedBreedSave",
  "version": "1.0.0",
  "createdAt": "2025-09-07T08:00:00Z",
  "tickLengthMinutes": 3,
  "rngSeed": "wb-42-abc",
  "state": { /* ... */ }
}
```

---

## 8) Data Blueprints (Authoritative)

* **Strain schema** (genetics, morphology, environment prefs, photoperiod, disease, harvest): used by plant factory.&#x20;
* **Cultivation method schema** (substrate, containerSpec, areaPerPlant, compatibility): drives capacity & plausibility checks.&#x20;
* **Device schema** (settings & meta; prices & maintenance externalized): per-tick effects derived from settings.&#x20;
* **Strain prices schema** (seed & harvest base price, runtime modifiers apply via market engine).&#x20;

---

## 9) Validation & QA

### 9.1 Unit Tests (Jest)

* **Physics:** VPD proxy monotonicity; temperature update with power/heat capacity; PPFD → photosynthesis saturation curve.&#x20;
* **Data:** Ajv/Zod validation for saves and blueprints (strain/device/method/price).
* **Naming:** Lint test to forbid unit suffixes in keys per conventions.&#x20;

### 9.2 Integration Scenarios

* **Dark Run:** PPFD=0 for 24h → biomass increment \~0; transpiration minimal (bounded by floor).
* **Dry Air:** Lower RH by 10% with constant T → VPD↑, transpiration↑, water store ↓ with irrigation controller reacting.
* **Coverage Limit:** Oversized zone with one lamp → PPFD cap; adding second lamp raises PPFD within geometric bounds.&#x20;

### 9.3 Performance

* **Target:** ≤ 100 ms per tick at 10 tps with 1 room, 2 zones, 50 plants, 4 devices.
* Provide a `npm run bench` script with fixed seed and fixture data.

---

## 10) Security, Logging & Telemetry

* **Logging:** pino JSON logs (level from ENV), include `{ tick, zoneId, plantId? }` in context.&#x20;
* **Socket:** Namespaces/rooms (future-proof); in v1 single client namespace.
* **Config:** `dotenv` for tick length, seeds, log levels; hot reload of blueprint files with chokidar (dev only).&#x20;

---

## 11) Milestones & Deliverables

1. **M1 – Core Loop & Bus (Backend)**

   * Tick state machine with ordered phases; RxJS event bus; Socket.IO gateway; dummy zone & single plant.
   * Unit tests for tick order and `sim.tickCompleted`.
2. **M2 – Physics & Plant Model**

   * Env physics + arcade plant model; tunables in JSON; tests for VPD/photosynthesis/transpiration; coverage checks.
3. **M3 – Save/Load & Schemas**

   * Ajv/Zod validation for savegames; versioned saves; blueprint loaders (strain/device/method/prices).
4. **M4 – Dashboard (Frontend)**

   * Zustand store; charts & tables; controls (play/pause/step/rate/setpoints); basic theming.
5. **M5 – Benchmarks & Hardening**

   * Bench suite; error handling; graceful shutdown; docs & examples.

---

## 12) Risks & Mitigations

* **Over-complex models** slow ticks → **Mitigation:** start with simplified formulas; keep upgrade path documented.&#x20;
* **Payload bloat** over WebSocket → **Mitigation:** diffs or downsampling; UI throttling.
* **Schema drift** in blueprints → **Mitigation:** strict validation and version gates; migration scripts.

---

## 13) Open Questions

* Do we require **psychrometric coupling** (T↔RH via saturation vapor pressure) in v1 or v1.1?&#x20;
* Should **market/price modifiers** (quality, brand, demand) ship in v1 or remain stubbed?&#x20;
* How many **zones/plants** are the default stress test targets for CI?

---

## 14) Definition of Done (DoD)

* All functional requirements implemented with passing unit/integration tests.
* Dashboard reflects `simulationUpdate` in real time and controls work (pause/step/rate/setpoints).
* Save/load round-trips validated; blueprint schemas locked with version headers.
* Benchmarks meet performance target on reference hardware.

---

## 15) Appendix: Tick Physics (Reference)

Core formula references used for v1 arcade model (transpiration, photosynthesis, temperature, humidity pool, device control hysteresis) are documented in **WB-Formeln.md** and MUST remain encapsulated behind the physics module boundary for future model swaps.&#x20;

---

### Implementation Notes for Codex

* **Node:** ESM only; modules under `src/engine`, `src/sim`, `src/lib`.
* **Events:** Mirror the ADR’s event taxonomy; forward UI-safe stream over Socket.IO.&#x20;
* **Schemas:** Load & validate blueprints per their schema docs before runtime use.   &#x20;
* **Naming & Units:** Enforce conventions (lint/CI check).&#x20;

> This PRD is designed to be “open architecture”: physics and plant models are boxed behind a single module boundary; devices, strains, and methods are pure JSON blueprints; the loop and event bus are stable contracts for UI and future systems. &#x20;
