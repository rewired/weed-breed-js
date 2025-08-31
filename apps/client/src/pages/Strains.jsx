import React from 'react'
import StrainEditor from '@/components/StrainEditor.jsx'

export default function StrainsPage() {
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Strain Editor</h2>
      <p style={{ opacity: 0.8 }}>Create, validate and tweak strains (JSON Schema 2020-12).</p>
      <StrainEditor />
    </div>
  )
}
