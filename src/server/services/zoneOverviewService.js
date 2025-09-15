/**
 * Build overview DTOs for zones.
 * @module server/services/zoneOverviewService
 * @typedef {import('../../engine/Zone.js').Zone} Zone
 * @typedef {import('../../engine/CostEngine.js').CostEngine} CostEngine
 */

import { normalizeStrain } from '../../shared/normalizeStrain.js';

/**
 * Generates a Data Transfer Object for the Zone Overview UI.
 * @param {Zone} zone - The zone instance.
 * @param {CostEngine} costEngine - The cost engine instance.
 * @returns {object} The ZoneOverviewDTO.
 */
export function createZoneOverviewDTO(zone, costEngine) {
    if (!zone) {
        return { error: 'Zone not found' };
    }

    const areaPerPlant = zone.plants[0]?.method?.areaPerPlant || 0.25;
    const capacitySlots = Math.floor(zone.area / areaPerPlant);
    const occupancyPct = capacitySlots > 0 ? Math.round((zone.plants.length / capacitySlots) * 100) : 0;

    const stageCounts = zone.plants.reduce((acc, p) => {
        acc[p.stage] = (acc[p.stage] || 0) + 1;
        return acc;
    }, {});

    const dominantStage = Object.keys(stageCounts).reduce((a, b) => stageCounts[a] > stageCounts[b] ? a : b, 'N/A');

    const stageMix = Object.entries(stageCounts).map(([stage, count]) => ({
        stage,
        count,
        pct: Math.round((count / zone.plants.length) * 100)
    }));

    const yieldForecastGrams = zone.plants.reduce((sum, p) => sum + p.calculateYield(), 0);

    let harvestEtaDays = null;
    if (zone.plants.length > 0) {
        let acc = 0;
        let count = 0;
        for (const p of zone.plants) {
            p.strain = p.strain ? normalizeStrain(p.strain) : p.strain;
            const veg = p.strain?._norm?.vegetationDays;
            const flo = p.strain?._norm?.floweringDays;
            if (veg != null && flo != null) {
                acc += veg + flo - p.ageHours / 24;
                count += 1;
            }
        }
        if (count > 0) harvestEtaDays = Math.round(acc / count);
    }

    // --- Plant Stress Aggregation ---
    const stressTotals = {
        temperature: { count: 0, total: 0 },
        humidity: { count: 0, total: 0 },
        light: { count: 0, total: 0 },
        nutrients: { count: 0, total: 0 },
    };
    const totalStress = zone.plants.reduce((sum, p) => {
        sum += p.stress;
        const stressors = p.stressors || {};
        for (const key of Object.keys(stressors)) {
            if (stressTotals[key]) {
                stressTotals[key].count++;
                stressTotals[key].total += p.stress;
            }
        }
        return sum;
    }, 0);
    const plantStress = {
        avgStress: zone.plants.length > 0 ? totalStress / zone.plants.length : 0,
        breakdown: Object.fromEntries(
            Object.entries(stressTotals).map(([k, v]) => [k, {
                count: v.count,
                avgStress: v.count > 0 ? v.total / v.count : 0,
            }])
        ),
    };

    const co2Device = zone.devices.find(d => d.kind === 'CO2Injector');
    const co2Target = co2Device?.settings?.targetCO2 ?? 800;
    const co2Hyster = co2Device?.settings?.hysteresis ?? 50;
    const co2Mode = co2Device?.settings?.mode ?? 'auto';
    const co2Status = co2Mode === 'off' ? 'off' : (co2Device?._lastOn ? 'on' : 'idle');
    const co2Range = [co2Target - co2Hyster * 0.5, co2Target + co2Hyster * 0.5];

    // Placeholder for the DTO
    const dto = {
        capacity: {
            plantsCount: zone.plants.length,
            capacitySlots,
            occupancyPct,
            dominantStage,
            stageMix,
            coveragePct: null,
            areaM2: zone.area,
            devicesCount: zone.devices.length,
        },
        predictions: {
            harvestEtaDays,
            yieldForecastGrams,
        },
        environment: {
            temperature: { set: 24, actual: zone.status.temperatureC, delta: null, stability: null },
            humidity: { set: 0.60, actual: zone.status.humidity, delta: null, stability: null },
            co2: { set: co2Target, actual: zone.status.co2ppm, delta: null, stability: null },
            ppfd: { set: 700, actual: zone.status.ppfd, delta: null, stability: null },
        },
        plantStress,
        controllers: {
            hvac: null,
            dehumidifier: null,
            co2Injector: { status: co2Status, dutyCyclePct24h: null, targetRange: co2Range, mode: co2Mode },
            lights: null,
        },
        resourcesDaily: {
            energyKWh: null,
            waterL: null,
            co2g: null,
            topConsumers: [],
        },
        opexDailyEUR: {
            total: null,
            breakdown: {
                energy: null,
                water: null,
                maintenance: null,
                rentShare: null,
                labor: null,
            },
        },
        devices: {
            active: zone.devices.filter(d => d.status === 'ok').length,
            total: zone.devices.length,
            avgHealth: zone.devices.length > 0 ? Math.round(zone.devices.reduce((sum, d) => sum + d.health, 0) / zone.devices.length * 100) : 100,
            maintenanceDueInTicks: null,
            warnings24h: null,
        },
        plantPackages: Object.values(zone.plants.reduce((acc, p) => {
            const key = `${p.strain.name}-${p.stage}`;
            if (!acc[key]) {
                acc[key] = {
                    label: `${p.strain.name} (${p.stage})`,
                    count: 0,
                    stage: p.stage,
                    avgAgeDays: 0,
                    avgHealth: 0,
                    biomassIndex: 0,
                    plants: []
                };
            }
            acc[key].count++;
            acc[key].plants.push(p);
            return acc;
        }, {})).map(pkg => {
            const avgAgeDays = pkg.plants.reduce((sum, p) => sum + p.ageHours / 24, 0) / pkg.count;
            const avgHealth = pkg.plants.reduce((sum, p) => sum + p.health, 0) / pkg.count;
            const avgBiomass = pkg.plants.reduce((sum, p) => sum + p.biomass, 0) / pkg.count;
            // A simple relative biomass index. Could be improved.
            const biomassIndex = Math.round((avgBiomass / (pkg.plants[0].strain.maxBiomass || 500)) * 100);

            delete pkg.plants; // Don't need to send the full plant objects
            return { ...pkg, avgAgeDays, avgHealth: avgHealth * 100, biomassIndex };
        }),
        alerts: [], // TODO
        actions: [], // TODO
    };

    return dto;
}
