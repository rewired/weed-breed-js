import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { Server as IOServer } from 'socket.io'
import { EventEmitter } from 'node:events'
import { SimEngine } from './simEngine.mjs'
import { createSimControlRouter } from './routes/simControl.js'
import { router as strainRouter } from './routes/strains.mjs'
import {
  resolveExistingDefaultSavePath,
  ensureSampleSave,
  loadWorldFromFile,
  computeSummary,
  computeSnapshot,
} from './savegame.mjs'
import { attachSimEngineEventBridge } from '../engine/SimEngineEventBridge.mjs'
import { createRateLimiter } from './middleware/rateLimiter.mjs'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.mjs'

const PORT = Number(process.env.PORT || 7071)
const SOCKET_PATH = process.env.SOCKET_IO_PATH || '/ui'
const BASE_MS = Number(process.env.TICK_WALL_MS || 200)
const SAVE_PATH = process.env.SAVEGAME_PATH || resolveExistingDefaultSavePath()
// Security: Default to false in production
const ALLOW_UNSAFE_CONTROL = process.env.NODE_ENV === 'development' 
  ? (process.env.ALLOW_UNSAFE_CONTROL !== 'false')
  : (process.env.ALLOW_UNSAFE_CONTROL === 'true')
// Security: Configure allowed savegame directory
const SAVEGAME_BASE_DIR = path.resolve(process.cwd(), process.env.SAVEGAME_BASE_DIR || 'data/savegames')

const app = express()
// Security: Configure CORS from environment
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173']
app.use(cors({ origin: corsOrigins, credentials: true }))
// Security: Limit body size to prevent DoS
app.use(express.json({ limit: '256kb' }))
// Security: Add rate limiting
app.use('/api', createRateLimiter({ maxRequests: 100, windowMs: 60000 }))

app.get('/healthz', (_req, res) => res.json({ ok: true }))
app.get('/api/health', (_req, res) => res.json({ ok: true }))

const httpServer = http.createServer(app)
const io = new IOServer(httpServer, {
  path: SOCKET_PATH,
  transports: ['polling','websocket'],
  allowEIO3: false,
  cors: { origin: corsOrigins, credentials: true },
})

const sim = new SimEngine(io, { baseMs: BASE_MS })
app.use('/api/sim', createSimControlRouter({ engine: sim }))
// Mount the missing strains router
app.use('/api/strains', strainRouter)

// Error handling - must be last
app.use(notFoundHandler)
app.use(errorHandler)

let world = null
let summary = { rooms: 0, zones: 0, plants: 0, harvests: 0 }
let snapshot = { rooms: [] }

// Central event bus for derived simulation events
const events$ = new EventEmitter()
attachSimEngineEventBridge({
  engine: sim,
  events$,
  getState: () => world,
  ticksPerDay: Number(process.env.TICKS_PER_DAY || 24),
})

function recompute() {
  summary = computeSummary(world)
  snapshot = computeSnapshot(world)
}
function broadcastWorld() {
  io.emit('world.summary', summary)
  io.emit('world.snapshot', snapshot)
}
function bootstrap() {
  const exists = fs.existsSync(SAVE_PATH)
  const cwd = process.cwd()
  const dir = path.dirname(fileURLToPath(import.meta.url))
  console.info('[startup] cwd=%s dir=%s', cwd, dir)
  console.info('[startup] resolved SAVE_PATH=%s exists=%s', SAVE_PATH, exists)
  console.info('[startup] ALLOW_UNSAFE_CONTROL=%s', ALLOW_UNSAFE_CONTROL)
  ensureSampleSave(SAVE_PATH)
  world = loadWorldFromFile(SAVE_PATH)
  recompute()
  console.info(
    '[startup] loaded summary: rooms=%d zones=%d plants=%d harvests=%d snapshotRooms=%d',
    summary.rooms,
    summary.zones,
    summary.plants,
    summary.harvests,
    snapshot?.rooms?.length ?? 0,
  )
}

bootstrap()
broadcastWorld()

const relay = (name) => (payload) => io.emit(name, payload)
events$
  .on('sim:day', relay('sim:day'))
  .on('finance:update', relay('finance:update'))
  .on('harvest:event', relay('harvest:event'))

