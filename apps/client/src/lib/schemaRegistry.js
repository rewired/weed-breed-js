/**
 * Helpers to manage local JSON Schemas with Ajv.
 * Keep all schemas local; don't use remote $ref.
 */

/**
 * @param {import('ajv').default} ajv
 * @param  {...any} schemas One or more JSON schema objects
 */
export function registerSchemas(ajv, ...schemas) {
  for (const s of schemas) {
    if (s && typeof s === 'object') ajv.addSchema(s)
  }
}

/**
 * @param {import('ajv').default} ajv
 * @param {object} schema Root schema to compile
 */
export function compileWith(ajv, schema) {
  try {
    return ajv.compile(schema)
  } catch (err) {
    // Surface clear hint if $id/$ref mismatch is the cause
    const msg = `[ajv] Failed to compile schema: ${err?.message || err}`
    console.error(msg)
    throw err
  }
}
