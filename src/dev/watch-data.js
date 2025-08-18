/**
 * Utility to watch data directory for changes during development.
 * @module dev/watch-data
 */
import chokidar from 'chokidar';
import logger from '../lib/logger.js';

/**
 * Watch a directory for file changes and log them.
 * @param {string} [dir='data'] - Directory to watch.
 * @returns {import('chokidar').FSWatcher} The file system watcher.
 */
export function watchData(dir = 'data') {
  const watcher = chokidar.watch(dir, { ignoreInitial: true });
  watcher.on('all', (event, path) => {
    logger.info({ event, path }, '📁 data changed');
    // TODO: betroffene JSON neu laden, Caches invalidieren
  });
  return watcher;
}
