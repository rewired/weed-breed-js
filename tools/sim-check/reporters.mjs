import fs from 'fs';

function avg(arr) {
  const vals = arr.filter(v => Number.isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function buildTable(rows, cols) {
  const header = '|' + cols.join('|') + '|\n|' + cols.map(() => '---').join('|') + '|\n';
  const body = rows
    .map(r => '|' + cols.map(c => (r[c] ?? '')).join('|') + '|\n')
    .join('');
  return header + body;
}

/**
 * Build summary reports and write to disk.
 * @param {{zones:Array,world:object,events:Array,dailyEvents:Array}} data
 * @returns {object} summary object
 */
export function buildReports({ zones, world, events, dailyEvents }) {
  const zoneReport = zones.map(z => {
    const daily = dailyEvents.filter(d => d.zoneId === z.id);
    const avgPPFD = avg(daily.map(d => d.avgPPFD_umol_m2s));
    const avgDLI = avg(daily.map(d => d.avgDLI_mol_m2d));
    const meanTemp = avg(daily.map(d => d.meanTemp_C));
    const maxTemp = Math.max(0, ...daily.map(d => d.meanTemp_C || 0));
    const totalBiomass = daily.length ? daily[daily.length - 1].totalBiomass_g : z.plants.reduce((s, p) => s + (p.state?.biomassFresh_g ?? 0), 0);
    return {
      zoneName: z.id,
      totalBiomass_g: totalBiomass,
      totalBuds_g: z.totalBuds_g,
      plantsTotal: z.plants.length,
      harvestedPlants: z.harvestedPlants,
      deadPlants: Object.values(z.deathStats ?? {}).reduce((a, b) => a + b, 0),
      startDayFlower: z.startDayFlower,
      harvestEvents: z.harvestEvents,
      firstHarvestDay: z.firstHarvestDay,
      lastHarvestDay: z.lastHarvestDay,
      avgDLI_mol_m2d: avgDLI,
      avgPPFD_umol_m2s: avgPPFD,
      meanTempFlower_C: meanTemp,
      maxTemp_C: maxTemp
    };
  });

  const strainSummary = Array.from(world.strainStats.entries()).map(([id, s]) => ({
    strainName: `${s.name} (${id})`,
    plantsTotal: s.plantsTotal,
    harvestedPlants: s.harvestedPlants,
    totalBuds_g: s.totalBuds_g,
    avgYieldPerPlant_g: s.harvestedPlants ? s.totalBuds_g / s.harvestedPlants : 0,
    avgFlowerDuration_days: s.harvestedPlants ? s.totalFlowerDurationDays / s.harvestedPlants : 0,
  }));

  const replantEventsTotal = events.filter(e => e.type === 'replant').length;
  const global = {
    totalBuds_g: zoneReport.reduce((a, z) => a + (z.totalBuds_g || 0), 0),
    replantEventsTotal
  };

  const summary = { global, zones: zoneReport, strains: strainSummary };
  fs.writeFileSync('reports/sim_200d_summary.json', JSON.stringify(summary, null, 2));

  let md = '# 200d Simulation Summary\n\n## Zone Report\n\n';
  md += buildTable(zoneReport, ['zoneName','totalBiomass_g','totalBuds_g','plantsTotal','harvestedPlants','deadPlants','startDayFlower','harvestEvents','firstHarvestDay','lastHarvestDay','avgDLI_mol_m2d','avgPPFD_umol_m2s','meanTempFlower_C','maxTemp_C']);
  md += '\n## Strain Summary\n\n';
  md += buildTable(strainSummary, ['strainName','plantsTotal','harvestedPlants','totalBuds_g','avgYieldPerPlant_g','avgFlowerDuration_days']);
  fs.writeFileSync('reports/sim_200d_summary.md', md);

  return summary;
}

