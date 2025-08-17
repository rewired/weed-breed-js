# Weed Breed — Data Model & Simulation Conventions

> **Scope.** This document consolidates our core data schemas (Strain, Cultivation Method, Device, Strain Prices), global naming & unit rules, and the tick-based simulation pipeline. It is the single entry point for contributors who touch JSON blueprints, factories, and simulation logic.

---

## 1) World Model & Principles

* **Tick‑based** (deterministic; no realtime thread).
* **Factories + JSON blueprints** for all core entities.
* **Loose coupling via an event bus** (telemetry only — no commands).
* **ES Modules** (Node.js ≥ 23; `import` only).
* **SI units by convention**; no unit suffixes in keys.
* **Economy decoupled from blueprints** (prices & maintenance curves live outside device/strain JSONs).

### Hierarchy

```terminal
Building → Rooms → Zones → Plants
```

*Rooms* define area (m²) and height (m). *Zones* sit inside rooms and host devices and plants. Plants are instantiated from **Strain** JSON blueprints and placed via a **Cultivation Method** (area per plant, substrate, container system).

---

## 2) Global Naming & Units

* **camelCase** for keys (e.g., `floweringDays`, `powerInKilowatts`).
* **No unit suffixes** in field names (e.g., `idealHumidity` instead of `ideal_humidity_pct`).
* **Percent-like values** are normalized **0…1** (e.g., `humidity: 0.65`).
* **Time:**

  * Phase durations in **days** (e.g., `vegetationDays`).
  * Durations inside devices/plant post‑harvest in **hours** (e.g., `lifespanInHours`, `ripeningTimeInHours`).
  * Simulation uses a configurable `tickLengthInHours` (default 1h).
* **Units:**

  * Temperature °C, Area m², Volume m³ (rooms) / L (containers), Airflow m³/h.
  * Electrical power in **kW**.
  * Light intensity in **PPFD** µmol·m⁻²·s⁻¹; PPE in µmol/J.

---

## 3) Schema Overview (JSON Blueprints)

> All blueprints carry an `id` (UUID or stable slug) and are loaded by their respective factory at runtime.

### 3.1 Strain (`strain.json`)

**Purpose.** Encodes genetics, morphology, environmental preferences, nutrition & water demand, disease model, photoperiod, harvest window and post‑harvest behavior.

**Key areas.**

* `id`, `name`, `lineage.parents` (UUIDs of 2 parents)
* `genotype` (sativa/indica/ruderalis fractions)
* `chemotype` (e.g., `thcContent`, `cbdContent` in 0…1)
* `morphology` (e.g., `growthRate`, `yieldFactor`, `leafAreaIndex`)
* `environmentalPreferences`

  * `lightSpectrum` by phase `[minNm, maxNm]`
  * `lightIntensity` (PPFD) per phase `[min, max]`
  * `lightCycle` per phase `[lightHours, darkHours]`
  * `idealTemperature` per phase `[minC, maxC]`
  * `idealHumidity` per phase `[min, max]` (0…1)
  * `phRange` `[min, max]`
* `dailyNutrientDemand` per phase (NPK map) + `npkTolerance`, `npkStressIncrement`
* `dailyWaterUsagePerSquareMeter`, `minimumFractionRequired`
* Disease/health: `dailyInfectionIncrement`, `infectionThreshold`, `recoveryRate`, `degenerationRate`, `regenerationRate`, `fatalityThreshold`
* Photoperiod: `vegetationDays`, `floweringDays`, `transitionTriggerHours`
* Harvest window & economics: `floweringTime.shortestDurationInDays`, `floweringTime.longestDurationInDays`
* Post‑harvest: `ripeningTimeInHours`, `maxStorageTimeInHours`, `qualityDecayPerHour`

