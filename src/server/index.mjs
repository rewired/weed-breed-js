import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server as IOServer } from 'socket.io'

const PORT = Number(process.env.PORT || 7071)
const SOCKET_PATH = process.env.SOCKET_IO_PATH || '/ui' // wichtig: /ui

const app = express()
app.use(cors({ origin: ['http://localhost:5173'], credentials: true }))
app.get('/healthz', (_req, res) => res.json({ ok: true, message: 'server up' }))

const httpServer = http.createServer(app)

const io = new IOServer(httpServer, {
  path: SOCKET_PATH,
  cors: {
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'], // Polling erlaubt → später Upgrade
  allowEIO3: false, // wir setzen auf EIO4 (socket.io v4)
})

io.on('connection', (socket) => {
  console.log('[io] connected', socket.id)
  socket.on('disconnect', (reason) => {
    console.log('[io] disconnected', socket.id, reason)
  })
})

// Demo-Events (sichtbarer "Herzschlag")
setInterval(() => {
  io.emit('sim.tickCompleted', { tick: Date.now() })
}, 1500)

httpServer.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  ws path=${SOCKET_PATH}`)
})
