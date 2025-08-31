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

/** Loads the default savegame (or a specific path via payload.path) on the server. */
export async function loadDefaultSavegame(path) {
  const payload = path ? { path } : {}
  const res = await emitWithAck('savegame.load', payload)
  if (!res?.ok) throw new Error(res?.error || 'load failed')
  return res
}

/** Hook that subscribes to 'world.summary'. */
export function useWorldSummary() {
  const [summary, setSummary] = useState(null)
  useEffect(() => {
    const onSummary = (s) => setSummary(s)
    socket.on('world.summary', onSummary)
    return () => socket.off('world.summary', onSummary)
  }, [])
  return summary
}