**Minimal example.**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "AK-47",
  "lineage": { "parents": [] },
  "genotype": { "sativa": 0.35, "indica": 0.65, "ruderalis": 0 },
  "chemotype": { "thcContent": 0.22, "cbdContent": 0.01 },
  "morphology": { "growthRate": 1.0, "yieldFactor": 1.1, "leafAreaIndex": 2.2 },
  "environmentalPreferences": {
    "lightSpectrum": { "vegetation": [400, 700], "flowering": [300, 650] },
    "lightIntensity": { "vegetation": [400, 600], "flowering": [600, 1000] },
    "lightCycle": { "vegetation": [18, 6], "flowering": [12, 12] },
    "idealTemperature": { "vegetation": [20, 28], "flowering": [22, 30] },
    "idealHumidity": { "vegetation": [0.6, 0.7], "flowering": [0.5, 0.6] },
    "phRange": [5.8, 6.2]
  },
  "dailyNutrientDemand": {
    "vegetation": { "nitrogen": 1.2, "phosphorus": 0.6, "potassium": 1.0 },
    "flowering": { "nitrogen": 0.7, "phosphorus": 1.4, "potassium": 1.6 }
  },
  "npkTolerance": 0.1,
  "npkStressIncrement": 0.02,
  "dailyWaterUsagePerSquareMeter": { "vegetation": 4.0, "flowering": 5.5 },
  "minimumFractionRequired": 0.5,
  "dailyInfectionIncrement": 0.002,
  "infectionThreshold": 0.3,
  "recoveryRate": 0.01,
  "degenerationRate": 0.02,
  "regenerationRate": 0.03,
  "fatalityThreshold": 0.95,
  "vegetationDays": 28,
  "floweringDays": 63,
  "transitionTriggerHours": 12,
  "floweringTime": { "shortestDurationInDays": 56, "longestDurationInDays": 70 },
  "ripeningTimeInHours": 72,
  "maxStorageTimeInHours": 720,
  "qualityDecayPerHour": 0.001
}
```

**Recommendations.** Keep genotype fractions within 0…1 and ideally **sum to \~1**. Phase ranges should overlap softly to avoid brittle control logic.

---

### 3.2 Cultivation Method (`cultivation_method.json`)

**Purpose.** Defines spatial layout, substrate & container system, setup costs, labor intensity, and trait compatibility for strains.

**Key areas.** `id`, `kind: "CultivationMethod"`, `name`, `setupCost`, `laborIntensity`, `areaPerPlant`, `minimumSpacing`, `maxCycles`.

**Sub-objects.**

* `substrate`: `{ type, costPerSquareMeter, maxCycles }`
* `containerSpec`: `{ type, volumeInLiters, footprintArea, reusableCycles, costPerUnit, packingDensity }`
* `strainTraitCompatibility` (preferred/conflicting rules against strain fields)
* `idealConditions`: `{ idealTemperature: [minC, maxC], idealHumidity: [min, max] }`

**Notes on capacity.**

* Zone capacity: `plantSlots = floor(zoneArea / areaPerPlant)`
* Sanity check per plant: `requiredPerPlant = footprintArea / packingDensity` must be ≤ `areaPerPlant` (warn otherwise).

**Minimal example.**

```json
{
  "id": "sog",
  "kind": "CultivationMethod",
  "name": "Sea of Green",
  "setupCost": 10,
  "laborIntensity": 0.4,
  "areaPerPlant": 0.25,
  "minimumSpacing": 0.25,
  "maxCycles": 2,
  "substrate": { "type": "soil", "costPerSquareMeter": 3.5, "maxCycles": 2 },
  "containerSpec": {
    "type": "pot",
    "volumeInLiters": 11,
    "footprintArea": 0.2,
    "reusableCycles": 6,
    "costPerUnit": 2.0,
    "packingDensity": 0.95
  },
  "strainTraitCompatibility": {
    "preferred": { "genotype.indica": { "min": 0.5 } },
    "conflicting": { "genotype.sativa": { "min": 0.5 } }
  },
  "idealConditions": { "idealTemperature": [22, 28], "idealHumidity": [0.5, 0.65] }
}
```

---

### 3.3 Device (`device.json`)

**Purpose.** Device blueprints with device‑specific `settings`. Economics (prices, maintenance) live outside.

**Key areas.** `id`, `kind` (e.g., `Lamp`, `ClimateUnit`), `name`, `quality` (0…1), `complexity` (0…1), `settings` (type‑specific), and optional `meta` (`description`, `advantages`, `disadvantages`, `notes`).

**Example (ClimateUnit).**

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
    "coolingEfficiency": 0.05,
    "maxCooling": 0.4
  },
  "meta": {
    "description": "High-performance climate control unit for closed growing environments.",
    "advantages": ["Effective cooling for medium-sized rooms", "Reliable airflow distribution", "Energy-efficient at moderate loads"],
    "disadvantages": ["Higher maintenance costs over time", "Limited precision for multi-zone systems"],
    "notes": "Recommended for vegetative and early flowering stages in temperate climates."
  }
}
```

