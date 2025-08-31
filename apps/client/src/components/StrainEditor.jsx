import React, { useMemo, useState } from 'react'
import ajv from '@/lib/ajv2020.js'
import { registerSchemas, compileWith } from '@/lib/schemaRegistry.js'

// Root schema (no import attributes)
import strainSchema from '@/schemas/strain.schema.json'

// If your strain schema $ref other local schemas, import them here (no assert)
// Example (uncomment/adjust if present):
// import deviceSchema from '@/schemas/device.schema.json'
// import cultivationMethodSchema from '@/schemas/cultivation_method.schema.json'
// registerSchemas(ajv, deviceSchema, cultivationMethodSchema)

const validate = compileWith(ajv, strainSchema)

const exampleValid = {
  id: 'strain-demo-1',
  name: 'Demo Strain',
  genotype: { sativa: 0.4, indica: 0.6, ruderalis: 0.0 },
  chemotype: { thcContent: 18, cbdContent: 0.5 },
  morphology: { growthRate: 1.0, yieldFactor: 1.0, leafAreaIndex: 2.0 },
  environmentalPreferences: {
    idealTemperature: { vegetation: [22, 28], flowering: [22, 28] },
    idealHumidity: { vegetation: [0.5, 0.65], flowering: [0.5, 0.65] },
  },
  vegetationDays: 21,
  floweringDays: 56,
}

const exampleInvalid = { id: 123, name: null }

export default function StrainEditor() {
  const [raw, setRaw] = useState(JSON.stringify(exampleValid, null, 2))

  const result = useMemo(() => {
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, errors: [{ message: 'JSON parse error in editor' }] }
    }
    const ok = validate(parsed)
    return { ok, errors: ok ? [] : (validate.errors ?? []) }
  }, [raw])

  return (
    <div style={wrap}>
      <h2 style={{ margin: 0 }}>Strain Editor (AJV 2020-12)</h2>
      <div style={row}>
        <div style={col}>
          <div style={label}>JSON</div>
          <textarea style={ta} value={raw} onChange={(e) => setRaw(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => setRaw(JSON.stringify(exampleValid, null, 2))}>Load valid</button>
            <button onClick={() => setRaw(JSON.stringify(exampleInvalid, null, 2))}>Load invalid</button>
          </div>
        </div>
        <div style={col}>
          <div style={label}>Validation</div>
          <p>
            Valid:{' '}
            <b style={{ color: result.ok ? 'green' : 'crimson' }}>
              {String(result.ok)}
            </b>
          </p>
          {!result.ok && <pre style={pre}>{JSON.stringify(result.errors, null, 2)}</pre>}
        </div>
      </div>
    </div>
  )
}

const wrap = { fontFamily: 'system-ui, sans-serif', padding: 12, lineHeight: 1.4 }
const row = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }
const col = { display: 'flex', flexDirection: 'column' }
const label = { fontSize: 12, opacity: 0.7, margin: '8px 0' }
const ta = {
  minHeight: 260,
  fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  fontSize: 12,
  padding: 8,
}
const pre = {
  background: '#0b0e14',
  color: '#d6deeb',
  padding: 12,
  borderRadius: 8,
  fontSize: 12,
  maxHeight: 320,
  overflow: 'auto',
}
