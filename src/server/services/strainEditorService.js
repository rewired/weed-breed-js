import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const strainsDir = path.join(__dirname, '..', '..', '..', 'data', 'strains');
const backupDir = path.join(__dirname, '..', '..', '..', 'data', 'strain', 'backup');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(strainsDir);
ensureDir(backupDir);

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function backupIfExists(id) {
  const file = path.join(strainsDir, `${id}.json`);
  if (fs.existsSync(file)) {
    const dest = path.join(backupDir, `${id}-${timestamp()}.json.zip`);
    await pipeline(
      fs.createReadStream(file),
      createGzip(),
      fs.createWriteStream(dest)
    );
  }
}

router.get('/strains', (req, res) => {
  try {
    const files = fs.readdirSync(strainsDir).filter(f => f.endsWith('.json'));
    const list = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(strainsDir, f), 'utf8'));
      return { id: data.id, name: data.name };
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/strains/:id', (req, res) => {
  const { id } = req.params;
  const file = path.join(strainsDir, `${id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/strains', async (req, res) => {
  try {
    const strain = req.body || {};
    const id = strain.id || uuidv4();
    strain.id = id;
    await backupIfExists(id);
    fs.writeFileSync(path.join(strainsDir, `${id}.json`), JSON.stringify(strain, null, 2));
    res.status(201).json(strain);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/strains/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const strain = { ...req.body, id };
    await backupIfExists(id);
    fs.writeFileSync(path.join(strainsDir, `${id}.json`), JSON.stringify(strain, null, 2));
    res.json(strain);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
