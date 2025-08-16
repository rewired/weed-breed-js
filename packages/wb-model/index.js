// ESM – keine Sim-Logik!
export { default as strainSchema } from "./schemas/strain.schema.json" assert { type: "json" };
export { default as deviceSchema } from "./schemas/device.schema.json" assert { type: "json" };
export { default as cultivationMethodSchema } from "./schemas/cultivation_method.schema.json" assert { type: "json" };
export { default as strainPricesSchema } from "./schemas/strainPrices.schema.json" assert { type: "json" };
// Optional: konstante Konventionen, Validator-Fabrik:
export { envConventions } from "./constants/env.js";
export { createValidator } from "./runtime/validate.js";
