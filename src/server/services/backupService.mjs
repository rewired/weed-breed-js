import fs from 'fs/promises';
import path from 'path';
import { config, paths } from '../config.mjs';

function fmtDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function fmtTime(d) {
  return d.toISOString().slice(11, 19).replace(/:/g, '');
}

export async function backupBeforeWrite(absPath) {
  try {
    await fs.access(absPath);
  } catch {
    return; // nothing to backup
  }
  const rel = path.relative(config.dataDir, absPath);
  const now = new Date();
  const dir = path.join(paths.backups, fmtDate(now), fmtTime(now));
  const dest = path.join(dir, `${rel}.bak.json`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(absPath, dest);
  await enforceRetention();
}

export async function enforceRetention() {
  const cutoff = Date.now() - config.backupRetentionDays * 24 * 60 * 60 * 1000;
  const entries = await fs.readdir(paths.backups).catch(() => []);
  for (const entry of entries) {
    const dir = path.join(paths.backups, entry);
    const stat = await fs.stat(dir).catch(() => null);
    if (!stat || !stat.isDirectory()) continue;
    const t = Date.parse(`${entry.slice(0,4)}-${entry.slice(4,6)}-${entry.slice(6,8)}`);
    if (isNaN(t)) continue;
    if (t < cutoff) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
}
