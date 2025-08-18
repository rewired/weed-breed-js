/**
 * Helpers for loading simulation savegames.
 * @module server/services/savegameLoader
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const savegamesDir = path.join(__dirname, '..', '..', '..', 'data', 'savegames');

/**
 * Loads and parses a savegame file.
 * @param {string} name - The name of the savegame file (without .json extension).
 * @returns {Promise<object>} The parsed savegame configuration.
 * @throws {Error} If the file cannot be found or parsed.
 */
export async function loadSavegame(name = 'default') {
  const filePath = path.join(savegamesDir, `${name}.json`);

  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const config = JSON.parse(data);
    // Optional: Add validation logic here later if needed (e.g., with a JSON schema)
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Savegame file not found: ${filePath}`);
    } else if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in savegame file: ${filePath}`);
    } else {
      throw new Error(`Failed to load savegame ${name}: ${error.message}`);
    }
  }
}
