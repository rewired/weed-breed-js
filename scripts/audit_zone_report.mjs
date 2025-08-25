#!/usr/bin/env node
/**
 * Weed Breed – Audit daily report & harvest events
 * Node.js v23+, ESM
 *
 * Usage:
 *   node scripts/audit_zone_report.mjs <daily.jsonl> [events.jsonl]
 */
import fs from 'node:fs';
import readline from 'node:readline';
import { EOL } from 'node:os';

const [,, dailyPath, eventsPath] = process.argv;
if (!dailyPath) {
  console.error('Usage: node scripts/audit_zone_report.mjs <daily.jsonl> [events.jsonl]');
  process.exit(1);
}

function format(num, digits=2) {
  if (num === null || num === undefined || Number.isNaN(num)) return '';
  return Number(num).toFixed(digits);
}
function pad(str, len, alignRight=false) {
  const s = String(str ?? '');
  if (alignRight) return s.length >= len ? s : ' '.repeat(len - s.length) + s;
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}
async function readJSONL(path, onObj) {
  const rl = readline.createInterface({
    input: fs.createReadStream(path, { encoding: 'utf-8' }),
    crlfDelay: Infinity
  });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { await onObj(JSON.parse(trimmed)); }
    catch (err) { console.error(`Invalid JSON at ${path}: ${err?.message}`); }
  }
}

const zones = new Map();
// zones.set(zoneId, { plantsTotal, days: Map(day -> {totalBiomass_g,totalBuds_g,harvestedPlants?}),
//                     events: { harvestDays:Set, harvestByPlant: Map(plantId->{count,days:Set}) } });

await readJSONL(dailyPath, (o) => {
  const { day, zoneId } = o;
  if (day == null || !zoneId) return;
  if (!zones.has(zoneId)) {
    zones.set(zoneId, {
      plantsTotal: (typeof o.plantsTotal === 'number') ? o.plantsTotal : null,
      days: new Map(),
      events: { harvestDays: new Set(), harvestByPlant: new Map() }
    });
  }
  const z = zones.get(zoneId);
  if (z.plantsTotal == null && typeof o.plantsTotal === 'number') z.plantsTotal = o.plantsTotal;
  z.days.set(Number(day), {
    totalBiomass_g: Number(o.totalBiomass_g ?? 0),
    totalBuds_g: Number(o.totalBuds_g ?? 0),
    harvestedPlants: (typeof o.harvestedPlants === 'number') ? o.harvestedPlants : null
  });
});

if (eventsPath && fs.existsSync(eventsPath)) {
  await readJSONL(eventsPath, (e) => {
    if (!e || e.type !== 'HARVEST') return;
    const { day, zoneId, plantId } = e;
    if (!zoneId || day == null) return;
    if (!zones.has(zoneId)) {
      zones.set(zoneId, {
        plantsTotal: null, days: new Map(),
        events: { harvestDays: new Set(), harvestByPlant: new Map() }
      });
    }
    const z = zones.get(zoneId);
    z.events.harvestDays.add(Number(day));
    if (plantId) {
      const rec = z.events.harvestByPlant.get(plantId) ?? { count: 0, days: new Set() };
      rec.count += 1; rec.days.add(Number(day));
      z.events.harvestByPlant.set(plantId, rec);
    }
  });
}

