/**
 * Logging helpers for Pino logger to avoid log spam.
 * @module lib/logging
 */

/**
 * Map of keys that have already been logged once.
 * @type {Set<string>}
 */
const seenOnce = new Set();

/**
 * Remember last timestamps per key for rate limited logs.
 * @type {Map<string, number>}
 */
const lastSeen = new Map();

/**
 * Attach helper methods to a Pino logger instance.
 *
 * @param {import('pino').Logger} logger - The logger to extend.
 * @returns {import('pino').Logger} The same logger instance for chaining.
 */
export function attachLogHelpers(logger) {
  /**
   * Log only once per unique key during the process lifetime.
   *
   * @param {string} key - Unique identifier for the log event.
   * @param {import('pino').Level} [level='warn'] - Pino log level to use.
   * @param {object} [obj] - Structured log object.
   * @param {string} [msg] - Human readable message.
   */
  logger.onceKeyed = function onceKeyed(key, level = 'warn', obj, msg) {
    if (seenOnce.has(key)) return;
    seenOnce.add(key);
    this[level]?.(obj, msg);
  };

  /**
   * Create a logger function that is rate limited per key.
   *
   * @param {string} key - Identifier used for tracking last log time.
   * @param {number} intervalMs - Minimum interval between logs in milliseconds.
   * @returns {(level: import('pino').Level, obj?: object, msg?: string) => void}
   *   Function that logs at most once per interval.
   */
  logger.rateLimit = function rateLimit(key, intervalMs) {
    return (level = 'info', obj, msg) => {
      const now = Date.now();
      const last = lastSeen.get(key) || 0;
      if (now - last < intervalMs) return;
      lastSeen.set(key, now);
      this[level]?.(obj, msg);
    };
  };

  return logger;
}

export default { attachLogHelpers };
