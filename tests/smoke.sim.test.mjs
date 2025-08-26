import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const reportPath = path.resolve('reports', 'sim_daily.jsonl');

function runSim(days) {
  if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
  execSync('node src/sim/run_demo.mjs', {
    env: { ...process.env, SIM_DAYS: String(days) },
    stdio: 'ignore'
  });
  const lines = fs.readFileSync(reportPath, 'utf8').trim().split(/\n+/).filter(Boolean);
  return lines.map(l => JSON.parse(l));
}

test('day1 biomass > 0 and zoneId consistent', () => {
  const entries = runSim(10);
  expect(entries[0].totalBiomass_g).toBeGreaterThan(0);
  expect(entries.every(e => e.zoneId === 'zone1')).toBe(true);
});

test.skip('harvest occurs within 120 days', () => {
  const entries = runSim(120);
  expect(entries.some(e => e.harvestEvents > 0)).toBe(true);
});
