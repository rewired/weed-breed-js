import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('default savegame simulation', () => {
  test.skip('runs and produces sane daily stats', () => {
    execSync('node src/sim/run_from_savegame.mjs --days 10', { stdio: 'inherit' });
    const fp = path.resolve('reports', 'sim_default_daily.jsonl');
    expect(fs.existsSync(fp)).toBe(true);
    const lines = fs.readFileSync(fp, 'utf8').trim().split(/\n+/).filter(Boolean);
    const last = lines.slice(-10).map(l => JSON.parse(l));
    expect(last.length).toBeGreaterThan(0);
    const day1 = last.find(e => e.day === 1);
    expect(day1).toBeDefined();
    expect(day1.plantsTotal).toBeGreaterThan(0);
    expect(day1.totalBiomass_g).toBeGreaterThan(0);
    for (const e of last) {
      expect(e.totalBiomass_g).toBeGreaterThanOrEqual(0);
      expect(e.totalBuds_g).toBeGreaterThanOrEqual(0);
      expect(e.budsCollectedToday_g).toBeGreaterThanOrEqual(0);
      expect(e.totalBudsCollected_g).toBeGreaterThanOrEqual(0);
      const hours = e.avgPPFD_umol_m2s >= 650 ? 12 : 18;
      const dli = e.avgPPFD_umol_m2s * hours * 3600 / 1e6;
      const rel = Math.abs(e.avgDLI_mol_m2d - dli) / Math.max(1, e.avgDLI_mol_m2d);
      expect(rel).toBeLessThan(0.1);
    }
  });
});
