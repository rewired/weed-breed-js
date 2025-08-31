// ESM helper to load/save a "world" from JSON and compute derived views.
import fs from 'node:fs'
import path from 'node:path'

/** Absolute default save path (cwd/data/savegames/default.json) */
export function getDefaultSavePath() {
  return path.resolve(process.cwd(), 'data', 'savegames', 'default.json')
}

/** Ensure a sample savegame exists at the target path (idempotent). */
export function ensureSampleSave(filePath = getDefaultSavePath()) {
  if (fs.existsSync(filePath)) return
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const sample = {
    meta: { id: 'save-default-001', createdAt: new Date().toISOString(), version: 1 },
    structure: {
      rooms: [
        {
          id: 'room-A',
          name: 'Room A',
          zones: [
            {
              id: 'zone-A1',
              name: 'A1',
              plants: [
                { id: 'plant-001', strainId: 'strain-demo-1', stage: 'vegetation' },
                { id: 'plant-002', strainId: 'strain-demo-1', stage: 'vegetation' }
              ]
            },
            {
              id: 'zone-A2',
              name: 'A2',
              plants: [
                { id: 'plant-003', strainId: 'strain-demo-1', stage: 'flowering' }
              ]
            }
          ]
        }
      ]
    },
    metrics: { harvests: 0 }
  }
  fs.writeFileSync(filePath, JSON.stringify(sample, null, 2), 'utf8')
}

/** Load a world JSON from disk. Throws on error. */
export function loadWorldFromFile(filePath = getDefaultSavePath()) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const world = JSON.parse(raw)
  return world
}

/** Compute a simple summary for dashboard counters. */
export function computeSummary(world) {
  const rooms = world?.structure?.rooms ?? []
  const roomCount = rooms.length
  let zoneCount = 0
  let plantCount = 0
  for (const r of rooms) {
    const zones = r?.zones ?? []
    zoneCount += zones.length
    for (const z of zones) {
      const plants = z?.plants ?? []
      plantCount += plants.length
    }
  }
  const harvests = Number(world?.metrics?.harvests ?? 0)
  return { rooms: roomCount, zones: zoneCount, plants: plantCount, harvests }
}

/**
 * Compute a lightweight structure snapshot for UI lists.
 * Includes rooms, zones, per-zone plant count and dominant phase.
 */
export function computeSnapshot(world) {
  const rooms = world?.structure?.rooms ?? []
  const outRooms = []
  for (const r of rooms) {
    const zones = r?.zones ?? []
    const outZones = zones.map((z) => {
      const plants = z?.plants ?? []
      const count = plants.length
      // derive a simple "phase" label from most frequent stage
      const stageCounts = plants.reduce((acc, p) => {
        const k = String(p?.stage || 'unknown'); acc[k] = (acc[k] || 0) + 1; return acc
      }, {})
      const phase = Object.entries(stageCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? '—'
      return {
        id: z.id, name: z.name, plantsCount: count, phase
      }
    })
    outRooms.push({ id: r.id, name: r.name, zones: outZones })
  }
  return { rooms: outRooms }
}
