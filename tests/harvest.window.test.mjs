import fs from 'node:fs';
import { execSync } from 'node:child_process';

describe.skip('harvest window', () => {
  test('zones produce harvest events', () => {
    execSync('node src/sim/run_from_savegame.mjs --days 120', { stdio: 'inherit' });
    const lines = fs.readFileSync('reports/sim_default_daily.jsonl', 'utf8').trim().split(/\n+/).filter(Boolean);
    const entries = lines.map(l => JSON.parse(l));
    const zoneIds = [...new Set(entries.map(e => e.zoneId))];
    for (const id of zoneIds) {
      const arr = entries.filter(e => e.zoneId === id);
      const harvestEvents = arr.reduce((m, e) => Math.max(m, e.harvestEvents ?? 0), 0);
      expect(harvestEvents).toBeGreaterThan(0);
      const first = Math.min(...arr.map(e => e.firstHarvestDay ?? Infinity));
      const last = Math.max(...arr.map(e => e.lastHarvestDay ?? -Infinity));
      expect(first).toBeLessThanOrEqual(last);
    }
  });
});
