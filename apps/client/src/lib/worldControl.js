import { socket } from '@/lib/socket.js'
import { useEffect, useState } from 'react'

const ACK_TIMEOUT_MS = 2000
const ack = (ev,p={}) => new Promise((resolve,reject)=>{
  socket.timeout(ACK_TIMEOUT_MS).emit(ev,p,(err,res)=> err?reject(err):resolve(res))
})

export const loadDefaultSavegame = (path) => ack('savegame.load', path?{path}:{})
export const requestWorld = () => ack('world.get', {})

export function useWorldSummary() {
  const [summary, setSummary] = useState(null)
  useEffect(()=>{ const h=(s)=>setSummary(s); socket.on('world.summary',h); return ()=>socket.off('world.summary',h)},[])
  return summary
}
export function useWorldSnapshot() {
  const [snap, setSnap] = useState(null)
  useEffect(()=>{ const h=(s)=>setSnap(s); socket.on('world.snapshot',h); return ()=>socket.off('world.snapshot',h)},[])
  return snap
}
