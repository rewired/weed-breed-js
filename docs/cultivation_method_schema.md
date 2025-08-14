# 📄 Schema Documentation: Cultivation Method (`cultivation_method.json`)

This document describes the structure of a cultivation method (e.g., Sea of Green, SCROG, Vertical Farming) in the *Weed Breed* project.

---

## 🆔 Base Fields

| Field            | Type    | Description                                |
|------------------|---------|--------------------------------------------|
| `id`             | string  | Unique ID of the method                    |
| `kind`           | string  | Must be `"CultivationMethod"`              |
| `name`           | string  | Plain text name for display                |
| `setupCost`      | number  | One-time setup costs (in EUR)              |
| `laborIntensity` | number  | Labor intensity (0–1)                      |
| `areaPerPlant`   | number  | Required area per plant (in m²)            |
| `minimumSpacing` | number  | Minimum plant spacing (in m)               |
| `maxCycles`      | number  | Maximum reuse (rotations)                  |

---

## 🌱 Substrate

```json
"substrate": {
  "type": "soil",
  "costPerSquareMeter": 3.5,
  "maxCycles": 2
}
```

| Field                 | Type    | Description                           |
|-----------------------|---------|---------------------------------------|
| `type`                | string  | Substrate type (e.g., `soil`, `coco`) |
| `costPerSquareMeter`  | number  | Cost per m²                           |
| `maxCycles`           | number  | Maximum reuse                         |

---

## 🧺 Container (`containerSpec`)

```json
"containerSpec": {
  "type": "pot",
  "volumeInLiters": 11,
  "footprintArea": 0.20,
  "reusableCycles": 6,
  "costPerUnit": 2.0,
  "packingDensity": 0.95
}
```

| Field            | Type    | Description                                  |
|------------------|---------|----------------------------------------------|
| `type`           | string  | Container shape/system                       |
| `volumeInLiters` | number  | Nominal volume per container (L)             |
| `footprintArea`  | number  | Actual footprint per container (m²)          |
| `reusableCycles` | number  | Number of reuses                             |
| `costPerUnit`    | number  | Purchase price per unit (EUR)                |
| `packingDensity` | number  | Packing factor 0–1; losses due to edges/paths|

**Relation to `areaPerPlant`:**
- `areaPerPlant` is the standard area including spacing
- `footprintArea` is the real footprint
- `packingDensity` accounts for edge and path losses

---

## 🧬 Strain Compatibility

```json
"strainTraitCompatibility": {
  "preferred": {
    "genotype.indica": { "min": 0.5 }
  },
  "conflicting": {
    "genotype.sativa": { "min": 0.5 }
  }
}
```

| Section       | Description                                                |
|---------------|------------------------------------------------------------|
| `preferred`   | Preferred traits (`min`/`max` for strain fields)         |
| `conflicting` | Exclusion criteria or unsuitable traits                    |

---

## 🌡 Environmental Conditions

```json
"idealConditions": {
  "idealTemperature": [22, 28],
  "idealHumidity": [0.5, 0.65]
}
```

| Field            | Type      | Unit          | Description                      |
|------------------|-----------|---------------|----------------------------------|
| `idealTemperature`| number[2] | °C            | Ideal range                      |
| `idealHumidity`  | number[2] | 0–1 (≙ %/100) | Ideal range of air humidity      |

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

| Field           | Type      | Description                               |
|-----------------|-----------|-------------------------------------------|
| `description`   | string    | Text description of the method            |
| `advantages`    | string[]  | Advantages                                |
| `disadvantages` | string[]  | Disadvantages                             |
| `notes`         | string    | Additional notes                          |

---

## 📌 Notes

- SI-compliant units
- No unit suffixes in keys
- Tick reference not included (methods are static)

---

## 🧱 Example

```json
{
  "id": "sog",
  "kind": "CultivationMethod",
  "name": "Sea of Green",
  "setupCost": 10.0,
  "laborIntensity": 0.4,
  "areaPerPlant": 0.25,
  "minimumSpacing": 0.25,
  "maxCycles": 2,
  "substrate": {
    "type": "soil",
    "costPerSquareMeter": 3.5,
    "maxCycles": 2
  },
  "containerSpec": {
    "type": "pot",
    "volumeInLiters": 11,
    "footprintArea": 0.20,
    "reusableCycles": 6,
    "costPerUnit": 2.0,
    "packingDensity": 0.95
  },
  "strainTraitCompatibility": {
    "preferred": {
      "genotype.indica": { "min": 0.5 },
      "photoperiod.vegetationDays": { "max": 21 }
    },
    "conflicting": {
      "genotype.sativa": { "min": 0.5 },
      "photoperiod.vegetationDays": { "min": 28 }
    }
  },
  "idealConditions": {
    "idealTemperature": [22, 28],
    "idealHumidity": [0.5, 0.65]
  },
  "meta": {
    "description": "Sea of Green (SOG) is a high-density cultivation method where many small plants are grown close together to quickly fill a canopy.",
    "advantages": [
      "Shorter grow cycles",
      "Efficient use of space",
      "Lower training effort"
    ],
    "disadvantages": [
      "More plants to manage",
      "Legal limitations in plant count (IRL)",
      "Not suitable for large or tall plants"
    ]
  }
}
```