// src/engine/deviceLoader.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// <root>/data/devices/*.json
const DEVICES_DIR = path.resolve(__dirname, '../../../data/devices');

async function readJson(fp) {
  const raw = await fs.readFile(fp, 'utf-8');
  return JSON.parse(raw);
}

function basicValidateDevice(d) {
  const errors = [];
  for (const k of ['id', 'kind', 'name', 'settings']) {
    if (!(k in d)) errors.push(`Missing key: ${k}`);
  }
  return errors;
}

export async function loadDeviceBySlug(slug) {
  const fp = path.join(DEVICES_DIR, `${slug}.json`);
  const d = await readJson(fp);
  const errors = basicValidateDevice(d);
  if (errors.length) throw new Error(`Device "${slug}" validation failed:\n- ${errors.join('\n- ')}`);
  return d;
}

export async function loadAllDevices() {
  const files = await fs.readdir(DEVICES_DIR);
  const list = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const d = await readJson(path.join(DEVICES_DIR, f));
    if (!basicValidateDevice(d).length) list.push(d);
  }
  return list;
}
