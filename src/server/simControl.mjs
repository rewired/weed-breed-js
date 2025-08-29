// src/server/simControl.mjs
import express from 'express';
import { emit } from '../runtime/eventBus.js';

/**
 * Simple in-memory ticker stub. Replace hooks with your real tick engine if present.
 */
export function createSimController() {
  /** @type {'idle'|'running'|'paused'} */
  let state = 'idle';
  let tick = 0;
  let speed = 1; // 1x default

  let interval = null;
  function ensureTicker() {
    if (interval) return;
    interval = setInterval(() => {
      if (state !== 'running') return;
      tick += 1;
      emit('sim.tickCompleted', { tick, speed }, Date.now());
    }, Math.max(50, 500 / speed));
  }
  function stopTicker() {
    if (interval) clearInterval(interval);
    interval = null;
  }

  const router = express.Router();

  router.get('/state', (_req, res) => {
    res.json({ state, tick, speed });
  });

  router.post('/start', (req, res) => {
    if (state === 'idle' || state === 'paused') {
      state = 'running';
      const s = Number(req.body?.speed);
      if (Number.isFinite(s) && s > 0) speed = s;
      ensureTicker();
    }
    res.json({ state, tick, speed });
  });

  router.post('/pause', (_req, res) => {
    if (state === 'running') state = 'paused';
    res.json({ state, tick, speed });
  });

  router.post('/resume', (_req, res) => {
    if (state === 'paused') state = 'running';
    res.json({ state, tick, speed });
  });

  router.post('/stop', (_req, res) => {
    state = 'idle';
    tick = 0;
    stopTicker();
    res.json({ state, tick, speed });
  });

  router.post('/speed', (req, res) => {
    const s = Number(req.body?.speed);
    if (Number.isFinite(s) && s > 0) {
      speed = s;
      // adjust cadence by recreating the ticker on next tick
      if (state === 'running') {
        stopTicker();
        ensureTicker();
      }
    }
    res.json({ speed });
  });

  return { router };
}
