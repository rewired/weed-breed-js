import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import express from 'express';

let server;
let base;

beforeAll(async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-'));
  process.env.WB_DATA_DIR = tmp;
  const cfg = await import('../src/server/config.mjs');
  await cfg.ensureDataDirs();
  const { router } = await import('../src/server/routes/strains.mjs');
  const app = express();
  app.use('/api/strains', router);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
});

describe('Strain API', () => {
  test('POST /api/strains', async () => {
    const res = await fetch(`${base}/api/strains`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'A', genotype: { sativa: 1, indica: 0, ruderalis: 0 } }),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
  });

  test('PUT /api/strains/:id', async () => {
    const createRes = await fetch(`${base}/api/strains`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'B', genotype: { sativa: 1, indica: 0, ruderalis: 0 } }),
    });
    const created = await createRes.json();
    const res = await fetch(`${base}/api/strains/${created.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'B2' }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.name).toBe('B2');
  });

  test('POST /api/strains/:id/publish', async () => {
    const createRes = await fetch(`${base}/api/strains`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'C', genotype: { sativa: 1, indica: 0, ruderalis: 0 } }),
    });
    const created = await createRes.json();
    const res = await fetch(`${base}/api/strains/${created.id}/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ versionBump: 'minor' }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.meta.status).toBe('published');
    expect(body.meta.version).toBe('1.1.0');
  });
});
