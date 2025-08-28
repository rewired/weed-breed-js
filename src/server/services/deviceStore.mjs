import path from 'path';
import { paths } from '../config.mjs';
import { listJsonFiles, readJsonIfExists, writeJsonAtomic } from './fsUtils.mjs';
import { backupBeforeWrite } from './backupService.mjs';

export const draftPath = (id) => path.join(paths.drafts.devices, `${id}.json`);
export const pubPath = (id) => path.join(paths.published.devices, `${id}.json`);

export async function listDraftIds() {
  const files = await listJsonFiles(paths.drafts.devices);
  return files.map((f) => path.basename(f, '.json'));
}

export async function listPublishedIds() {
  const files = await listJsonFiles(paths.published.devices);
  return files.map((f) => path.basename(f, '.json'));
}

export async function publishOne(id) {
  const data = await readJsonIfExists(draftPath(id));
  if (!data) throw new Error('not found');
  const fp = pubPath(id);
  await backupBeforeWrite(fp);
  await writeJsonAtomic(fp, data);
}

export async function publishAllMissing() {
  const drafts = await listDraftIds();
  const published = new Set(await listPublishedIds());
  for (const id of drafts) {
    if (!published.has(id)) {
      await publishOne(id);
    }
  }
}
