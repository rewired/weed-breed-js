# 🌱 Weed Breed – Architecture and System Guide

> Status: Skeleton phase, all design decisions aligned and established.
> **Note:** This document describes the intended architecture and features of the project. Some of these features may not be fully implemented yet.

---

## 🎯 Core Principles

- **Tick-based simulation** (no real-time progression)
- **Loose coupling via event system**
- **Modular structure (Factories + JSON configuration)**
- **Clear cost model with CapEx, OpEx, Labor**
- **Player decisions over time pressure**
- **Multiplayer optional, but strategically prepared**

---

## 🧱 World Structure

### Hierarchy

```
Building → Rooms → Zones → Plants
```

### Rooms

- Have area (m²) and height (m)
- Get their behavior via `roomType`
- Types: e.g., `grow-chamber`, `cooling-storage`, `sales-room`
- Sales rooms have access to storage (no transfer costs)

### Room Types (Examples)

```json
{
  "id": "sales-room",
  "isSalesRoom": true,
  "areaCost": 5.0,
  "energyPerSquareMeterPerHour": 0.1,
  "baseRentPerTick": 2.0,
  "advertisingPerTick": 1.0,
  "maxProductsVisible": 5
}
```

---

## 🌾 Plants & Genetics

- Plants are based on strains from `data/strains/`
- Two types of strains:
  - `ak-47.json` (Original plants, descriptive names)
  - `[uuid].json` (Breeds, automatically generated)
- Genetics fields: `genotype`, `resistance`, `chemotype`, `morphology`, `lineage.parents`
- Genetics logic prepared, but still inactive
- Strain market and licensing strategically planned

---

## ⚙ Devices

- Base class `BaseDevice` + JSON configuration
- Specialized devices via subclasses (`lamp.js`, `ac.js`, ...)
- Consumption per hour, effect per tick
- Device efficiency, maintenance costs, lifespan

---

## 💧 Resource Consumption

- Plants: Consumption **per day** → converted to per tick
- Devices: Consumption **per hour** → converted to per tick
- Tick duration: `tickLengthInHours` (Standard e.g., 3h)
- Resource prices configured in `data/config/prices.json`

---

## 🛠 Labor Costs & Personnel

- Labor time for all actions: Seed, Harvest, Training, Sales
- Personnel configurable via `data/personnel/`
- Example:

```json
{
  "id": "harvester",
  "hourlyWage": 18.0,
  "maxMinutesPerTick": 480,
  "efficiency": { "plant.harvest": 1.0 }
}
```

- Job assignment via `personnel.js`
- Wage costs calculated via `costEngine`

---

## 🛒 Economic System

- CapEx: Device acquisition
- OpEx: Resource consumption, maintenance, rent, labor
- Revenue: Harvest sales (later: seed trading)
- Balance per tick: `netResult = revenue - expenses`
- Sales mechanics:
  - Sales room must exist
  - Access to storage without transfer
  - `marketEngine.js` handles sales per tick

---

## 📦 Storage & Logistics

- Central inventory, no internal distribution effort
- Expiration via `expiresAtTick`, shelf-life per product
- Storage location check via room type (`cooling-storage` vs. `storage-default`)
- Space requirement = 0, prepared for later

---

## 📈 Marketplace & Multiplayer

- Player ID: `playerId`
- Strains have `createdBy`, `createdAtTick`
- Seed market prepared (strain supply, licensing, royalties)
- No real-time multiplayer → focus on asynchronous economy

---

## 🏷 Branding & Reputation (prepared)

```json
"reputation": {
  "qualityScore": 0.87,
  "deliveryScore": 0.95,
  "brandValue": 1.42
}
```

- Brand value influences sales prices (later)
- Quality & reliability are factored in

---

## 🧪 Not Included (intentionally)

- Real-time logic (rejected)
- Internal distribution (removed)
- Legal limits / regulation (excluded)
- UI / real-time control (not part of the core)


---

## 🧱 Architectural Principle: Base Classes + Factory Pattern

- All core components (Plant, Device, Room, Zone, Personnel) are based on **base classes**
- The corresponding **factories** read the JSON configurations and create specialized instances at runtime
- Example: `LampFactory` creates a `Lamp` instance based on `lamp-hps-1000.json`
- Parameters like **area**, **room height**, **number of zones**, **tick duration**, etc., are **passed only at runtime**
- This makes the system completely:
  - dynamic
  - testable
  - saveable
  - extensible

### Example Flow for Device Initialization

1. `deviceFactory.load('lamp-hps-1000.json')`
2. Passed to `new Lamp(config, runtimeContext)`
3. Instance knows:
   - static parameters from JSON
   - dynamic parameters from simulation (`zoneSize`, `tickLengthInHours`, etc.)
4. Device can correctly calculate effect, costs, and maintenance

→ This pattern applies analogously to:
- Rooms → `roomFactory`
- Plants → `strainFactory`
- Personnel → `personnelFactory`
- Breeds → later `breedingEngine`

---


---

## 🔠 Naming Conventions


> 🔗 For units and field names, the separate reference file applies:
> [`naming_conventions.md`](./naming_conventions.md)


For all identifiers in JSON files, data models, and code, there are clearly defined rules for format, SI units, naming, and structure.

➡ See separate reference file: [`naming_conventions.md`](./naming_conventions.md)



---

## 📏 Uniform Tick and Unit Conventions

In Weed Breed, the following implicit unit and time conventions apply to all simulation elements:

### ⏱ Time
| Context                  | Unit       |
|--------------------------|------------|
| `lifespan`               | Hours      |
| `ripeningTime`           | Hours      |
| `floweringDays` etc.     | Days       |
| `baseCost` (Devices)     | **per tick** (e.g., 3h) |
| `maintenance.costIncreasePer1000` | per 1000 ticks |

> The actual tick duration is centrally defined in the simulation, e.g., `tickLengthInHours = 3`.

### ⚙ Power & Consumption
| Field          | Unit       | Comment |
|----------------|------------|---------|
| `power`        | kW         | Kilowatt |
| `ppfd`         | µmol/m²·s  | Light intensity |
| `coverageArea` | m²         | Coverage area |
| `airflow`      | m³/h       | Airflow rate |

### 💸 Economics
| Field        | Unit    | Comment |
|--------------|---------|-----------|
| `capitalExpenditure` | EUR     | Investment |
| `baseCost`           | EUR     | per tick (implicit) |

### 🔍 Conventions
- No explicit units in the key (e.g., no `_in_hours`, `_kw`, `_eur`)
- SI units are implicitly valid project-wide
- Where possible, the **unit is inferred from the name choice**
- Time references are standardized and uniformly configured in the simulation

---


---

## 📂 Project Structure (recommended)


```
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

> 🧭 This file serves as the basis for the skeleton setup and later expansion steps.
