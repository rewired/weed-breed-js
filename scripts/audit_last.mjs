import fs from 'node:fs';
import path from 'node:path';

// BEGIN: AUDIT_MONEY v1 (do not remove)
/** Heuristic mapping for accounting/event reasons to cost categories. */
const COST_PREFIX_MAP = [
  { prefix: 'seed:', cat: 'seed' },
  { prefix: 'substrateReset:', cat: 'substrate' },
  { prefix: 'energy:', cat: 'energy' },
  { prefix: 'water:', cat: 'water' },
  { prefix: 'maintenance:', cat: 'maintenance' },
  { prefix: 'labor:', cat: 'labor' },
];

/** Resolve sell price €/g for a strain from strainPrices*.json, tolerant to key naming. */
function resolveSellPricePerGramEur(strainId, pricesIndex) {
  const p = pricesIndex[strainId];
  if (!p) return undefined;
  const keys = [
    'sellPricePerGramEur','flowerSellPricePerGramEur','pricePerGramEur','eurPerGram',
    'sell_price_per_gram_eur','flower_price_eur_g'
  ];
  for (const k of keys) if (p[k] != null) return Number(p[k]);
  return undefined;
}

/** Classify a charge reason string to a known category. */
function classifyCost(reason) {
  if (!reason || typeof reason !== 'string') return undefined;
  const hit = COST_PREFIX_MAP.find(x => reason.startsWith(x.prefix));
  return hit?.cat;
}
// END: AUDIT_MONEY v1

const args = process.argv.slice(2);
const flagMoney = args.includes('--money') || args.includes('--full');
const flagDaily = args.includes('--daily');
const ASSUME_SAME_DAY_SALE = (process.env.ASSUME_SAME_DAY_SALE ?? 'true') !== 'false';
const ENERGY_EUR_PER_KWH = process.env.ENERGY_EUR_PER_KWH ? Number(process.env.ENERGY_EUR_PER_KWH) : undefined;
const WATER_EUR_PER_L = process.env.WATER_EUR_PER_L ? Number(process.env.WATER_EUR_PER_L) : undefined;
const EUR_PER_GRAM_WARN = process.env.EUR_PER_GRAM_WARN ? Number(process.env.EUR_PER_GRAM_WARN) : 3.0;

const reportDefault = 'reports/sim_default_daily.jsonl';
const reportLegacy = 'reports/sim_daily.jsonl';
const file = fs.existsSync(reportDefault) ? reportDefault : reportLegacy;
if (!fs.existsSync(file)) {
  console.error('Report file not found:', file);
  process.exit(1);
}

const lines = fs.readFileSync(file, 'utf8').trim().split(/\n+/).filter(Boolean);
const entries = lines.map(l => JSON.parse(l));

// BEGIN: AUDIT_MONEY v1 (do not remove)
const strainPricesIndex = {};
try {
  for (const f of fs.readdirSync('data')) {
    if (f.startsWith('strainPrices') && f.endsWith('.json')) {
      const raw = JSON.parse(fs.readFileSync(path.join('data', f), 'utf8'));
      Object.assign(strainPricesIndex, raw);
    }
  }
} catch {}
// END: AUDIT_MONEY v1

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

