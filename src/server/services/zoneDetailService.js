/**
 * @typedef {import('../../engine/Zone.js').Zone} Zone
 */

/**
 * Create a DTO with environmental targets, stress summary and plant list for a zone.
 * @param {Zone} zone
 * @returns {object}
 */
export function createZoneDetailDTO(zone) {
    if (!zone) {
        return { error: 'Zone not found' };
    }

    const temperatureRanges = [];
    const humidityRanges = [];
    const lightRanges = [];

    for (const p of zone.plants) {
        const prefs = p.strain?.environmentalPreferences || {};
        const stage = p.stage;
        const t = prefs.idealTemperature?.[stage];
        if (t) temperatureRanges.push(t);
        const h = prefs.idealHumidity?.[stage];
        if (h) humidityRanges.push(h);
        const l = prefs.lightIntensity?.[stage];
        if (l) lightRanges.push(l);
    }

    const avgRange = (ranges) => {
        if (!ranges.length) return [];
        const min = ranges.reduce((sum, r) => sum + r[0], 0) / ranges.length;
        const max = ranges.reduce((sum, r) => sum + r[1], 0) / ranges.length;
        return [min, max];
    };

    const co2Device = zone.devices.find(d => d.kind === 'CO2Injector');
    const co2Target = co2Device?.settings?.targetCO2 ?? 800;

    const environment = {
        temperature: { actual: zone.status.temperatureC, target: avgRange(temperatureRanges) },
        humidity: { actual: zone.status.humidity, target: avgRange(humidityRanges) },
        co2: { actual: zone.status.co2ppm, target: co2Target },
        light: { actual: zone.status.ppfd, target: avgRange(lightRanges) },
    };

    for (const key of ['temperature', 'humidity', 'light']) {
        const t = environment[key].target;
        if (t.length === 2) {
            const mid = (t[0] + t[1]) / 2;
            environment[key].delta = environment[key].actual - mid;
        }
    }
    environment.co2.delta = environment.co2.actual - environment.co2.target;

    const stressTotals = {
        temperature: { count: 0, total: 0 },
        humidity: { count: 0, total: 0 },
        co2: { count: 0, total: 0 },
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
    const stress = {
        avg: zone.plants.length > 0 ? totalStress / zone.plants.length : 0,
        breakdown: Object.fromEntries(
            Object.entries(stressTotals).map(([k, v]) => [k, {
                count: v.count,
                avg: v.count > 0 ? v.total / v.count : 0,
            }])
        ),
    };

    const plants = zone.plants.map(p => ({
        id: p.id.slice(0, 8),
        strain: p.strain?.name ?? 'N/A',
        stage: p.stage,
        ageHours: p.ageHours,
        health: Number((p.health * 100).toFixed(1)),
        stress: Number((p.stress * 100).toFixed(1)),
        stressors: p.stressors || {},
    }));

    return { environment, stress, plants };
}

export default createZoneDetailDTO;
