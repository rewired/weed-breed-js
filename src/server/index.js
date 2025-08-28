/**
 * HTTP + WS bootstrap for weed-breed.
 * Loads default savegame, seeds RNG and forwards telemetry batches.
 */
import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import express from 'express';
import pino from 'pino';
import seedrandom from 'seedrandom';

import { loadDefaultSavegame } from './loadSavegame.js';
import { attachUiWs } from '../sim/uiStreamWs.js';
import { loadFromSavegame } from '../engine/loaders/savegameLoader.mjs';
import { createEngine } from '../engine/createEngine.js';

const logger = pino({ name: 'server', level: process.env.LOG_LEVEL || 'info' });

async function main() {
  const app = express();
  const server = http.createServer(app);

  const { savegame, meta } = await loadDefaultSavegame({ savegamePathEnv: process.env.SAVEGAME_PATH, logger });

  const rng = seedrandom(meta.seed);
  const rngFn = () => rng();

  // Initialize simulation state from savegame (built in engine)
  // Note: loadFromSavegame kept for compatibility; engine performs its own world build.

  // Optional static serving in production
  if (process.env.NODE_ENV === 'production') {
    const dist = path.resolve('apps/client/dist');
    try {
      await fs.stat(dist);
      app.use(express.static(dist));
    } catch {}
  }

  // Attach telemetry WS
  attachUiWs(server, { path: '/ws/ui', logger });

  const tickMs = Number(process.env.TICK_MS || 100);
  const engine = createEngine({ savegame, rng: rngFn, tickMs, logger });
  await engine.start();

  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => {
    logger.info({ msg: 'server started', port, savegamePath: meta.pathResolved, seed: meta.seed, tickMs });
  });

  const shutdown = (sig) => {
    logger.info({ msg: 'shutting down', sig });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(err => {
  logger.error(err);
  process.exit(1);
});
