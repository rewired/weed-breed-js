// src/server/strainRouter.mjs
import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data', 'strains');
const PUBLISHED_DIR = path.join(DATA_DIR, 'published');
const DRAFTS_DIR = path.join(DATA_DIR, 'drafts');

async function ensureDirs() {
  await fs.mkdir(PUBLISHED_DIR, { recursive: true });
  await fs.mkdir(DRAFTS_DIR, { recursive: true });
}

async function listJson(dir) {
  try {
    const files = await fs.readdir(dir);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
  } catch { return []; }
}

async function readJsonPreferDraft(id) {
  const draft = path.join(DRAFTS_DIR, `${id}.json`);
  const pub = path.join(PUBLISHED_DIR, `${id}.json`);
  try { return JSON.parse(await fs.readFile(draft, 'utf8')); } catch {}
  return JSON.parse(await fs.readFile(pub, 'utf8'));
}

export function createStrainRouter() {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    await ensureDirs();
    const [pubIds, draftIds] = await Promise.all([
      listJson(PUBLISHED_DIR),
      listJson(DRAFTS_DIR),
    ]);
    const ids = Array.from(new Set([...pubIds, ...draftIds]));
    const items = await Promise.all(ids.map(async (id) => {
      let name = id;
      try { const j = await readJsonPreferDraft(id); name = j?.name || j?.strainName || id; } catch {}
      return { id, name, isPublished: pubIds.includes(id) };
    }));
    res.json(items.sort((a,b) => a.name.localeCompare(b.name)));
  });

  router.get('/:id', async (req, res) => {
    await ensureDirs();
    try {
      const json = await readJsonPreferDraft(req.params.id);
      res.json(json);
    } catch (err) {
      res.status(404).json({ error: 'Not found' });
    }
  });

  router.put('/:id', async (req, res) => {
    await ensureDirs();
    const id = req.params.id;
    const file = path.join(DRAFTS_DIR, `${id}.json`);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    // TODO: optionally validate against schema with ajv
    const content = JSON.stringify(body, null, 2) + '\n';
    await fs.writeFile(file, content, 'utf8');
    res.json({ ok: true, id, location: `drafts/${id}.json` });
  });

  router.post('/:id/publish', async (req, res) => {
    await ensureDirs();
    const id = req.params.id;
    const draft = path.join(DRAFTS_DIR, `${id}.json`);
    const pub = path.join(PUBLISHED_DIR, `${id}.json`);

    // ensure draft exists
    await fs.access(draft);

    // backup existing published
    try {
      await fs.access(pub);
      const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
      const backup = path.join(PUBLISHED_DIR, `${id}.json.bak.${ts}`);
      await fs.rename(pub, backup);
    } catch {}

    await fs.rename(draft, pub);
    res.json({ ok: true, id, location: `published/${id}.json` });
  });

  return { router };
}
