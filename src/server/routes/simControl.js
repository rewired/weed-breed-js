import express from 'express';

/**
 * HTTP control endpoints for the simulation.
 * @param {{ engine: any }} opts
 */
export function createSimControlRouter({ engine }) {
  const router = express.Router();
  router.use(express.json());

  const allow = String(process.env.ALLOW_UNSAFE_CONTROL || 'true').toLowerCase() === 'true';
  function guard(_req, res, next) {
    if (!allow) return res.status(403).json({ error: 'control disabled' });
    next();
  }

  router.post('/start', guard, (_req, res) => {
    engine.start();
    res.json({ status: 'running' });
  });

  router.post('/pause', guard, (_req, res) => {
    engine.pause();
    res.json({ status: 'paused' });
  });

  router.post('/step', guard, (req, res) => {
    const n = Number(req.body?.ticks ?? 1);
    if (engine.running) return res.status(400).json({ error: 'pause first' });
    for (let i = 0; i < n; i++) engine.step();
    res.json({ status: 'paused', tick: engine.state().tick });
  });

  router.post('/speed', guard, (req, res) => {
    try {
      const m = Number(req.body?.multiplier);
      engine.setSpeed(m);
      res.json({ status: engine.state().running ? 'running' : 'paused', speed: engine.state().speed });
    } catch (e) {
      res.status(400).json({ error: e?.message || String(e) });
    }
  });

  return router;
}

export default { createSimControlRouter };