function summarizeZone(zoneId, z) {
  const days = [...z.days.keys()].sort((a,b)=>a-b);
  const firstDay = days[0] ?? null;
  const lastDay = days[days.length-1] ?? null;

  const day1Biomass_g = firstDay != null ? z.days.get(firstDay)?.totalBiomass_g ?? null : null;
  const totalBiomass_g = lastDay != null ? z.days.get(lastDay)?.totalBiomass_g ?? null : null;
  const totalBuds_g = lastDay != null ? z.days.get(lastDay)?.totalBuds_g ?? null : null;

  let harvestEvents = null, firstHarvestDay = null, lastHarvestDay = null;

  if (z.events.harvestDays.size > 0) {
    const dlist = [...z.events.harvestDays].sort((a,b)=>a-b);
    firstHarvestDay = dlist[0]; lastHarvestDay = dlist[dlist.length-1];
    harvestEvents = [...z.events.harvestByPlant.values()].reduce((acc, r) => acc + r.count, 0);
    const distinctHarvestedPlants = z.events.harvestByPlant.size;
    return { zoneId, plantsTotal: z.plantsTotal, day1Biomass_g, totalBiomass_g, totalBuds_g,
             harvestEvents, distinctHarvestedPlants, firstHarvestDay, lastHarvestDay };
  } else {
    // fallback via harvestedPlants cumulative
    let prev = 0, f = null, l = null, inferredEvents = 0;
    for (const d of days) {
      const hp = z.days.get(d)?.harvestedPlants;
      if (typeof hp === 'number' && hp > prev) {
        const delta = hp - prev; inferredEvents += delta;
        if (f == null) f = d; l = d; prev = hp;
      } else if (typeof hp === 'number') {
        prev = hp;
      }
    }
    harvestEvents = inferredEvents > 0 ? inferredEvents : null;
    firstHarvestDay = f; lastHarvestDay = l;
    return { zoneId, plantsTotal: z.plantsTotal, day1Biomass_g, totalBiomass_g, totalBuds_g,
             harvestEvents, distinctHarvestedPlants: null, firstHarvestDay, lastHarvestDay };
  }
}

const summaries = [];
for (const [zoneId, z] of zones) summaries.push(summarizeZone(zoneId, z));

const headers = ['zoneId','plantsTotal','day1Biomass_g','totalBiomass_g','totalBuds_g','harvestEvents','firstHarvestDay','lastHarvestDay'];
const widths  = [18,12,16,16,14,14,16,16];
const headerLine = headers.map((h,i)=>pad(h,widths[i])).join(' | ');
const sepLine    = headers.map((_,i)=>'-'.repeat(widths[i])).join('-|-');
console.log(headerLine); console.log(sepLine);

for (const s of summaries) {
  const row = [
    pad(s.zoneId, widths[0]),
    pad(s.plantsTotal ?? '', widths[1], true),
    pad(format(s.day1Biomass_g), widths[2], true),
    pad(format(s.totalBiomass_g), widths[3], true),
    pad(format(s.totalBuds_g), widths[4], true),
    pad(s.harvestEvents ?? '', widths[5], true),
    pad(s.firstHarvestDay ?? '', widths[6], true),
    pad(s.lastHarvestDay ?? '', widths[7], true),
  ].join(' | ');
  console.log(row);
}

console.log(EOL + 'Warnings:');
let anyWarn = false;
for (const s of summaries) {
  if (s.day1Biomass_g != null && s.totalBiomass_g != null && s.day1Biomass_g > s.totalBiomass_g * 1.1) {
    anyWarn = true;
    console.log(`- [${s.zoneId}] day1Biomass_g (${format(s.day1Biomass_g)}) >> totalBiomass_g (${format(s.totalBiomass_g)}): use end-of-day snapshot, not cumulative sum.`);
  }
  if (s.harvestEvents != null && s.plantsTotal != null && s.harvestEvents > s.plantsTotal) {
    anyWarn = true;
    console.log(`- [${s.zoneId}] harvestEvents (${s.harvestEvents}) > plantsTotal (${s.plantsTotal}): repeated harvest trigger per plant.`);
  }
  if ((s.totalBuds_g ?? 0) <= 0 && (s.harvestEvents ?? 0) > 0) {
    anyWarn = true;
    console.log(`- [${s.zoneId}] totalBuds_g is 0 but harvestEvents present: ensure buds are accounted before zeroing or snapshot timing is correct.`);
  }
}
if (!anyWarn) console.log('- none');