// BEGIN: AUDIT_MONEY v1 (do not remove)
if (flagMoney) {
  const moneyZones = new Map();
  const moneyDaily = [];
  const strainRevenue = new Map();
  const missingPriceStrains = new Set();

  for (const row of entries) {
    if (!row.zoneId) continue;

    const harvestedToday_g = Number(
      row.budsCollectedToday_g ?? row.budsHarvestedToday_g ?? 0
    );
    // Add weighted price resolution per zone/day if multiple strains: use row.strainId[s]/map if available,
    // else fallback to zone default/`lastHarvestStrainId`.

    let pricePerGram;
    if (row.harvestStrainGrams && typeof row.harvestStrainGrams === 'object') {
      let total = 0; let sum = 0;
      for (const [sid, grams] of Object.entries(row.harvestStrainGrams)) {
        const g = Number(grams);
        const p = resolveSellPricePerGramEur(sid, strainPricesIndex);
        if (p != null) {
          total += g; sum += g * p;
          const sr = strainRevenue.get(sid) || { gramsSold: 0, revenue_eur: 0 };
          sr.gramsSold += g; sr.revenue_eur += g * p; strainRevenue.set(sid, sr);
        } else {
          missingPriceStrains.add(sid);
        }
      }
      if (total > 0) pricePerGram = sum / total;
    } else {
      const sid = row.strainId ?? row.strain ?? row.lastHarvestStrainId;
      if (sid != null) {
        const p = resolveSellPricePerGramEur(sid, strainPricesIndex);
        if (p != null) {
          pricePerGram = p;
          const sr = strainRevenue.get(sid) || { gramsSold: 0, revenue_eur: 0 };
          sr.gramsSold += harvestedToday_g; sr.revenue_eur += harvestedToday_g * p; strainRevenue.set(sid, sr);
        } else {
          missingPriceStrains.add(sid);
        }
      }
    }

    const revenueToday_eur = Number(
      row.revenueToday_eur ??
        ((ASSUME_SAME_DAY_SALE && harvestedToday_g > 0 && pricePerGram != null)
          ? harvestedToday_g * pricePerGram
          : 0)
    );

    const costs = {
      seed: Number(row.seedCostEUR ?? row.seedCost_eur ?? row.seedCostToday_eur ?? 0),
      substrate: Number(row.substrateCostEUR ?? row.substrateCost_eur ?? row.substrateCostToday_eur ?? 0),
      energy: Number(row.energyCostToday_eur ?? row.energyCostEUR ?? 0),
      water: Number(row.waterCostToday_eur ?? row.waterCostEUR ?? 0),
      maintenance: 0,
      labor: 0,
      depreciation: Number(row.depreciationToday_eur ?? 0),
    };

    if (costs.energy === 0 && row.energyKWh_today != null && ENERGY_EUR_PER_KWH != null) {
      costs.energy += Number(row.energyKWh_today) * ENERGY_EUR_PER_KWH;
    }
    if (costs.water === 0 && row.waterL_today != null && WATER_EUR_PER_L != null) {
      costs.water += Number(row.waterL_today) * WATER_EUR_PER_L;
    }

    if (Array.isArray(row.accounting?.charges)) {
      for (const c of row.accounting.charges) {
        const cat = classifyCost(c.reason);
        if (cat && costs[cat] !== undefined) {
          costs[cat] += Number(c.amountEur ?? c.amount_eur ?? 0);
        }
      }
    }

    const costsToday_eur = Object.values(costs).reduce((a, b) => a + b, 0);
    const profitToday_eur = revenueToday_eur - costsToday_eur;

    const mz = moneyZones.get(row.zoneId) || {
      zoneId: row.zoneId,
      harvested_g: 0,
      totalBudsCollected_g: 0,
      revenueTotal_eur: 0,
      costsByCat: { seed: 0, substrate: 0, energy: 0, water: 0, maintenance: 0, labor: 0, depreciation: 0 },
    };
    mz.harvested_g += harvestedToday_g;
    mz.totalBudsCollected_g = Number(row.totalBudsCollected_g ?? mz.totalBudsCollected_g);
    mz.revenueTotal_eur += revenueToday_eur;
    for (const k of Object.keys(mz.costsByCat)) mz.costsByCat[k] += costs[k] || 0;
    moneyZones.set(row.zoneId, mz);

    if (flagDaily) {
      moneyDaily.push({
        day: row.day,
        zoneId: row.zoneId,
        harvested_g_today: harvestedToday_g,
        revenueToday_eur,
        costsToday_eur,
        profitToday_eur,
      });
    }
  }

  const zoneMoneySummary = [];
  let hadWarning = false;
  for (const mz of moneyZones.values()) {
    const costsTotal_eur = Object.values(mz.costsByCat).reduce((a, b) => a + b, 0);
    const profitTotal_eur = mz.revenueTotal_eur - costsTotal_eur;
    const eurPerGram = mz.totalBudsCollected_g > 0 ? costsTotal_eur / mz.totalBudsCollected_g : 0;
    const marginPct = mz.revenueTotal_eur > 0 ? profitTotal_eur / mz.revenueTotal_eur : 0;
    zoneMoneySummary.push({
      zoneId: mz.zoneId,
      harvested_g: mz.harvested_g,
      revenueTotal_eur: mz.revenueTotal_eur,
      seedCost_eur: mz.costsByCat.seed,
      substrateCost_eur: mz.costsByCat.substrate,
      energyCost_eur: mz.costsByCat.energy,
      waterCost_eur: mz.costsByCat.water,
      maintenance_eur: mz.costsByCat.maintenance,
      labor_eur: mz.costsByCat.labor,
      depreciation_eur: mz.costsByCat.depreciation,
      costsTotal_eur,
      profitTotal_eur,
      eurPerGram,
      marginPct,
    });

    if (mz.revenueTotal_eur === 0 && mz.totalBudsCollected_g > 0) {
      console.warn(`Warning: harvest without revenue in zone ${mz.zoneId} (ASSUME_SAME_DAY_SALE=false?)`);
      hadWarning = true;
    }
    if (eurPerGram > EUR_PER_GRAM_WARN) {
      console.warn(`Warning: high cost per gram in zone ${mz.zoneId} (${eurPerGram.toFixed(2)} > ${EUR_PER_GRAM_WARN})`);
      hadWarning = true;
    }
    if (marginPct < 0) {
      console.warn(`Warning: negative margin in zone ${mz.zoneId}`);
      hadWarning = true;
    }
  }

  if (missingPriceStrains.size > 0) {
    console.warn('Warning: missing sell price for strains:', [...missingPriceStrains].join(', '));
    hadWarning = true;
  }

  console.table(zoneMoneySummary);
  if (flagDaily && moneyDaily.length) console.table(moneyDaily);

  const strainSummary = [];
  for (const [sid, v] of strainRevenue.entries()) {
    const avg = v.gramsSold > 0 ? v.revenue_eur / v.gramsSold : 0;
    strainSummary.push({ strainId: sid, gramsSold: v.gramsSold, avgSellPrice_eur_g: avg, revenue_eur: v.revenue_eur });
  }
  if (strainSummary.length) console.table(strainSummary);

  const reportDir = 'reports';
  try { fs.mkdirSync(reportDir, { recursive: true }); } catch {}
  const writeCSV = (p, arr) => {
    if (!arr.length) return;
    const headers = Object.keys(arr[0]);
    const lines = [headers.join(',')];
    for (const r of arr) lines.push(headers.map(h => r[h] ?? '').join(','));
    fs.writeFileSync(p, lines.join('\n'));
  };
  writeCSV(path.join(reportDir, 'audit_last.money.zones.csv'), zoneMoneySummary);
  if (flagDaily) writeCSV(path.join(reportDir, 'audit_last.money.daily.csv'), moneyDaily);
  fs.writeFileSync(
    path.join(reportDir, 'audit_last.money.json'),
    JSON.stringify({ zones: zoneMoneySummary, daily: moneyDaily, strains: strainSummary }, null, 2)
  );

  if (hadWarning) process.exit(1);
}
// END: AUDIT_MONEY v1
