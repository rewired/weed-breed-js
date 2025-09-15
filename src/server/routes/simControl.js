import express from 'express';

/**
 * HTTP control endpoints for the simulation.
 * @param {{ engine: any }} opts
 */
export function createSimControlRouter({ engine }) {
  const router = express.Router();
  router.use(express.json());

  // Security: Default to false in production
  const allow = process.env.NODE_ENV === 'development' 
    ? (process.env.ALLOW_UNSAFE_CONTROL !== 'false')
    : (process.env.ALLOW_UNSAFE_CONTROL === 'true');
  function guard(_req, res, next) {
    if (!allow) return res.status(403).json({ error: 'control disabled' });
    next();
  }

  router.post('/start', guard, (req, res) => {
    const speed = Number(req.body?.speed);
    if (speed && Number.isFinite(speed) && speed > 0 && speed <= 16) {
      engine.setSpeed(speed);
    }
    engine.start();
    res.json({ status: 'running', speed: engine.state().speed });
  });

  router.post('/pause', guard, (_req, res) => {
    engine.pause();
    res.json({ status: 'paused' });
  });

  router.post('/step', guard, (req, res) => {
    const n = Number(req.body?.ticks ?? 1);
    // Validate and clamp steps
    if (!Number.isFinite(n) || n < 1 || n > 1000) {
      return res.status(400).json({ error: 'invalid ticks (1-1000)' });
    }
    if (engine.running) return res.status(400).json({ error: 'pause first' });
    for (let i = 0; i < n; i++) engine.step();
    res.json({ status: 'paused', tick: engine.state().tick });
  });

  router.post('/speed', guard, (req, res) => {
    try {
      // Support both 'speed' and 'multiplier' for compatibility
      const speed = Number(req.body?.speed ?? req.body?.multiplier);
      if (!Number.isFinite(speed) || speed <= 0 || speed > 16) {
        return res.status(400).json({ error: 'invalid speed (0.25-16)' });
      }
      engine.setSpeed(speed);
      res.json({ status: engine.state().running ? 'running' : 'paused', speed: engine.state().speed });
    } catch (e) {
      res.status(400).json({ error: e?.message || String(e) });
    }
  });

  // Add missing resume and stop endpoints for client compatibility
  router.post('/resume', guard, (_req, res) => {
    if (!engine.running) engine.start();
    res.json({ status: 'running', tick: engine.state().tick });
  });

  router.post('/stop', guard, (_req, res) => {
    engine.pause();
    res.json({ status: 'paused', tick: engine.state().tick });
  });

  // Add state endpoint
  router.get('/state', (_req, res) => {
    const state = engine.state();
    res.json({ 
      running: state.running, 
      speed: state.speed, 
      tick: state.tick,
      status: state.running ? 'running' : 'paused'
    });
  });

  return router;
}

export default { createSimControlRouter };
