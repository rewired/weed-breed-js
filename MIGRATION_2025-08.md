# Migration Guide 2025-08

This release harmonizes field names across blueprints, prices and code.

## Renamed Fields

| Old | New |
|-----|-----|
| `veg_days` | `photoperiod.vegetationDays` |
| `bloom_days` / `flower_days` | `photoperiod.floweringDays` |
| `floweringTime.shortestDurationInDays` | `harvestWindowInDays[0]` |
| `floweringTime.longestDurationInDays` | `harvestWindowInDays[1]` |
| `mtbf_hours` / `mtbfInHours` | `lifespanInHours` |
| `maintenance` (device blueprint) | moved to `data/devicePrices.json` |
| `data/config/devicePrices.json` | `data/devicePrices.json` |
| `data/config/strainPrices.json` | `data/strainPrices.json` |

## Notes

* Units are implicit; no unit suffixes are used in key names.
* Device pricing now resides in `data/devicePrices.json` keyed by `deviceId`.
