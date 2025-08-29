/**
 * Server App factory to start/stop HTTP + WS + Engine programmatically.
 */
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { attachLogHelpers } from '../lib/logging.mjs';
import { createRng } from '../lib/rng.mjs';
import { resolveProjectPath } from '../lib/pathutil.mjs';

import { loadDefaultSavegame } from './loadSavegame.js';
import { attachUiWs } from '../sim/uiStreamWs.js';
import { createEngine } from '../engine/createEngine.js';
import { register, dispatch } from '../sim/commandBus.js';
import { createSimControlRouter } from './routes/simControl.js';
import { ensureDataDirs } from './config.mjs';

/**
 * @param {{ port?: number, tickMs?: number, autoStart?: boolean, logger?: any }} opts
 * @returns {Promise<{ start(): Promise<void>, stop(): Promise<void>, isRunning(): boolean, port: number, engine: any, httpServer: import('http').Server }>}
 */
export async function createServerApp(opts = {}) {
  await ensureDataDirs();

  const logger = opts.logger || attachLogHelpers(pino({ name: 'server', level: process.env.LOG_LEVEL || 'info' }));

  // Resolve env/opts
  const port = Number(opts.port ?? process.env.PORT ?? 3000);
  const tickMs = Number(opts.tickMs ?? process.env.TICK_MS ?? 100);
  const autoStart = opts.autoStart ?? (process.env.AUTO_START == null ? true : !/^false|0$/i.test(String(process.env.AUTO_START)));

  const savegamePath = resolveProjectPath(
    process.env.SAVEGAME_PATH || 'data/savegames/default.json'
  );
  logger.info({ savegamePath }, 'Using savegame path');
  const { savegame, meta } = await loadDefaultSavegame({ savegamePathEnv: savegamePath, logger });
  const seed = process.env.SIM_SEED || meta.seed || 'weed-breed-default';
  const rng = createRng(seed);

  // Express + HTTP server
  const app = express();
  const httpServer = http.createServer(app);

  app.use(cors({ origin: true, credentials: true }));
  app.get('/healthz', (req, res) => {
    res.json({ ok: true, uptime_s: process.uptime(), pid: process.pid });
  });

  // Attach WS forwarder (read-only telemetry)
  attachUiWs(httpServer, { path: '/ui', logger });

  // Create engine
  const engine = createEngine({ savegame, rng, tickMs, logger, savegamePath });

  // Command bus registrations
  register('sim.start',   ({ engine }) => { engine.start(); });
  register('sim.stop',    ({ engine }) => { engine.stop(); });
  register('sim.setSpeed',({ engine, payload }) => { engine.setSpeed(Number(payload?.tickMs)); });
  register('sim.status',  ({ engine }) => ({
    running: engine.isRunning(),
    tick: engine.getTick(),
    tickMs: engine.getTickMs(),
    seed,
    savegamePath: meta.pathResolved,
  }));

  app.use('/api/sim', createSimControlRouter({ engine, dispatch, logger, meta: { seed, savegamePath: meta.pathResolved } }));

  let listening = false;

  async function start() {
    if (!listening) {
      await new Promise((resolve) => {
        httpServer.listen(port, resolve);
      });
      listening = true;
      logger.info(
        { name: 'server', port, vitePort: 5173, env: process.env.NODE_ENV, logLevel: logger.level },
        'Server listening'
      );
    }
    if (autoStart !== false && !engine.isRunning()) {
      await engine.start();
    }
  }

  async function stop() {
    try { await engine.stop?.(); } catch {}
    await new Promise((resolve) => {
      if (!listening) return resolve();
      httpServer.close(() => resolve());
    });
    listening = false;
  }

  // Auto-start engine if requested; HTTP starts only on start()
  if (autoStart && !engine.isRunning()) {
    await engine.start();
  }

  return {
    start,
    stop,
    isRunning: () => engine.isRunning(),
    port,
    engine,
    httpServer,
    app,
  };
}

export default { createServerApp };

