import { io } from 'socket.io-client'
import { useEffect, useMemo, useRef, useState } from 'react'

// ENV
const WS_PATH = import.meta.env.VITE_WS_PATH || '/ui'
const VIA_PROXY = (import.meta.env.VITE_WS_VIA_PROXY || 'true').toLowerCase() === 'true'
const SERVER_URL = VIA_PROXY ? '' : (import.meta.env.VITE_SERVER_URL || 'http://localhost:7071')

// Singleton Socket.IO client
export const socket = io(SERVER_URL, {
  path: WS_PATH,
  transports: ['polling', 'websocket'], // robust: Polling → Upgrade
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  withCredentials: true,
})

/**
 * Diagnostics hook, race-safe:
 * - subscribes to connect/disconnect/reconnect/connect_error
 * - immediately syncs state after handlers are attached (covers "missed connect")
 * - tracks engine transport (polling/websocket)
 */
export function useSocketDiagnostics() {
  const [connected, setConnected] = useState(socket.connected) // initial snapshot
  const [eventCount, setEventCount] = useState(0)
  const [lastEventType, setLastEventType] = useState(null)
  const [transport, setTransport] = useState(socket.io.engine?.transport?.name || 'n/a')
  const lastEventRef = useRef(null)
  const logsRef = useRef([])
  const [mode] = useState(VIA_PROXY ? 'proxy' : 'direct')

  useEffect(() => {
    const onConnect = () => {
      setConnected(true)
      setTransport(socket.io.engine?.transport?.name || 'n/a')
    }
    const onDisconnect = () => setConnected(false)
    const onConnectError = (e) => {
      // keep state; expose via logs
      if (import.meta.env.DEV) console.error('[ws] connect_error', e?.message || e)
    }
    const onReconnectAttempt = (n) => {
      if (import.meta.env.DEV) console.info('[ws] reconnect_attempt', n)
    }
    const onReconnect = (n) => {
      if (import.meta.env.DEV) console.info('[ws] reconnected', n)
      setConnected(true)
      setTransport(socket.io.engine?.transport?.name || 'n/a')
    }

    // Transport change (engine.io)
    const engine = socket.io.engine
    const onUpgraded = () => setTransport(engine?.transport?.name || 'n/a')

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.io.on('reconnect_attempt', onReconnectAttempt)
    socket.io.on('reconnect', onReconnect)
    engine?.once('upgrade', onUpgraded)

    // Immediately sync AFTER we subscribed → fixes race where connect already happened
    setConnected(socket.connected)
    setTransport(socket.io.engine?.transport?.name || 'n/a')

    // Subscribe to relevant sim events just for counting/last label
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
      socket.off('connect_error', onConnectError)
      socket.io.off('reconnect_attempt', onReconnectAttempt)
      socket.io.off('reconnect', onReconnect)
      engine?.off?.('upgrade', onUpgraded)
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
      transport,
      mode,
    }),
    [connected, eventCount, lastEventType, transport, mode]
  )
}
