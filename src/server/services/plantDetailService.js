/**
 * @typedef {import('../../engine/Zone.js').Zone} Zone
 * @typedef {import('../../engine/Plant.js').Plant} Plant
 */

/**
 * Create a DTO describing detailed information about a plant and its zone.
 * @param {Zone} zone
 * @param {Plant} plant
 */
export function createPlantDetailDTO(zone, plant) {
    const stage = plant.stage;
    const prefs = plant.strain?.environmentalPreferences || {};
    const temperatureRange = prefs.idealTemperature?.[stage] || [];
    const humidityRange = prefs.idealHumidity?.[stage] || [];
    const lightRange = prefs.lightIntensity?.[stage] || [];
    const co2Device = zone.devices.find(d => d.kind === 'CO2Injector');
    const co2Target = co2Device?.settings?.targetCO2 ?? 800;

    const environment = {
        temperature: { set: temperatureRange, actual: zone.status.temperatureC },
        humidity: { set: humidityRange, actual: zone.status.humidity },
        co2: { set: co2Target, actual: zone.status.co2ppm },
        light: { set: lightRange, actual: zone.status.ppfd },
    };

    const stressTotals = {
        temperature: { count: 0, total: 0 },
        humidity: { count: 0, total: 0 },
        light: { count: 0, total: 0 },
        nutrients: { count: 0, total: 0 },
    };
    let totalStress = 0;
    for (const p of zone.plants) {
        totalStress += p.stress;
        const stressors = p.stressors || {};
        for (const key of Object.keys(stressors)) {
            if (stressTotals[key]) {
                stressTotals[key].count++;
                stressTotals[key].total += p.stress;
            }
        }
    }
    const stressFactors = {
        avgStress: zone.plants.length > 0 ? totalStress / zone.plants.length : 0,
        breakdown: Object.fromEntries(
            Object.entries(stressTotals).map(([k, v]) => [k, {
                count: v.count,
                avg: v.count > 0 ? v.total / v.count : 0,
            }])
        ),
    };

    const plants = zone.plants.map(p => ({
        id: p.id,
        shortId: p.id.slice(0, 8),
        strain: p.strain?.name ?? 'N/A',
        ageDays: Math.floor(p.ageHours / 24),
        health: Number((p.health * 100).toFixed(1)),
        stress: Number((p.stress * 100).toFixed(1)),
        deathLog: p.getDeathLog ? p.getDeathLog() : (p.deathLog || []),
    }));

    return { environment, stressFactors, plants };
}

export default createPlantDetailDTO;
