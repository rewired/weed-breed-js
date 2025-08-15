/**
 * @typedef {import('../../engine/Zone.js').Zone} Zone
 * @typedef {import('../../engine/CostEngine.js').CostEngine} CostEngine
 */

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

    const harvestEtaDays = zone.plants.length > 0 ? Math.round(zone.plants.reduce((sum, p) => sum + (p.strain.photoperiod.vegetationDays + p.strain.photoperiod.floweringDays - p.ageHours / 24), 0) / zone.plants.length) : 0;
    const yieldForecastGrams = zone.plants.reduce((sum, p) => sum + p.calculateYield(), 0);


    // Placeholder for the DTO
    const dto = {
        capacity: {
            plantsCount: zone.plants.length,
            capacitySlots,
            occupancyPct,
            dominantStage,
            stageMix,
            coveragePct: 0, // TODO
        },
        predictions: {
            harvestEtaDays,
            yieldForecastGrams: yieldForecastGrams.toFixed(1),
        },
        environment: {
            temperature: { set: 24, actual: zone.status.temperatureC, delta: 0, stability: 0 }, // TODO
            humidity: { set: 0.60, actual: zone.status.humidity, delta: 0, stability: 0 }, // TODO
            co2: { set: 800, actual: zone.status.co2ppm, delta: 0, stability: 0 }, // TODO
            ppfd: { set: 700, actual: zone.status.ppfd, delta: 0, stability: 0 }, // TODO
        },
        controllers: {
            hvac: { status: 'N/A', dutyCyclePct24h: 0 }, // TODO
            dehumidifier: { status: 'N/A', dutyCyclePct24h: 0 }, // TODO
            co2Injector: { status: 'N/A', dutyCyclePct24h: 0 }, // TODO
            lights: { status: 'N/A', dutyCyclePct24h: 0 }, // TODO
        },
        resourcesDaily: {
            energyKWh: 0, // TODO
            waterL: 0, // TODO
            co2g: 0, // TODO
            topConsumers: [], // TODO
        },
        opexDailyEUR: {
            total: 0, // TODO
            breakdown: {
                energy: 0,
                water: 0,
                maintenance: 0,
                rentShare: 0,
                labor: 0,
            },
        },
        devices: {
            active: zone.devices.filter(d => d.status === 'ok').length,
            total: zone.devices.length,
            avgHealth: zone.devices.length > 0 ? Math.round(zone.devices.reduce((sum, d) => sum + d.health, 0) / zone.devices.length * 100) : 100,
            maintenanceDueInTicks: 0, // TODO
            warnings24h: 0, // TODO
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
            return { ...pkg, avgAgeDays: avgAgeDays.toFixed(1), avgHealth: (avgHealth * 100).toFixed(0), biomassIndex };
        }),
        alerts: [], // TODO
        actions: [], // TODO
    };

    return dto;
}
