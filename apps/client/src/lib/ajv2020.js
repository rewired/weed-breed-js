// Central Ajv instance for JSON Schema Draft 2020-12 (ESM + Vite)
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'

/**
 * Ajv2020 already includes draft-2020-12 support.
 * We intentionally DO NOT import any meta JSON from node_modules
 * to avoid Vite dependency scan issues with deep JSON imports.
 */
const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
})

// Enable common formats (email, uri, date-time, etc.)
addFormats(ajv)

export default ajv
