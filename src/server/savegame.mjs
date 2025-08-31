// ESM helpers for savegames and derived views
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function getDefaultSavePath() {
  return path.resolve(process.cwd(), 'data', 'savegames', 'default.json')
}

export function resolveExistingDefaultSavePath() {
  const candidates = [
    path.resolve(process.cwd(), 'data', 'savegames', 'default.json'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data/savegames/default.json'),
    path.resolve(process.cwd(), 'apps', 'server', 'data', 'savegames', 'default.json'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return getDefaultSavePath()
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
  let plantCount = 0
  for (const r of rooms) {
    for (const z of r?.zones ?? []) {
      zoneCount++
      plantCount += estimatePlantsForZone(z)
    }
  }
  const harvests = Number(world?.metrics?.harvests ?? 0)
  return { rooms: roomCount, zones: zoneCount, plants: plantCount, harvests }
}

export function resolveMethod(id) {
  const name = `${id}.json`
  const candidates = [
    path.resolve(process.cwd(), 'data', 'methods', name),
    path.resolve(process.cwd(), 'data', 'cultivation_methods', name),
    path.resolve(process.cwd(), 'data', 'cultivationMethods', name),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'))
      } catch {
        /* ignore malformed file */
      }
    }
  }
  return { areaPerPlant: 0.25, containerSpec: { packingDensity: 0.95 } }
}

export function estimatePlantsForZone(zone) {
  const sim = zone?.simulation || {}
  const method = resolveMethod(sim.methodId)
  const areaPerPlant = Number(method?.areaPerPlant ?? 0.25)
  const density = Number(method?.containerSpec?.packingDensity ?? 1)
  const area = Number(zone?.area ?? 0)
  const effectiveArea = area * (Number.isFinite(density) ? density : 1)
  const plants = Math.max(0, Math.floor(effectiveArea / Math.max(1e-6, areaPerPlant)))
  return plants
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
      const plants = Array.isArray(z?.plants) ? z.plants : []
      const plantsCount = plants.length
      let phase = null
      if (plantsCount > 0) {
        const counts = {}
        for (const p of plants) {
          const st = p?.stage
          if (st) counts[st] = (counts[st] || 0) + 1
        }
        phase = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
      }
      const plantsPlanned = estimatePlantsForZone(z)
      const sim = z?.simulation || {}
      const strainId = sim.strainId || null
      const strainLabel = labelFromZoneName(z?.name, strainId)
      const methodId = sim.methodId || null
      const methodLabel = humanizeMethod(methodId)
      const devices = (z?.devices || []).map((d) => ({
        blueprintId: d.blueprintId,
        count: Number(d.count || 0),
      }))
      const devicesTotal = devices.reduce((a, d) => a + (d.count || 0), 0)
      const zoneSnap = {
        id: z.id,
        name: z.name,
        plantsCount,
        plantsPlanned,
        strainId,
        strainLabel,
        methodId,
        methodLabel,
        devices,
        devicesTotal,
      }
      if (phase) zoneSnap.phase = phase
      return zoneSnap
    })
    outRooms.push({ id: r.id, name: r.name, zones: outZones })
  }
  return { rooms: outRooms }
}
