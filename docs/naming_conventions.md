# 🧾 Naming Conventions – Weed Breed

> This file accompanies the *Weed Breed* architecture guide and serves as a binding reference for all identifiers in JSON files, data models, and code.

---

## 📌 General Rules

| Rule                                        | Example                          |
|---------------------------------------------|----------------------------------|
| `camelCase` for all keys                    | `photosyntheticPhotonFluxDensity`|
| **No unit suffixes** (`_eur`, `_kw`)        | `powerInKilowatts`, not `power_kw` |
| SI units are **implicitly agreed upon**     | Temperature = °C, Water = Liters |
| Full text instead of abbreviations          | `vegetationDays` instead of `veg_days` |
| Quantities clearly normalized: **per day / hour** | `dailyWaterUsagePerSquareMeter`, `powerConsumptionPerHour` |
| Time specifications: always in **days** or **hours** | e.g., `lifespanInHours`          |
| Percentage values in the range 0–1          | e.g., `humidity = 0.65` (≙ 65%)    |

---

## 🔁 Specific Renames (Old → New)

| Old                         | New                                       | Unit / Meaning                        |
|-----------------------------|-------------------------------------------|---------------------------------------|
| `veg_days`                  | `vegetationDays`                          | Days                                  |
| `bloom_days`                | `floweringDays`                           | Days                                  |
| `power_kw`                  | `powerInKilowatts`                        | kW                                    |
| `efficiency_ppfd`           | `photosyntheticPhotonFluxDensity`         | µmol/(m²·s)                           |
| `coverage_m2`               | `coverageArea`                            | Square meters                         |
| `maintenance_curve.base_eur_per_hour` | `maintenanceCostPerHour`             | €                                     |
| `seed_cost_eur`             | `seedPrice`                               | €                                     |
| `usage_l_per_m2_h`          | `dailyWaterUsagePerSquareMeter`           | Liters per m² per day                 |
| `ideal_temp_c`              | `idealTemperature`                        | °C, range                             |
| `ideal_humidity_pct`        | `idealHumidity`                           | %, range                              |
| `cycle_h`                   | `lightCycle`                              | Hours light/dark                      |
| `npk_tolerance`             | `npkTolerance`                            | Difference allowed (absolute)         |
| `npk_stress_inc`            | `npkStressIncrement`                      | Stress increase on exceedance         |
| `yield_factor`              | `yieldFactor`                             | Multiplier                            |
| `leaf_area_index`           | `leafAreaIndex`                           | Ratio of leaf area / ground area      |
| `lifespan_hours`            | `lifespanInHours`                         | Hours                                 |
| `base_eur_per_hour`         | `baseMaintenanceCostPerHour`              | €                                     |

---

## 🧱 Structure Examples

### Light Spectrum

```json
"lightSpectrum": {
  "vegetation": [400, 700],
  "flowering": [300, 650]
}
```

### Nutrients

```json
"dailyNutrientDemand": {
  "vegetation": { "nitrogen": 1.2, "phosphorus": 0.6, "potassium": 1.0 },
  "flowering": { "nitrogen": 0.7, "phosphorus": 1.4, "potassium": 1.6 }
}
```

### Temperature Range

```json
"idealTemperature": {
  "vegetation": [20, 28],
  "flowering": [22, 30]
}
```

---

## 📎 References

This file is referenced by the architecture guide:
→ [`architectural_guide.md`](./architectural_guide.md)

---

## 📏 Uniform Tick and Unit Conventions

The following implicit units and time references apply in all JSON structures:

### Time Specifications

| Field                | Unit       | Comment                     |
|----------------------|------------|-----------------------------|
| `lifespan`           | Hours      | Lifespan                    |
| `ripeningTime`       | Hours      | Ripening time               |
| `floweringDays` etc. | Days       | Phase specifications        |
| `baseCost`           | EUR / Tick | Maintenance cost per tick   |

→ Tick duration is centrally defined (e.g., `tickLengthInHours = 3`).

### Power and Area

| Field          | Unit                      |
|----------------|---------------------------|
| `power`        | Kilowatt (kW)             |
| `ppfd`         | µmol/m²·s                 |
| `coverageArea` | Square meter (m²)         |
| `airflow`      | Cubic meters per hour (m³/h) |

### Economics

| Field                | Unit     |
|----------------------|----------|
| `capitalExpenditure` | EUR      |
| `baseCost`           | EUR/Tick |

### Rules

- No units in field names (no `_eur`, `_kw`, `_celsius`, `_hours`)
- SI units are implicitly valid project-wide
- Tick time reference is uniform system-wide
