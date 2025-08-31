import { io } from 'socket.io-client'
import { useEffect, useMemo, useRef, useState } from 'react'

// ENV mit Defaults
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:7071'
const WS_PATH = import.meta.env.VITE_WS_PATH || '/ui'

// Eine einzige Socket.IO-Instanz für die App
export const socket = io(SERVER_URL, {
  path: WS_PATH,
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
})

// Dev-Logs (optional)
if (import.meta.env.DEV) {
  socket.on('connect', () => console.info('[ws] connected', socket.id))
  socket.on('disconnect', (reason) => console.warn('[ws] disconnected', reason))
  socket.on('connect_error', (err) => console.error('[ws] connect_error', err?.message || err))
}

/**
 * React-Hook mit einfachen Verbindungs-/Eventdiagnosen.
 * Liefert: { connected, eventCount, lastEventType, lastEvent, logs }
 */
export function useSocketDiagnostics() {
  const [connected, setConnected] = useState(socket.connected)
  const [eventCount, setEventCount] = useState(0)
  const [lastEventType, setLastEventType] = useState(null)
  const lastEventRef = useRef(null)
  const logsRef = useRef([])

  useEffect(() => {
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    // Hör auf relevante Events deiner Sim
    const eventTypes = [
      'sim.tickCompleted',
      'plant.stageChanged',
      'plant.harvested',
      'zone.thresholdCrossed',
      'device.degraded',
      'market.saleCompleted',
    ]
    const handler = (type) => (payload) => {
      setEventCount((c) => c + 1)
      setLastEventType(type)
      lastEventRef.current = { type, payload, ts: Date.now() }
      logsRef.current.unshift({ t: new Date().toISOString(), type, payload })
      logsRef.current = logsRef.current.slice(0, 100)
      if (import.meta.env.DEV) console.debug(`[ws:${type}]`, payload)
    }

    eventTypes.forEach((evt) => socket.on(evt, handler(evt)))

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      eventTypes.forEach((evt) => socket.off(evt))
    }
  }, [])

  return useMemo(
    () => ({
      connected,
      eventCount,
      lastEventType,
      lastEvent: lastEventRef.current,
      logs: logsRef.current,
    }),
    [connected, eventCount, lastEventType]
  )
}
