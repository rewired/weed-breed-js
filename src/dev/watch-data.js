import chokidar from 'chokidar';
import logger from '../lib/logger.js';

export function watchData(dir = 'data') {
  const watcher = chokidar.watch(dir, { ignoreInitial: true });
  watcher.on('all', (event, path) => {
    logger.info({ event, path }, '📁 data changed');
    // TODO: betroffene JSON neu laden, Caches invalidieren
  });
  return watcher;
}
