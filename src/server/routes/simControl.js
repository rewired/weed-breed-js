import express from 'express';

/**
 * Create router for simulation control.
 * @param {{ engine: any, dispatch: Function, logger?: any, meta?: any }} opts
 */
export function createSimControlRouter({ engine, dispatch, logger, meta }) {
  const router = express.Router();
  router.use(express.json());

  const token = process.env.SIM_CONTROL_TOKEN;
  let warned = false;
  function requireControlToken(req, res, next) {
    if (token) {
      if (req.get('X-Sim-Control') === token) return next();
      return res.status(401).end();
    }
    if (!warned) {
      logger?.warn?.('SIM_CONTROL_TOKEN not set; allowing unauthenticated control (dev mode).');
      warned = true;
    }
    next();
  }

  const call = (cmd) => dispatch(cmd, { engine, logger, meta });

  router.post('/start', requireControlToken, async (req, res) => {
    await call({ type: 'sim.start' });
    res.json({ ok: true });
  });

  router.post('/stop', requireControlToken, async (req, res) => {
    await call({ type: 'sim.stop' });
    res.json({ ok: true });
  });

  router.post('/speed', requireControlToken, async (req, res) => {
    const tickMs = Number(req.body?.tickMs);
    if (!Number.isFinite(tickMs) || tickMs < 10) {
      return res.status(400).json({ error: 'tickMs must be >=10' });
    }
    await call({ type: 'sim.setSpeed', payload: { tickMs } });
    res.json({ ok: true, tickMs });
  });

  router.get('/status', requireControlToken, async (req, res) => {
    const status = await call({ type: 'sim.status' });
    res.json(status);
  });

  return router;
}

export default { createSimControlRouter };

