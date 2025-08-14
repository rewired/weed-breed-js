# 🧾 Schema Documentation: Strain Prices (`strainPrices.json`)

This file documents the structure of `strainPrices.json`, where price information for each strain is managed.

---

## 📁 Structure

```json
{
  "strainPrices": {
    "uuid": {
      "seedPrice": number,
      "harvestPricePerGram": number
    }
  }
}
```

- `uuid`: unique strain ID (e.g., `"550e8400-e29b-41d4-a716-446655440000"`)
- Each entry contains:
  - `seedPrice`: Price per seed in EUR
  - `harvestPricePerGram`: Selling price per gram of dried flowers

---

## 📌 Fields in Detail

| Field                      | Type   | Required | Description                               |
|----------------------------|--------|----------|-------------------------------------------|
| `strainPrices`             | object | ✅       | Object with UUIDs as keys                 |
| `[uuid].seedPrice`         | number | ✅       | Price per seed (e.g., 0.50)               |
| `[uuid].harvestPricePerGram`| number | ✅       | Price per gram of harvest (e.g., 4.20)    |

---

## 🛡 Rules

- All prices must be ≥ 0
- UUIDs must match the format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- No other fields allowed
- Each entry must contain `seedPrice` **and** `harvestPricePerGram`

---

## 📦 Example

```json
{
  "strainPrices": {
    "550e8400-e29b-41d4-a716-446655440000": {
      "seedPrice": 0.5,
      "harvestPricePerGram": 4.2
    }
  }
}
```


---

## 📐 Runtime Price Calculation

The actual selling price is **not directly** derived from `harvestPricePerGram`,
but is modified by the `marketEngine` at the time of sale:

### 💰 Formula (simplified)

```
actualPricePerGram = harvestPricePerGram × qualityModifier
```

### 🔢 Example

- `harvestPricePerGram`: 4.2
- `quality`: 0.91
- → `actualPricePerGram`: 3.82
- → `totalRevenue`: actualPrice × dryWeight

### 🧠 Extensible (planned)

Other factors can be included later:

```
actualPrice = basePrice × quality × brandValue × marketDemand
```

This dynamic is processed at runtime during the sale –
`strainPrices.json` contains **only the maximum value at optimal quality**.


---

## 🔗 References

- See also: [`strain.json`](./strain_schema.md)
- Used by: `marketEngine.js`, `procurement.js`, `costEngine.js`
