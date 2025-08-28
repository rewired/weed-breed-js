import fs from 'fs/promises';
import path from 'path';

const dataDir = path.resolve(process.env.WB_DATA_DIR || './data');
const backupRetentionDays = Number(process.env.WB_BACKUP_RETENTION_DAYS || 30);

export const config = {
  dataDir,
  backupRetentionDays,
};

export const paths = {
  drafts: {
    strains: path.join(dataDir, 'drafts/strains'),
    devices: path.join(dataDir, 'drafts/devices'),
  },
  published: {
    strains: path.join(dataDir, 'published/strains'),
    devices: path.join(dataDir, 'published/devices'),
  },
  backups: path.join(dataDir, 'backups'),
};

export async function ensureDataDirs() {
  await Promise.all([
    fs.mkdir(paths.drafts.strains, { recursive: true }),
    fs.mkdir(paths.drafts.devices, { recursive: true }),
    fs.mkdir(paths.published.strains, { recursive: true }),
    fs.mkdir(paths.published.devices, { recursive: true }),
    fs.mkdir(paths.backups, { recursive: true }),
  ]);
}
