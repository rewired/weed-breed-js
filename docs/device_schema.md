# 📄 Schema Documentation: Device (`device.json`)

This schema describes the structure for device objects in Weed Breed.
Each device has a UUID as its `id` and is loaded via a central factory.

---

## 🆔 Base Fields

| Field        | Type    | Description                               |
|--------------|---------|-------------------------------------------|
| `id`         | string  | UUID of the device                        |
| `kind`       | string  | Device type (e.g., `ClimateUnit`, `Lamp`) |
| `name`       | string  | Display name for UI usage                 |
| `quality`    | number  | Quality factor (0–1)                      |
| `complexity` | number  | Complexity value for setup/maintenance    |
| `mtbf_hours` | number  | *Mean Time Between Failures* (in hours)   |

---

## ⚙ Device Settings

```json
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
```

- The fields in `settings` are **device-dependent**
- Units follow the conventions from [`naming_conventions.md`](./naming_conventions.md)

---

## 🧾 Description Level (`meta`)

```json
"meta": {
  "description": "…",
  "advantages": [ "…" ],
  "disadvantages": [ "…" ],
  "notes": "…"
}
```

| Field           | Type     | Description                                  |
|-----------------|----------|----------------------------------------------|
| `description`   | string   | Purpose and use of the device                |
| `advantages`    | string[] | Operational advantages                       |
| `disadvantages` | string[] | Disadvantages or limitations                 |
| `notes`         | string   | Technical or strategic notes (opt.)        |

---

## ❌ Not Included

The following fields are **not** stored in the device but are externalized to `devicePrices.json`:

| Field                      | Reason                                |
|----------------------------|---------------------------------------|
| `capitalExpenditure`       | Market value, not a device parameter  |
| `baseMaintenanceCostPerTick`| Economic factor                       |
| `costIncreasePer1000Ticks` | Maintenance model → external control  |

→ This separation allows for pricing logic, offers, and balancing **without changing the device definition**.

---

## 🧱 Example (Climate Unit)

```json
{
  "id": "7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b",
  "kind": "ClimateUnit",
  "name": "CoolAir Split 3000",
  "quality": 0.9,
  "complexity": 0.4,
  "mtbf_hours": 35040,
  "settings": {
    "power": 1.2,
    "coolingCapacity": 1.6,
    "airflow": 350,
    "targetTemperature": 24,
    "targetTemperatureRange": [
      18,
      30
    ],
    "coolingEfficiency": 0.05,
    "maxCooling": 0.4,
    "hysteresisK": 0.5,
    "fullPowerAtDeltaK": 5
  },
  "meta": {
    "description": "High-performance climate control unit for closed growing environments. Provides targeted cooling with moderate energy usage and solid airflow.",
    "advantages": [
      "Effective cooling for medium-sized rooms",
      "Reliable airflow distribution",
      "Energy-efficient at moderate loads"
    ],
    "disadvantages": [
      "Higher maintenance costs over time",
      "Limited precision for multi-zone systems"
    ],
    "notes": "Recommended for vegetative and early flowering stages in temperate climates."
  }
}
```