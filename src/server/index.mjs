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
  computeSnapshot,
} from './savegame.mjs'

const PORT = Number(process.env.PORT || 7071)
const SOCKET_PATH = process.env.SOCKET_IO_PATH || '/ui'
const BASE_MS = Number(process.env.TICK_WALL_MS || 200)
const SAVE_PATH = process.env.SAVEGAME_PATH || getDefaultSavePath()

const app = express()
app.use(cors({ origin: ['http://localhost:5173'], credentials: true }))
app.get('/healthz', (_req, res) => res.json({ ok: true }))

const httpServer = http.createServer(app)
const io = new IOServer(httpServer, {
  path: SOCKET_PATH,
  transports: ['polling','websocket'],
  allowEIO3: false,
  cors: { origin: ['http://localhost:5173'], credentials: true },
})

const sim = new SimEngine(io, { baseMs: BASE_MS })

let world = null
let summary = { rooms: 0, zones: 0, plants: 0, harvests: 0 }
let snapshot = { rooms: [] }

function recompute() {
  summary = computeSummary(world)
  snapshot = computeSnapshot(world)
}
function broadcastWorld() {
  io.emit('world.summary', summary)
  io.emit('world.snapshot', snapshot)
}
function bootstrap() {
  ensureSampleSave(SAVE_PATH)
  world = loadWorldFromFile(SAVE_PATH)
  recompute()
  console.log('[world]', summary)
}

io.on('connection', (socket) => {
  console.log('[io] connected', socket.id)
  socket.emit('sim.state', sim.state())
  socket.emit('world.summary', summary)
  socket.emit('world.snapshot', snapshot)

  socket.on('sim.control', (p={}, ack)=>{ try{
    const a = String(p.action||'').toLowerCase()
    if (a==='start'){ sim.start(); io.emit('sim.state', sim.state()); return ack?.({ok:true})}
    if (a==='pause'){ sim.pause(); io.emit('sim.state', sim.state()); return ack?.({ok:true})}
    return ack?.({ok:false,error:'unknown action'})
  }catch(e){ return ack?.({ok:false,error:e?.message||String(e)})}})

  socket.on('sim.step', (_p, ack)=>{ try{
    if (sim.running) return ack?.({ok:false,error:'pause first'})
    sim.step(); io.emit('sim.state', sim.state()); return ack?.({ok:true})
  }catch(e){ return ack?.({ok:false,error:e?.message||String(e)})}})

  socket.on('sim.speed', (p={}, ack)=>{ try{
    sim.setSpeed(Number(p.multiplier)); io.emit('sim.state', sim.state()); return ack?.({ok:true})
  }catch(e){ return ack?.({ok:false,error:e?.message||String(e)})}})

  socket.on('world.get', (_p, ack)=> ack?.({ok:true, summary, snapshot}))

  socket.on('savegame.load', (p={}, ack)=>{ try{
    const file = p?.path || SAVE_PATH
    world = loadWorldFromFile(file)
    recompute(); broadcastWorld()
    return ack?.({ok:true, path:file, summary})
  }catch(e){ return ack?.({ok:false,error:e?.message||String(e)})}})
})

bootstrap()
httpServer.listen(PORT, ()=> console.log(`[server] http://localhost:${PORT}  path=${SOCKET_PATH}`))
