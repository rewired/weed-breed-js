import fs from 'fs';
import { writeFile } from 'node:fs/promises';

/**
 * Compute the arithmetic mean of numeric values.
 * @param {Array<*>} arr
 * @returns {number|undefined} mean or undefined
 */
function avg(arr) {
  const vals = arr.filter(v => typeof v === 'number' && !Number.isNaN(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
}

/**
 * Build a Markdown table.
 * @param {Array<object>} rows
 * @param {Array<string>} cols
 * @returns {string}
 */
function buildTable(rows, cols) {
  const header = '|' + cols.join('|') + '|\n|' + cols.map(() => '---').join('|') + '|\n';
  const body = rows.map(r => '|' + cols.map(c => (r[c] ?? '')).join('|') + '|\n').join('');
  return header + body;
}

/**
 * Parse the events CSV if present.
 * @param {string} file
 * @returns {Map<string, Array<{event:string,day:number}>>}
 */
function parseEvents(file) {
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1);
  for (const line of lines) {
    if (!line) continue;
    const [event, , day, , zoneId] = line.split(',');
    if (!zoneId) continue;
    if (!map.has(zoneId)) map.set(zoneId, []);
    map.get(zoneId).push({ event, day: Number(day) });
  }
  return map;
}

/**
 * Build summary reports from generated artifacts.
 * Reads daily snapshots and event logs from the reports directory.
 * @returns {Promise<object>} summary object
 */
export async function buildReports() {
  const dailyPath = 'reports/sim_200d_daily.jsonl';
  const logPath = 'reports/sim_200d_log.csv';

  const dailyLines = fs.existsSync(dailyPath)
    ? fs.readFileSync(dailyPath, 'utf8').trim().split('\n').filter(Boolean)
    : [];

  const zoneMap = new Map();
  for (const line of dailyLines) {
    const row = JSON.parse(line);
    if (!zoneMap.has(row.zoneId)) zoneMap.set(row.zoneId, []);
    zoneMap.get(row.zoneId).push(row);
  }

  const eventsByZone = parseEvents(logPath);
  const zones = [];

  for (const [zoneId, rows] of zoneMap) {
    rows.sort((a, b) => a.day - b.day);
    const first = rows[0];
    const last = rows[rows.length - 1];

    const env = {};
    const avgDLI = avg(rows.map(r => r.avgDLI_mol_m2d));
    if (avgDLI !== undefined) env.avgDLI_mol_m2d = avgDLI;
    const avgPPFD = avg(rows.map(r => r.avgPPFD_umol_m2s));
    if (avgPPFD !== undefined) env.avgPPFD_umol_m2s = avgPPFD;
    const meanTemp = avg(rows.map(r => r.meanTempFlower_C));
    if (meanTemp !== undefined) env.meanTempFlower_C = meanTemp;
    const maxTemps = rows.map(r => r.maxTemp_C).filter(v => typeof v === 'number');
    if (maxTemps.length) env.maxTemp_C = Math.max(...maxTemps);

    const zoneEvents = eventsByZone.get(zoneId) || [];
    const harvests = zoneEvents.filter(e => e.event === 'harvest');
    const harvestEvents = harvests.length;
    const firstHarvestDay = harvestEvents ? Math.min(...harvests.map(h => h.day)) : undefined;
    const lastHarvestDay = harvestEvents ? Math.max(...harvests.map(h => h.day)) : undefined;

    zones.push({
      zoneId,
      zoneName: first.zoneName || zoneId,
      plantsTotal: last.plantsTotal,
      day1Biomass_g: first.totalBiomass_g,
      totalBiomass_g: last.totalBiomass_g,
      totalBuds_g: last.totalBuds_g,
      harvestEvents,
      ...(firstHarvestDay !== undefined ? { firstHarvestDay } : {}),
      ...(lastHarvestDay !== undefined ? { lastHarvestDay } : {}),
      ...env
    });
  }

  const global = {
    totalBuds_g: zones.reduce((a, z) => a + (z.totalBuds_g || 0), 0),
    replantEventsTotal: Array.from(eventsByZone.values()).reduce((s, ev) => s + ev.filter(e => e.event === 'replant').length, 0)
  };

  const summary = { global, zones };
  await writeFile('reports/sim_200d_summary.json', JSON.stringify(summary, null, 2));

  const zoneCols = ['zoneId', 'zoneName', 'plantsTotal', 'day1Biomass_g', 'totalBiomass_g', 'totalBuds_g', 'harvestEvents', 'firstHarvestDay', 'lastHarvestDay', 'avgDLI_mol_m2d', 'avgPPFD_umol_m2s', 'meanTempFlower_C', 'maxTemp_C'];
  const usedCols = zoneCols.filter(c => zones.some(z => z[c] !== undefined));
  let md = '# 200d Simulation Summary\n\n## Zone Report\n\n';
  md += buildTable(zones, usedCols);
  await writeFile('reports/sim_200d_summary.md', md);

  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildReports();
}
