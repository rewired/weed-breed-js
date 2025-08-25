import fs from 'fs';

const dailyFile = 'reports/sim_200d_daily.jsonl';
const summaryFile = 'reports/sim_200d_summary.json';
const haveArtifacts = fs.existsSync(dailyFile) && fs.existsSync(summaryFile);

if (!haveArtifacts) {
  console.warn('sim_daily_snapshot.test skipped: run `npm run sim:200d:report` and `npm run sim:recompute` to generate artifacts.');
}

(haveArtifacts ? test : test.skip)('daily snapshots are per-day and unique', () => {
  const lines = fs.readFileSync(dailyFile, 'utf8').trim().split('\n').filter(Boolean);
  const rows = lines.map(l => JSON.parse(l));

  const pairSet = new Set();
  const zoneMap = new Map();
  for (const r of rows) {
    const key = `${r.zoneId}-${r.day}`;
    expect(pairSet.has(key)).toBe(false);
    pairSet.add(key);
    if (!zoneMap.has(r.zoneId)) zoneMap.set(r.zoneId, []);
    zoneMap.get(r.zoneId).push(r);
  }

  const zoneCount = zoneMap.size;
  const maxDay = Math.max(...rows.map(r => r.day));
  expect(rows.length).toBe(zoneCount * maxDay);

  for (const [zoneId, arr] of zoneMap) {
    arr.sort((a, b) => a.day - b.day);
    const first = arr[0];
    const last = arr[arr.length - 1];
    expect(last.totalBiomass_g).toBeGreaterThanOrEqual(first.totalBiomass_g);
    expect(last.totalBiomass_g).toBeGreaterThan(0);
  }
});
