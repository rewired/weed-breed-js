// Simple controllable simulation loop with Socket.IO v4
// ESM module
import { EventEmitter } from 'node:events'

export class SimEngine {
  /**
   * @param {import('socket.io').Server} io
   * @param {{ baseMs?: number }} options
   */
  constructor(io, { baseMs = 200 } = {}) {
    this.io = io
    this.baseMs = Number.isFinite(baseMs) ? baseMs : 200
    this.running = false
    this.speed = 1.0
    this.tick = 0
    this._timer = null
    this.events = new EventEmitter()

    this._performTick = this._performTick.bind(this)
  }

  /** Current delay in ms, considering speed (floored at 16ms) */
  get delayMs() {
    const d = this.baseMs / Math.max(0.0001, this.speed)
    return Math.max(16, Math.round(d))
  }

  /** Emit one tick and schedule next if running */
  _performTick() {
    try {
      const payload = { tick: this.tick, at: Date.now() }
      this.io.emit('sim.tickCompleted', payload)
      this.events.emit('sim.tickCompleted', payload)
      this.tick += 1
    } catch (err) {
      // Log and continue
      console.error('[sim] tick error:', err?.stack || err)
    } finally {
      // Schedule next only if running
      if (this.running) {
        this._timer = setTimeout(this._performTick, this.delayMs)
      }
    }
  }

  /** Start the loop (no-op if already running) */
  start() {
    if (this.running) return
    this.running = true
    clearTimeout(this._timer)
    // run ASAP
    this._timer = setTimeout(this._performTick, 0)
  }

  /** Pause the loop (no-op if already paused) */
  pause() {
    if (!this.running) return
    this.running = false
    clearTimeout(this._timer)
    this._timer = null
  }

  /** Single tick while paused */
  step() {
    if (this.running) {
      throw new Error('cannot step while running')
    }
    // Do not schedule the next tick (running=false)
    this._performTick()
  }

  /**
   * @param {number} m
   */
  setSpeed(m) {
    const next = Number(m)
    if (!Number.isFinite(next) || next <= 0) {
      throw new Error('invalid speed multiplier')
    }
    // clamp 0.25 .. 16
    this.speed = Math.min(16, Math.max(0.25, next))
    if (this.running) {
      clearTimeout(this._timer)
      this._timer = setTimeout(this._performTick, this.delayMs)
    }
  }

  /** Current state snapshot */
  state() {
    return {
      running: this.running,
      speed: this.speed,
      tick: this.tick,
    }
  }

  /** Broadcast state to all clients */
  broadcastState() {
    this.io.emit('sim.state', this.state())
  }

  /** Clean shutdown */
  dispose() {
    this.pause()
  }
}

