import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { paths } from '../config.mjs';
import { writeJsonAtomic, readJsonIfExists, listJsonFiles } from './fsUtils.mjs';
import { backupBeforeWrite } from './backupService.mjs';
import { validateStrain } from '../validation/strainValidation.mjs';

export const draftPath = (id) => path.join(paths.drafts.strains, `${id}.json`);
export const pubPath = (id) => path.join(paths.published.strains, `${id}.json`);

export async function list({ status, query } = {}) {
  const files = [];
  if (!status || status === 'draft') files.push(...await listJsonFiles(paths.drafts.strains));
  if (!status || status === 'published') files.push(...await listJsonFiles(paths.published.strains));
  const out = [];
  for (const fp of files) {
    const s = await readJsonIfExists(fp);
    if (!s) continue;
    if (status && s.meta?.status !== status) continue;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${s.name} ${s.slug} ${s.breeder ?? ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    out.push(s);
  }
  return out;
}

export function createDraft(input) {
  const id = input.id || uuidv4();
  const slug = input.slug || (input.name ? input.name.toLowerCase().replace(/\s+/g, '-') : id);
  const now = new Date().toISOString();
  return {
    ...input,
    id,
    slug,
    meta: {
      status: 'draft',
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
    },
  };
}

export async function saveDraft(draft) {
  const { valid, errors } = validateStrain(draft);
  if (!valid) throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
  const fp = draftPath(draft.id);
  await backupBeforeWrite(fp);
  await writeJsonAtomic(fp, draft);
  return draft;
}

export async function updateDraft(id, patch) {
  const existing = await getDraft(id) || {};
  const merged = {
    ...existing,
    ...patch,
    id,
    slug: patch.slug || existing.slug || (patch.name ? patch.name.toLowerCase().replace(/\s+/g, '-') : id),
    meta: {
      ...existing.meta,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    },
  };
  return await saveDraft(merged);
}

export async function getDraft(id) {
  return await readJsonIfExists(draftPath(id));
}

function bumpVersion(version, bump = 'patch') {
  const parts = (version || '1.0.0').split('.').map((n) => parseInt(n, 10));
  if (bump === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
  else if (bump === 'minor') { parts[1]++; parts[2] = 0; }
  else { parts[2]++; }
  return parts.join('.');
}

export async function publish(draft, bump = 'patch') {
  const { valid, errors } = validateStrain(draft);
  if (!valid) throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
  const pub = {
    ...draft,
    meta: {
      ...(draft.meta || {}),
      status: 'published',
      version: bumpVersion(draft.meta?.version, bump),
      updatedAt: new Date().toISOString(),
    },
  };
  const fp = pubPath(pub.id);
  await backupBeforeWrite(fp);
  await writeJsonAtomic(fp, pub);
  return pub;
}
