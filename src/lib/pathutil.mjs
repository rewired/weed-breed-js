// src/lib/pathutil.mjs
/**
 * Minimal ESM-safe path helpers.
 */
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Project root: ../../ from this file (src/lib → project root)
const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * Resolve a possibly relative path against the project root.
 * @param {string} p
 * @returns {string} absolute path
 */
export function resolveProjectPath(p = '') {
  return path.isAbsolute(p) ? p : path.resolve(PROJECT_ROOT, p);
}
