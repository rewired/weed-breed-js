import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const base = path.resolve('logs', 'reports');
let latest = null;
if (fs.existsSync(base)) {
  for (const dir of fs.readdirSync(base)) {
    if (/^\d{8}_\d{6}$/.test(dir)) {
      if (!latest || dir > latest) latest = dir;
    }
  }
}
if (!latest) {
  console.error('No report runs found in logs/reports');
  process.exit(1);
}
const runDir = path.join(base, latest);
const files = fs.readdirSync(runDir);
let daily = files.find(f => f === 'sim_200d_daily.jsonl');
if (!daily) daily = files.find(f => /^sim_\d+d_daily\.jsonl$/.test(f));
if (!daily) {
  console.error('No daily report found in', runDir);
  process.exit(1);
}
const dailyPath = path.join(runDir, daily);
const eventsPath = fs.existsSync(path.join(runDir, 'events.jsonl')) ? path.join(runDir, 'events.jsonl') : null;

const args = ['scripts/audit_zone_report.mjs', dailyPath];
if (eventsPath) args.push(eventsPath);
const res = spawnSync('node', args, { stdio: 'inherit' });
process.exit(res.status ?? 0);
