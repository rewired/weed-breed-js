import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const difficultyConfigPath = path.join(__dirname, '..', '..', '..', 'data', 'config', 'difficulty.json');

/**
 * Loads the difficulty settings from the configuration file.
 * @returns {Promise<Object>} A promise that resolves to the difficulty settings object.
 */
export async function loadDifficultyConfig() {
  try {
    const data = await fs.readFile(difficultyConfigPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load difficulty configuration:', error);
    // Return a default or empty object in case of an error
    return {
      easy: { modifiers: {} },
      normal: { modifiers: {} },
      hard: { modifiers: {} },
    };
  }
}
