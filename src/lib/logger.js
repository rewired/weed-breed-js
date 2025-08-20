/**
 * Application wide logger utilities.
 * @module lib/logger
 */
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Preconfigured Pino logger instance.
 * Uses a conservative log level by default to avoid noisy output.
 * Set the `LOG_LEVEL` environment variable (e.g. `LOG_LEVEL=debug`)
 * when you need more verbose debugging information.
 * @type {import('pino').Logger}
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'info' : 'warn'),
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined
});

export default logger;
