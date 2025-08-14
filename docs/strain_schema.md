# 📄 Schema Documentation: Strain Definition (`strain.json`)

This file documents the complete structure of a `strain.json` as used in Weed Breed.

---

## 🧬 Master Data

| Key               | Type     | Description              |
|-------------------|----------|--------------------------|
| `id`              | string   | UUID of the strain       |
| `name`            | string   | Display name             |
| `lineage.parents` | string[] | UUIDs of the parent strains |

---

## 🧬 Genetics

| Key                  | Type         | Description                   |
|----------------------|--------------|-------------------------------|
| `genotype.sativa`    | number (0–1) | Sativa proportion             |
| `genotype.indica`    | number (0–1) | Indica proportion             |
| `genotype.ruderalis` | number (0–1) | Ruderalis proportion          |
| `generalResilience`  | number (0–1) | General resilience            |

---

## 💊 Chemotype

| Key                  | Type         | Description                   |
|----------------------|--------------|-------------------------------|
| `chemotype.thcContent` | number (0–1) | THC content                   |
| `chemotype.cbdContent` | number (0–1) | CBD content                   |

---

## 🌿 Morphology

| Key                     | Type   | Description                         |
|-------------------------|--------|-------------------------------------|
| `morphology.growthRate` | number | Growth rate                         |
| `morphology.yieldFactor`| number | Yield factor                        |
| `morphology.leafAreaIndex`| number | Ratio of leaf area to ground area |

---

## 🌡 Environmental Preferences

### Light, Temperature, Humidity, pH

- Light ranges in nm
- Intensity in µmol/(m²·s)
- Humidity as a decimal number (0.6 = 60%)

```json
"environmentalPreferences": {
  "lightSpectrum": {
    "vegetation": [400, 700],
    "flowering": [300, 650]
  },
  "lightIntensity": {
    "vegetation": [400, 600],
    "flowering": [600, 1000]
  },
  "lightCycle": {
    "vegetation": [18, 6],
    "flowering": [12, 12]
  },
  "idealTemperature": {
    "vegetation": [20, 28],
    "flowering": [22, 30]
  },
  "idealHumidity": {
    "vegetation": [0.60, 0.70],
    "flowering": [0.50, 0.60]
  },
  "phRange": [5.8, 6.2]
}
```

---

## 🧪 Nutrient Demand (`nutrientDemand`)

| Key                   | Type   | Description                        |
|-----------------------|--------|------------------------------------|
| `dailyNutrientDemand` | object | Nutrient demand per phase          |
| `npkTolerance`        | number | Tolerance for NPK deviation        |
| `npkStressIncrement`  | number | Stress increase due to NPK deficiency |

---

## 💧 Water Demand (`waterDemand`)

| Key                             | Type   | Description                           |
|---------------------------------|--------|---------------------------------------|
| `dailyWaterUsagePerSquareMeter` | object | Daily consumption per m²              |
| `minimumFractionRequired`       | number | Minimum water availability (0–1)      |

---

## 🦠 Disease Resistance (`diseaseResistance`)

| Key                       | Type   | Description                         |
|---------------------------|--------|-------------------------------------|
| `dailyInfectionIncrement` | number | Basal infection increase per day    |
| `infectionThreshold`      | number | Threshold for symptom appearance    |
| `recoveryRate`            | number | Self-healing rate                   |
| `degenerationRate`        | number | Growth loss due to disease          |
| `regenerationRate`        | number | Recovery under optimal conditions   |
| `fatalityThreshold`       | number | Threshold at which the plant dies   |

---

## 📆 Photoperiod (`photoperiod`)

| Key                       | Type   | Description                           |
|---------------------------|--------|---------------------------------------|
| `vegetationDays`          | number | Duration of the vegetative phase      |
| `floweringDays`           | number | Duration of the flowering phase       |
| `transitionTriggerHours`  | number | Light switching threshold (h)         |

---

## 💸 Economics (`floweringTime`)

| Key                        | Type   | Description                           |
|----------------------------|--------|---------------------------------------|
| `shortestDurationInDays`  | number | Earliest harvest time                 |
| `longestDurationInDays`   | number | Latest harvest time                   |

---

## 🌾 Harvest Properties (`harvestProperties`)

| Key                       | Type   | Description                         |
|---------------------------|--------|-------------------------------------|
| `ripeningTimeInHours`     | number | Ripening time                       |
| `maxStorageTimeInHours`   | number | Shelf life                          |
| `qualityDecayPerHour`     | number | Quality loss per hour               |

---

## 🧾 Description Level (`meta`)

| Field           | Type     | Description                               |
|-----------------|----------|-------------------------------------------|
| `description`   | string   | Story, origin, or special features        |
| `advantages`    | string[] | Advantages in cultivation or market       |
| `disadvantages` | string[] | Disadvantages or special requirements     |
| `notes`         | string   | Cultivation tips or recommendations       |
