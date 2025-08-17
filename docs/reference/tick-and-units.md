# Tick and Unit Conventions

All simulation elements operate on a uniform tick length. Duration per tick is defined in the engine configuration.

## Time

| Context | Unit |
| ------- | ---- |
| `lifespan` | Hours |
| `ripeningTime` | Hours |
| `floweringDays` etc. | Days |
| `baseCost` | Per tick |

## Power and Area

| Field | Unit |
| ----- | ---- |
| `power` | Kilowatt (kW) |
| `ppfd` | µmol/m²·s |
| `coverageArea` | Square meter (m²) |
| `airflow` | Cubic meters per hour (m³/h) |

## Economics

| Field | Unit |
| ----- | ---- |
| `capitalExpenditure` | EUR |
| `baseCost` | EUR per tick |

These conventions are referenced across the documentation.
