import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Load the default savegame resolving files or directories and derive seed.
 * @param {{savegamePathEnv?:string, logger?:import('pino').Logger}} opts
 * @returns {Promise<{savegame:object, meta:{seed:string,pathResolved:string}}>} 
 */
export async function loadDefaultSavegame({ savegamePathEnv, logger = console } = {}) {
  const base = savegamePathEnv || process.env.SAVEGAME_PATH || 'data/savegames/default';
  let savegame = null;
  let pathResolved = base;

  async function readJson(p) {
    const txt = await fs.readFile(p, 'utf8');
    return JSON.parse(txt);
  }

  try {
    const stat = await fs.stat(base);
    if (stat.isDirectory()) {
      const candidates = ['index.json', 'savegame.json'];
      for (const name of candidates) {
        const p = path.join(base, name);
        try {
          savegame = await readJson(p);
          pathResolved = p;
          break;
        } catch {}
      }
      if (!savegame) {
        const files = (await fs.readdir(base))
          .filter(f => f.toLowerCase().endsWith('.json'))
          .sort();
        if (!files.length) throw new Error('No JSON files in savegame directory');
        pathResolved = path.join(base, files[0]);
        savegame = await readJson(pathResolved);
      }
    } else {
      savegame = await readJson(base);
      pathResolved = base;
    }
  } catch (err) {
    logger.error?.({ msg: 'Failed to load savegame', base, err: String(err) });
    throw err;
  }

  if (!(savegame && (savegame.structure || savegame.structures || savegame.world))) {
    logger.warn?.({ msg: 'Savegame missing expected top-level structure', pathResolved });
  }

  const seed = process.env.SIM_SEED || savegame?.meta?.seed || 'weed-breed-default';
  return { savegame, meta: { seed, pathResolved } };
}
