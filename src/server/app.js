/**
 * Server App factory to start/stop HTTP + WS + Engine programmatically.
 */
import dotenv from 'dotenv';
import http from 'node:http';
import express from 'express';
import pino from 'pino';
import seedrandom from 'seedrandom';

import { loadDefaultSavegame } from './loadSavegame.js';
import { attachUiWs } from '../sim/uiStreamWs.js';
import { createEngine } from '../engine/createEngine.js';

/**
 * @param {{ port?: number, tickMs?: number, autoStart?: boolean, logger?: any }} opts
 * @returns {Promise<{ start(): Promise<void>, stop(): Promise<void>, isRunning(): boolean, port: number, engine: any, httpServer: import('http').Server }>}
 */
export async function createServerApp(opts = {}) {
  // Load .env within the factory
  dotenv.config();

  const logger = opts.logger || pino({ name: 'server', level: process.env.LOG_LEVEL || 'info' });

  // Resolve env/opts
  const port = Number(opts.port ?? process.env.PORT ?? 3000);
  const tickMs = Number(opts.tickMs ?? process.env.TICK_MS ?? 100);
  const autoStart = opts.autoStart ?? (process.env.AUTO_START == null ? true : !/^false|0$/i.test(String(process.env.AUTO_START)));

  const { savegame, meta } = await loadDefaultSavegame({ savegamePathEnv: process.env.SAVEGAME_PATH, logger });
  const seed = process.env.SIM_SEED || meta.seed || 'weed-breed-default';
  const rng = seedrandom(seed);
  const rngFn = () => rng();

  // Express + HTTP server
  const app = express();
  const httpServer = http.createServer(app);

  // Attach WS forwarder (read-only telemetry)
  attachUiWs(httpServer, { path: '/ws/ui', logger });

  // Create engine
  const engine = createEngine({ savegame, rng: rngFn, tickMs, logger });

  let listening = false;

  async function start() {
    if (!listening) {
      await new Promise((resolve) => {
        httpServer.listen(port, resolve);
      });
      listening = true;
      logger.info({ msg: 'server listening', port, seed, tickMs, savegamePath: meta.pathResolved });
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
  };
}

export default { createServerApp };

