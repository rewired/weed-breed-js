// Node ESM + Socket.IO v4 server exposing sim controls
import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server as IOServer } from 'socket.io'
import { SimEngine } from './simEngine.mjs'

const PORT = Number(process.env.PORT || 7071)
const SOCKET_PATH = process.env.SOCKET_IO_PATH || '/ui'
const BASE_MS = Number(process.env.TICK_WALL_MS || 200)

const app = express()
// CORS for Vite client
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

// -- Simulation core
const sim = new SimEngine(io, { baseMs: BASE_MS })

io.on('connection', (socket) => {
  console.log('[io] connected', socket.id)

  // send current state immediately
  socket.emit('sim.state', sim.state())

  // control: start/pause
  socket.on('sim.control', (payload = {}, ack) => {
    try {
      const action = String(payload?.action || '').toLowerCase()
      if (action === 'start') {
        sim.start()
        sim.broadcastState()
        if (typeof ack === 'function') ack({ ok: true })
        return
      }
      if (action === 'pause') {
        sim.pause()
        sim.broadcastState()
        if (typeof ack === 'function') ack({ ok: true })
        return
      }
      if (typeof ack === 'function') ack({ ok: false, error: 'unknown action' })
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err?.message || String(err) })
    }
  })

  // single step (only when paused)
  socket.on('sim.step', (_payload, ack) => {
    try {
      if (sim.running) {
        if (typeof ack === 'function') return ack({ ok: false, error: 'pause first' })
        return
      }
      sim.step()
      // optional: reflect tick change via state (UI may also rely on sim.tickCompleted)
      sim.broadcastState()
      if (typeof ack === 'function') ack({ ok: true })
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err?.message || String(err) })
    }
  })

  // speed change
  socket.on('sim.speed', (payload = {}, ack) => {
    try {
      const m = Number(payload?.multiplier)
      sim.setSpeed(m)
      sim.broadcastState()
      if (typeof ack === 'function') ack({ ok: true })
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err?.message || String(err) })
    }
  })

  socket.on('disconnect', (reason) => {
    console.log('[io] disconnected', socket.id, reason)
  })
})

// demo: you can choose to start paused; leave it paused by default
// sim.start()

httpServer.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  ws path=${SOCKET_PATH}  baseMs=${BASE_MS}`)
})

// graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`[server] ${sig} received, shutting down...`)
    sim.dispose()
    httpServer.close(() => process.exit(0))
  })
}

