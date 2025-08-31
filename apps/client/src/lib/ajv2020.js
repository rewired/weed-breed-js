// Central Ajv instance for JSON Schema Draft 2020-12 (ESM + Vite)
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import meta2020 from 'ajv/dist/refs/json-schema-2020-12.json'

/**
 * Create a single Ajv instance for the whole app.
 * - Draft 2020-12 with the meta schema explicitly registered
 * - Common formats enabled
 * - Non-strict: we validate content, not police the schema itself
 */
const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
})

ajv.addMetaSchema(meta2020)
addFormats(ajv)

export default ajv
