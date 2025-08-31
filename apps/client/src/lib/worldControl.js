import { socket } from '@/lib/socket.js'
import { useEffect, useState } from 'react'

const ACK_TIMEOUT_MS = 2000
const ack = (ev,p={}) => new Promise((resolve,reject)=>{
  socket.timeout(ACK_TIMEOUT_MS).emit(ev,p,(err,res)=> err?reject(err):resolve(res))
})

export const loadDefaultSavegame = (path) => ack('savegame.load', path ? { path } : {})
export const requestWorld = () => ack('world.get', {})

let lastSummary = null
let lastSnapshot = null

export function useWorldSummary() {
  const [summary, setSummary] = useState(lastSummary)
  useEffect(() => {
    const onSummary = (s) => { lastSummary = s; setSummary(s) }
    const onConnect = () => requestWorld().catch(() => {})
    socket.on('world.summary', onSummary)
    socket.on('connect', onConnect)
    if (!lastSummary) requestWorld().catch(() => {})
    return () => {
      socket.off('world.summary', onSummary)
      socket.off('connect', onConnect)
    }
  }, [])
  return summary
}

export function useWorldSnapshot() {
  const [snap, setSnap] = useState(lastSnapshot)
  useEffect(() => {
    const onSnapshot = (s) => { lastSnapshot = s; setSnap(s) }
    const onConnect = () => requestWorld().catch(() => {})
    socket.on('world.snapshot', onSnapshot)
    socket.on('connect', onConnect)
    if (!lastSnapshot) requestWorld().catch(() => {})
    return () => {
      socket.off('world.snapshot', onSnapshot)
      socket.off('connect', onConnect)
    }
  }, [])
  return snap
}