**External device pricing (recommended schema).**

```json
{
  "devicePrices": {
    "<device-uuid>": {
      "capitalExpenditure": 1200,
      "baseMaintenanceCostPerTick": 0.02,
      "costIncreasePer1000Ticks": 0.15
    }
  }
}
```

---

### 3.4 Strain Prices (`strainPrices.json`)

**Purpose.** Baseline economic values per strain. The **market engine** will modify them at runtime (quality, brand, demand…).

**Schema.**

```json
{
  "strainPrices": {
    "<strain-uuid>": {
      "seedPrice": 0.5,
      "harvestPricePerGram": 4.2
    }
  }
}
```

**Runtime pricing.** `actualPricePerGram = harvestPricePerGram × qualityModifier × brandValue × marketDemand` (the latter two are optional multipliers to be phased in).

---

## 4) Simulation Pipeline (per Tick)

> Ticks are the single source of truth. State transitions occur only through the tick phases.

1. **applyDevices** — compute device effects (light, heat/cooling, airflow, CO₂, dehumidification).
2. **deriveEnvironment** — fold device outputs into zone environment (T, RH, CO₂, PPFD).
3. **irrigationAndNutrients** — water/NPK handling against plant demand.
4. **updatePlants** — growth, stress, disease, stage changes (seedling → veg → flower → harvestable).
5. **harvestAndInventory** — transfer to inventory; apply ripening/shelf‑life logic.
6. **accounting** — energy, maintenance, rent, labor; sales via market engine.
7. **commit** — snapshot & event emission (batched for UI/telemetry).

**Runtime context** supplied to factories includes zone geometry, tick length, price maps, and environment state.

---

## 5) Environment & Plant Dynamics (Arcade Formulas)

> Lightweight, stable formula set intended for gameplay (upgradeable later).

* **Lamp heat:** `Q_lamp = beta_lamp * P_lamp` (kW); **PPFD:** `L = PPE * P_lamp * eta_geo`.
* **HVAC:** `Q_hvac = clamp(kT * (T_set − T), −Q_cool_max, Q_heat_max)`.
* **Ventilation mixing:** `ΔT_vent = kappa_T (T_out − T)`, `ΔRH_vent = kappa_RH (RH_out − RH)`.
* **Temperature update:** `T_{t+1} = T_t + (Q_net * 60 * Δt) / (C_T * 1000)` with optional smoothing.
* **Humidity pool:** keep a moisture pool `M_v` → normalize to `RH` by `RH = clamp(alpha_RH * M_v / M_v_max, 0, 1)`.
* **Transpiration (VPD proxy):** `E_plant = g_v * LAI * VPD * f_light(L) * f_health(H)`.
* **Photosynthesis:** `A = A_max * f_light(L) * f_CO2(C) * f_T(T) * f_RH(RH)`; CO₂ drawdown via `δC = κ_A * A * LAI`.
* **Growth:** `ΔG = γ_G * A * min(f_water, f_nutr, f_space)`.
* **Hysteresis controls:** thermostats/dehumidifier/CO₂ injector use simple on/off bands.

