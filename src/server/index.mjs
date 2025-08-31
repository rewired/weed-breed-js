// Node ESM + Socket.IO v4 server with simulation controls and savegame loading
import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server as IOServer } from 'socket.io'
import { SimEngine } from './simEngine.mjs'
import {
  getDefaultSavePath,
  ensureSampleSave,
  loadWorldFromFile,
  computeSummary,
} from './savegame.mjs'

const PORT = Number(process.env.PORT || 7071)
const SOCKET_PATH = process.env.SOCKET_IO_PATH || '/ui'
const BASE_MS = Number(process.env.TICK_WALL_MS || 200)
const SAVE_PATH = process.env.SAVEGAME_PATH || getDefaultSavePath()

const app = express()
app.use(cors({ origin: ['http://localhost:5173'], credentials: true }))
app.get('/healthz', (_req, res) => res.json({ ok: true, message: 'server up' }))

const httpServer = http.createServer(app)

const io = new IOServer(httpServer, {
  path: SOCKET_PATH,
  transports: ['polling', 'websocket'],
  allowEIO3: false,
  cors: {
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

// --- Simulation core
const sim = new SimEngine(io, { baseMs: BASE_MS })

// --- World state (loaded from disk)
let world = null
let summary = { rooms: 0, zones: 0, plants: 0, harvests: 0 }

// Load default save at startup (create a sample if missing)
function bootstrapWorld() {
  try {
    ensureSampleSave(SAVE_PATH)
    world = loadWorldFromFile(SAVE_PATH)
    summary = computeSummary(world)
    console.log('[world] loaded', SAVE_PATH, summary)
  } catch (err) {
    console.error('[world] failed to load', SAVE_PATH, err?.message || err)
    world = { meta: { id: 'empty' }, structure: { rooms: [] }, metrics: { harvests: 0 } }
    summary = computeSummary(world)
  }
}

// Broadcast summary to all clients
function broadcastSummary() {
  io.emit('world.summary', summary)
}

// Handle socket connections
io.on('connection', (socket) => {
  console.log('[io] connected', socket.id)

  // Initial state to the new client
  socket.emit('sim.state', sim.state())
  socket.emit('world.summary', summary)

  // sim controls (ACK)
  socket.on('sim.control', (payload = {}, ack) => {
    try {
      const action = String(payload?.action || '').toLowerCase()
      if (action === 'start') {
        sim.start(); io.emit('sim.state', sim.state())
        return typeof ack === 'function' && ack({ ok: true })
      }
      if (action === 'pause') {
        sim.pause(); io.emit('sim.state', sim.state())
        return typeof ack === 'function' && ack({ ok: true })
      }
      return typeof ack === 'function' && ack({ ok: false, error: 'unknown action' })
    } catch (err) {
      return typeof ack === 'function' && ack({ ok: false, error: err?.message || String(err) })
    }
  })

  socket.on('sim.step', (_payload, ack) => {
    try {
      if (sim.running) return typeof ack === 'function' && ack({ ok: false, error: 'pause first' })
      sim.step(); io.emit('sim.state', sim.state())
      return typeof ack === 'function' && ack({ ok: true })
    } catch (err) {
      return typeof ack === 'function' && ack({ ok: false, error: err?.message || String(err) })
    }
  })

  socket.on('sim.speed', (payload = {}, ack) => {
    try {
      sim.setSpeed(Number(payload?.multiplier))
      io.emit('sim.state', sim.state())
      return typeof ack === 'function' && ack({ ok: true })
    } catch (err) {
      return typeof ack === 'function' && ack({ ok: false, error: err?.message || String(err) })
    }
  })

  // Load/savegame (ACK) – loads from optional path, else default path
  socket.on('savegame.load', (payload = {}, ack) => {
    try {
      const p = payload?.path || SAVE_PATH
      world = loadWorldFromFile(p)
      summary = computeSummary(world)
      broadcastSummary()
      return typeof ack === 'function' && ack({ ok: true, summary, path: p })
    } catch (err) {
      return typeof ack === 'function' && ack({ ok: false, error: err?.message || String(err) })
    }
  })

  socket.on('disconnect', (reason) => {
    console.log('[io] disconnected', socket.id, reason)
  })
})

// Boot
bootstrapWorld()
// sim.start() // optional auto-start

httpServer.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  ws path=${SOCKET_PATH}  baseMs=${BASE_MS}`)
  console.log(`[server] savegame: ${SAVE_PATH}`)
})

// graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`[server] ${sig} received, shutting down...`)
    sim.dispose()
    httpServer.close(() => process.exit(0))
  })
}
