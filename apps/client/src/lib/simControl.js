import { socket } from '@/lib/socket.js'
import { useEffect, useState } from 'react'

const ACK_TIMEOUT_MS = 2000

function emitWithAck(event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, ack) => {
      if (err) return reject(err)
      resolve(ack)
    })
  })
}

/** Client APIs */
export async function startSim() {
  return emitWithAck('sim.control', { action: 'start' })
}
export async function pauseSim() {
  return emitWithAck('sim.control', { action: 'pause' })
}
export async function stepSim() {
  return emitWithAck('sim.step', {})
}
export async function setSpeed(multiplier) {
  return emitWithAck('sim.speed', { multiplier })
}

/**
 * useSimState:
 * - subscribed to 'sim.state' and 'sim.tickCompleted'
 * - provides { running, speed, lastTick, error }
 */
export function useSimState() {
  const [state, setState] = useState({
    running: false,
    speed: 1,
    lastTick: null,
    error: null,
  })

  useEffect(() => {
    const onState = (s) => {
      setState((prev) => ({
        ...prev,
        ...s,
        error: null,
      }))
    }
    const onTick = (payload) => {
      const t = payload?.tick ?? Date.now()
      setState((prev) => ({ ...prev, lastTick: t }))
    }
    socket.on('sim.state', onState)
    socket.on('sim.tickCompleted', onTick)

    return () => {
      socket.off('sim.state', onState)
      socket.off('sim.tickCompleted', onTick)
    }
  }, [])

  return [state, setState]
}