> Deep‑sim upgrades can later replace humidity with psychrometrics and transpiration with Penman–Monteith.

---

## 6) Event Bus & Logging

* **Event stream**: emit `{type, payload, tick, level, ts}`; UI subscribes to a shared, throttled subset (no debug).
* **Logging**: structured logs (e.g., pino) with JSON output; pretty print in dev. Telemetry is append‑only and does not influence core state.

---

## 7) Validation, Versioning & Migrations

* **Validation**: define JSON Schemas and validate blueprints at load time (e.g., Ajv). Fail fast with clear error messages.
* **Versioning**: include a top‑level `schemaVersion` per file family (e.g., `strainSchemaVersion: 1`). Increment on breaking changes.
* **Backfills/Migrations**: keep a small migration layer per blueprint type (`migrateStrain(vOld→vNew)`), applied pre‑validation.
* **Determinism**: seed RNG for reproducible runs.

**Ajv validation snippet (illustrative).**

```js
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);

// compile once at startup
const validateStrain = ajv.compile(strainJsonSchema);

export function assertStrainConfig(cfg) {
  if (!validateStrain(cfg)) {
    const msg = ajv.errorsText(validateStrain.errors, { separator: '\n' });
    throw new Error(`Invalid strain config:\n${msg}`);
  }
}
```

---

## 8) Factory Pattern (Runtime Context)

Blueprints are **static**; dynamic values come from the **runtime context**:

```ts
runtimeCtx = {
  zone: { area: m2, height: m, volume: m3 },
  tickLengthInHours: number,
  env: { temperature: C, humidity: 0..1, co2ppm: number },
  priceMaps: { strainPrices, devicePrices },
  rng, logger, events
}
```

Each factory (`plantFactory`, `deviceFactory`, `methodFactory`) merges blueprint + runtime to compute per‑tick effects, costs and constraints (coverage, airflow, m³/h → ΔT, etc.).

---

## 9) Quick Checklist for Contributors

* [ ] Keys are camelCase, **no unit suffixes**.
* [ ] Use SI units; percentages are 0…1.
* [ ] Phase durations in **days**; device/harvest durations in **hours**.
* [ ] Strain & Device JSONs contain **no prices**; use separate price maps.
* [ ] Validate blueprints on load; fail fast.
* [ ] Respect physical limits (`coverageArea`, `airflow`, `coolingCapacity`).
* [ ] Keep tick order intact; commit state at the end of each tick.
* [ ] Emit telemetry events; never mutate core state from the UI side.

---

## 10) Glossary (select)

**PPFD**: Photosynthetic Photon Flux Density (µmol·m⁻²·s⁻¹).
**PPE**: Photosynthetic Photon Efficacy (µmol/J).
**LAI**: Leaf Area Index (dimensionless).
**CapEx**: Capital Expenditure (EUR); **OpEx**: Operating Expenses.

---

### Appendix A — Suggested JSON Schema stubs (informative)

*(Keep real schemas in `/schemas/*.json`; below is illustrative only.)*

```json
{
  "$id": "https://weed-breed.dev/schema/strain.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "name", "genotype", "chemotype", "environmentalPreferences"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string", "minLength": 1 },
    "lineage": {
      "type": "object",
      "properties": {
        "parents": { "type": "array", "items": { "type": "string", "format": "uuid" } }
      }
    },
    "genotype": {
      "type": "object",
      "properties": {
        "sativa": { "type": "number", "minimum": 0, "maximum": 1 },
        "indica": { "type": "number", "minimum": 0, "maximum": 1 },
        "ruderalis": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    }
  }
}
```
