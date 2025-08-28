import fs from 'fs/promises';
import path from 'path';

export async function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, filePath);
}

export async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return undefined;
    throw err;
  }
}

export async function listJsonFiles(dir) {
  const files = await fs.readdir(dir);
  return files.filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f));
}
