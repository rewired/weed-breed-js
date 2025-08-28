import fs from 'fs/promises';
import path from 'path';
import os from 'os';

let store, paths;

beforeAll(async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-'));
  process.env.WB_DATA_DIR = tmp;
  const cfg = await import('../src/server/config.mjs');
  await cfg.ensureDataDirs();
  paths = cfg.paths;
  store = await import('../src/server/services/strainStore.mjs');
});

describe('strainStore', () => {
  test('saveDraft writes and creates backup on overwrite', async () => {
    const d = store.createDraft({ name: 'A', genotype: { sativa: 1, indica: 0, ruderalis: 0 } });
    await store.saveDraft(d);
    d.name = 'B';
    await store.saveDraft(d);
    const dates = await fs.readdir(paths.backups);
    expect(dates.length).toBeGreaterThan(0);
  });

  test('publish bumps version', async () => {
    const d = store.createDraft({ name: 'C', genotype: { sativa: 1, indica: 0, ruderalis: 0 } });
    await store.saveDraft(d);
    const pub = await store.publish(d, 'minor');
    expect(pub.meta.version).toBe('1.1.0');
  });
});
