import fs from 'node:fs';

const file = 'reports/sim_daily.jsonl';
if (!fs.existsSync(file)) {
  console.error('Report file not found:', file);
  process.exit(1);
}

const lines = fs.readFileSync(file, 'utf8').trim().split(/\n+/).filter(Boolean);
const entries = lines.map(l => JSON.parse(l));
const first = entries[0] || {};
const last = entries[entries.length - 1] || {};
const maxBio = entries.reduce((m, e) => Math.max(m, e.totalBiomass_g ?? 0), 0);

console.log('day1Biomass_g:', first.totalBiomass_g ?? null);
console.log('totalBiomass_g:', maxBio);
console.log('harvestEvents:', last.harvestEvents ?? 0);
console.log('firstHarvestDay:', last.firstHarvestDay ?? null);
console.log('lastHarvestDay:', last.lastHarvestDay ?? null);
