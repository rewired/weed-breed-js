import fs from 'node:fs';

const reportDefault = 'reports/sim_default_daily.jsonl';
const reportLegacy = 'reports/sim_daily.jsonl';
const file = fs.existsSync(reportDefault) ? reportDefault : reportLegacy;
if (!fs.existsSync(file)) {
  console.error('Report file not found:', file);
  process.exit(1);
}

const lines = fs.readFileSync(file, 'utf8').trim().split(/\n+/).filter(Boolean);
const entries = lines.map(l => JSON.parse(l));

const zoneMap = new Map();
for (const e of entries) {
  if (!e.zoneId) continue;
  const arr = zoneMap.get(e.zoneId) || [];
  arr.push(e);
  zoneMap.set(e.zoneId, arr);
}

const summary = [];
for (const [zoneId, arr] of zoneMap.entries()) {
  const day1 = arr.find(a => a.day === 1) || arr[0];
  const lastWithPlants = [...arr].reverse().find(a => (a.plantsTotal ?? 0) > 0) || arr[arr.length - 1];
  const harvestEvents = arr.reduce((m, a) => Math.max(m, a.harvestEvents ?? 0), 0);
  const firstHarvestDay = Math.min(...arr.map(a => a.firstHarvestDay ?? Infinity));
  const lastHarvestDay = Math.max(...arr.map(a => a.lastHarvestDay ?? -Infinity));
  // BEGIN: REPLANTING v1 (do not remove)
  const replantsAttempted = arr.reduce((s, a) => s + (a.replantsAttempted ?? 0), 0);
  const replantsSucceeded = arr.reduce((s, a) => s + (a.replantsSucceeded ?? 0), 0);
  const replantsSkipped = arr.reduce((s, a) => s + (a.replantsSkipped ?? 0), 0);
  const finalOccupancy = (lastWithPlants?.plantsTotal ?? 0) / (lastWithPlants?.capacity ?? 1);
  const seedCostEUR = arr.reduce((s, a) => s + (a.seedCostEUR ?? 0), 0);
  const substrateCostEUR = arr.reduce((s, a) => s + (a.substrateCostEUR ?? 0), 0);
  const skips = {
    zoneNotEmpty: arr.reduce((s, a) => s + (a.skips?.zoneNotEmpty ?? 0), 0),
    cooldownWindow: arr.reduce((s, a) => s + (a.skips?.cooldownWindow ?? 0), 0),
    noSeedPrice: arr.reduce((s, a) => s + (a.skips?.noSeedPrice ?? 0), 0),
    noBudget: arr.reduce((s, a) => s + (a.skips?.noBudget ?? 0), 0),
  };
  // END: REPLANTING v1
  summary.push({
    zoneId,
    plantsTotal: day1?.plantsTotal ?? 0,
    day1Biomass_g: day1?.totalBiomass_g ?? 0,
    totalBiomass_g: lastWithPlants?.totalBiomass_g ?? 0,
    harvestEvents,
    firstHarvestDay: isFinite(firstHarvestDay) ? firstHarvestDay : null,
    lastHarvestDay: isFinite(lastHarvestDay) ? lastHarvestDay : null,
    // BEGIN: REPLANTING v1 (do not remove)
    replantsAttempted,
    replantsSucceeded,
    replantsSkipped,
    finalOccupancy,
    seedCostEUR,
    substrateCostEUR,
    skips,
    // END: REPLANTING v1
  });
  if (harvestEvents === 0 && (day1?.totalBiomass_g ?? 0) > (lastWithPlants?.totalBiomass_g ?? 0) * 5) {
    console.warn(`Warning: ${zoneId} lost biomass without harvest events`);
  }
}

console.table(summary);
