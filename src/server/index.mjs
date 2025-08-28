/** Thin runner that delegates to createServerApp for Electron-ready startup. */
import pino from 'pino';
import { createServerApp } from './app.js';
import { router as strainsRouter } from './routes/strains.mjs';
import { router as devicesRouter } from './routes/devices.mjs';

const logger = pino({ name: 'server', level: process.env.LOG_LEVEL || 'info' });

async function main() {
  const port = Number(process.env.PORT || 3000);
  const tickMs = Number(process.env.TICK_MS || 100);
  const autoStart = process.env.AUTO_START == null ? true : !/^false|0$/i.test(String(process.env.AUTO_START));

  const app = await createServerApp({ port, tickMs, autoStart, logger });
  app.app.use('/api/strains', strainsRouter);
  app.app.use('/api/devices', devicesRouter);
  await app.start();
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
