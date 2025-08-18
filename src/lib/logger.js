/**
 * Application wide logger utilities.
 * @module lib/logger
 */
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Preconfigured Pino logger instance.
 * @type {import('pino').Logger}
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined
});

export default logger;