const forwardEvents = [
  'sim.tickCompleted',
  'plant.stageChanged',
  'plant.harvested',
  'zone.thresholdCrossed',
  'device.degraded',
  'market.saleCompleted',
  'tick.summary',
]
for (const evt of forwardEvents) {
  sim.events.on(evt, (p) => {
    events$.emit(evt, p)
    io.emit(evt, p)
  })
}

// Helper to validate and sanitize file paths
function sanitizeSavegamePath(requestedPath) {
  if (!requestedPath) return null
  
  // Normalize and resolve the path
  const normalized = path.normalize(requestedPath)
  const resolved = path.resolve(SAVEGAME_BASE_DIR, normalized)
  
  // Ensure the resolved path is within the allowed directory
  if (!resolved.startsWith(SAVEGAME_BASE_DIR)) {
    console.warn('[security] Path traversal attempt blocked:', requestedPath)
    return null
  }
  
  // Only allow .json files
  if (!resolved.endsWith('.json')) {
    return null
  }
  
  return resolved
}

io.on('connection', (socket) => {
  socket.emit('sim.state', sim.state())
  socket.emit('world.summary', summary)
  socket.emit('world.snapshot', snapshot)
  console.log('[io] connected', socket.id)

  socket.on('sim.control', (p={}, ack)=>{ try{
    if(!ALLOW_UNSAFE_CONTROL) return ack?.({ok:false,error:'control disabled'})
    const a = String(p.action||'').toLowerCase()
    if (a==='start'){ sim.start(); io.emit('sim.state', sim.state()); return ack?.({ok:true})}
    if (a==='pause'){ sim.pause(); io.emit('sim.state', sim.state()); return ack?.({ok:true})}
    return ack?.({ok:false,error:'unknown action'})
  }catch(e){ return ack?.({ok:false,error:e?.message||String(e)})}})

  socket.on('sim.step', (p={}, ack)=>{ try{
    if(!ALLOW_UNSAFE_CONTROL) return ack?.({ok:false,error:'control disabled'})
    const steps = Number(p.ticks||1)
    // Validate and clamp steps
    if (!Number.isFinite(steps) || steps < 1 || steps > 1000) {
      return ack?.({ok:false,error:'invalid ticks (1-1000)'})
    }
    if (sim.running) return ack?.({ok:false,error:'pause first'})
    for(let i=0;i<steps;i++) sim.step()
    io.emit('sim.state', sim.state()); return ack?.({ok:true})
  }catch(e){ return ack?.({ok:false,error:e?.message||String(e)})}})

  socket.on('sim.speed', (p={}, ack)=>{ try{
    if(!ALLOW_UNSAFE_CONTROL) return ack?.({ok:false,error:'control disabled'})
    const multiplier = Number(p.multiplier)
    // Validate speed multiplier
    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 16) {
      return ack?.({ok:false,error:'invalid speed (0.25-16)'})
    }
    sim.setSpeed(multiplier); io.emit('sim.state', sim.state()); return ack?.({ok:true})
  }catch(e){ return ack?.({ok:false,error:e?.message||String(e)})}})

  socket.on('world.get', (_p, ack)=> ack?.({ok:true, summary, snapshot}))
  socket.on('world.debug', (_p, ack)=> ack?.({ ok:true, path:SAVE_PATH, summary, snapshotRooms:snapshot?.rooms?.length ?? 0 }))

  socket.on('savegame.load', (p={}, ack)=>{ try{
    if(!ALLOW_UNSAFE_CONTROL) return ack?.({ok:false,error:'control disabled'})
    
    // Security: Validate and sanitize the path
    const requestedPath = p?.path || SAVE_PATH
    const safePath = sanitizeSavegamePath(requestedPath)
    
    if (!safePath) {
      return ack?.({ok:false,error:'invalid path'})
    }
    
    if (!fs.existsSync(safePath)) {
      return ack?.({ok:false,error:'file not found'})
    }
    
    world = loadWorldFromFile(safePath)
    recompute(); broadcastWorld()
    return ack?.({ok:true, path:path.relative(SAVEGAME_BASE_DIR, safePath), summary})
  }catch(e){ return ack?.({ok:false,error:e?.message||String(e)})}})
})

httpServer.listen(PORT, ()=> console.log(`[server] http://localhost:${PORT}  path=${SOCKET_PATH}`))
