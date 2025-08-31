// ESM helpers for savegames and derived views
import fs from 'node:fs'
import path from 'node:path'

export function getDefaultSavePath() {
  return path.resolve(process.cwd(), 'data', 'savegames', 'default.json')
}

export function ensureSampleSave(filePath = getDefaultSavePath()) {
  if (fs.existsSync(filePath)) return
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const sample = {
    meta: { id: 'save-default-001', createdAt: new Date().toISOString(), version: 1 },
    structure: {
      rooms: [{
        id: 'room_a_grow',
        name: 'Grow Room A',
        zones: [
          { id: 'zone_a1_ak47', name: 'Zone A1 (AK-47)', simulation: { strainId: '550e8400-e29b-41d4-a716-446655440000', methodId: 'sog' } },
          { id: 'zone_a2_ww',   name: 'Zone A2 (White Widow)', simulation: { strainId: '550e8400-e29b-41d4-a716-446655440001', methodId: 'scrog' } }
        ]
      }]
    },
    metrics: { harvests: 0 }
  }
  fs.writeFileSync(filePath, JSON.stringify(sample, null, 2), 'utf8')
}

export function loadWorldFromFile(filePath = getDefaultSavePath()) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

export function computeSummary(world) {
  const rooms = world?.structure?.rooms ?? []
  const roomCount = rooms.length
  let zoneCount = 0
  let plantCount = 0 // echte Pflanzeninstanzen sind im Save nicht vorhanden → 0
  for (const r of rooms) zoneCount += (r?.zones ?? []).length
  const harvests = Number(world?.metrics?.harvests ?? 0)
  return { rooms: roomCount, zones: zoneCount, plants: plantCount, harvests }
}

function humanizeMethod(id) {
  const m = String(id || '').toLowerCase()
  if (m === 'sog') return 'SOG'
  if (m === 'scrog') return 'SCROG'
  return m || '—'
}

function labelFromZoneName(name, fallback) {
  const m = /\(([^)]+)\)/.exec(String(name || ''))
  return m?.[1] || fallback || '—'
}

/** Derive structure snapshot for UI: rooms → zones (with strain/method labels) */
export function computeSnapshot(world) {
  const rooms = world?.structure?.rooms ?? []
  const outRooms = []
  for (const r of rooms) {
    const zones = r?.zones ?? []
    const outZones = zones.map((z) => {
      const sim = z?.simulation || {}
      const strainId = sim.strainId || null
      const strainLabel = labelFromZoneName(z?.name, strainId)
      const methodId = sim.methodId || null
      const methodLabel = humanizeMethod(methodId)
      return {
        id: z.id, name: z.name,
        strainId, strainLabel,
        methodId, methodLabel,
      }
    })
    outRooms.push({ id: r.id, name: r.name, zones: outZones })
  }
  return { rooms: outRooms }
}
