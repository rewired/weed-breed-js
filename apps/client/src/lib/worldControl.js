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

export async function loadDefaultSavegame(path) {
  const payload = path ? { path } : {}
  const res = await emitWithAck('savegame.load', payload)
  if (!res?.ok) throw new Error(res?.error || 'load failed')
  return res
}

export async function requestWorld() {
  const res = await emitWithAck('world.get', {})
  if (!res?.ok) throw new Error(res?.error || 'world.get failed')
  return res // { ok, summary, snapshot }
}

export function useWorldSummary() {
  const [summary, setSummary] = useState(null)
  useEffect(() => {
    const onSummary = (s) => setSummary(s)
    socket.on('world.summary', onSummary)
    return () => socket.off('world.summary', onSummary)
  }, [])
  return summary
}

export function useWorldSnapshot() {
  const [snap, setSnap] = useState(null)
  useEffect(() => {
    const onSnap = (s) => setSnap(s)
    socket.on('world.snapshot', onSnap)
    return () => socket.off('world.snapshot', onSnap)
  }, [])
  return snap
}
