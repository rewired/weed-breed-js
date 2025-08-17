# Data model overview
### Hierarchical structure

__Structure__ – top-level facility with total usable area, default height and base rent; holds multiple rooms

__Room__ – child of a structure with its own area, height, base cost and a list of zones

__Zone__ – operational unit containing plants and devices, references runtime services, and keeps environment state updated each tick
Environment state

ensureEnv establishes mutable zone environment fields such as temperature, humidity, ppfd, co2ppm, moistureKg, nutrient reservoir N/P/K, plus aggregates for heat, water and CO₂ deltas

### Plant model

Each plant has identity (id, label), location (zoneId), geometry (area_m2, leafAreaIndex), life-cycle attributes (stage, ageHours), genetics/method references, and a biomass state with partitioned dry/fresh mass

Strain blueprints supply genetics, growth model parameters, environmental preferences, nutrient and water demand, photoperiod and harvest properties used by plants
Devices

BaseDevice captures common fields (id, kind, name, quality, complexity, settings), merges runtime overrides safely, and includes failure/energy tracking logic

Blueprint JSONs define device-specific settings:

Example lamp with power, PPFD, coverage and heat fraction

Example climate unit with cooling capacity, airflow and temperature setpoints/ranges
Cultivation method

Method blueprints specify layout/equipment constraints (areaPerPlant, minimumSpacing, containerSpec), setup costs, labor intensity, strain compatibility rules, and ideal environmental ranges

Savegame configuration

Demonstrates full hierarchy and references: structure → rooms → zones with strain/method IDs and device blueprint counts/overrides

Summary

The simulation models a facility hierarchy (Structure → Room → Zone) populated with Plants and Devices. Plants derive their behavior and lifecycle from strain blueprints, while zones maintain environmental state influenced by device effects and plant feedback. Device and cultivation-method blueprints provide configurable parameters, with price maps and difficulty settings (not shown) enriching economic and challenge aspects.