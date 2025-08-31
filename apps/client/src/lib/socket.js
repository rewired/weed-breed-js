import { io } from 'socket.io-client'
import { useEffect, useMemo, useRef, useState } from 'react'

const WS_PATH = import.meta.env.VITE_WS_PATH || '/ui'

// Optional: über Vite-Proxy verbinden (gleiche Origin), um CORS/Upgrade-Probleme zu vermeiden.
// Setze VITE_WS_VIA_PROXY="true" in .env.development, wenn du das nutzen willst.
const VIA_PROXY = (import.meta.env.VITE_WS_VIA_PROXY || 'false').toLowerCase() === 'true'

// Wenn via Proxy: URL leer lassen → io() nutzt aktuelle Origin (5173), Vite-Proxy leitet auf 7071
const SERVER_URL = VIA_PROXY ? '' : (import.meta.env.VITE_SERVER_URL || 'http://localhost:7071')

export const socket = io(SERVER_URL, {
  path: WS_PATH,
  // Polling zuerst erlauben ⇒ robustere Verbindung (Upgrade folgt automatisch)
  transports: ['polling', 'websocket'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  withCredentials: true,
})

if (import.meta.env.DEV) {
  socket.on('connect', () => console.info('[ws] connected', socket.id))
  socket.on('disconnect', (r) => console.warn('[ws] disconnected', r))
  socket.on('connect_error', (e) => console.error('[ws] connect_error', e?.message || e))
}

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
    () => ({ connected, eventCount, lastEventType, lastEvent: lastEventRef.current, logs: logsRef.current }),
    [connected, eventCount, lastEventType]
  )
}
