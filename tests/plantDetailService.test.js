import { createPlantDetailDTO } from '../src/server/services/plantDetailService.js';

test('createPlantDetailDTO compiles plant details', () => {
    const plant = {
        id: 'abcdef1234567890',
        strain: {
            name: 'Test',
            environmentalPreferences: {
                idealTemperature: { vegetation: [20, 25] },
                idealHumidity: { vegetation: [0.5, 0.6] },
                lightIntensity: { vegetation: [400, 600] }
            }
        },
        stage: 'vegetation',
        ageHours: 48,
        health: 0.9,
        stress: 0.2,
        stressors: { temperature: { actual: 30, target: 25 } }
    };
    const zone = {
        status: { temperatureC: 22, humidity: 0.55, co2ppm: 800, ppfd: 500 },
        devices: [ { kind: 'CO2Injector', settings: { targetCO2: 900 } } ],
        plants: [plant]
    };

    const dto = createPlantDetailDTO(zone, plant);

    expect(dto.environment.temperature.set).toEqual([20, 25]);
    expect(dto.environment.temperature.actual).toBe(22);
    expect(dto.environment.co2.set).toBe(900);
    expect(dto.stressFactors.breakdown.temperature.count).toBe(1);
    expect(dto.stressFactors.breakdown.temperature.avg).toBeCloseTo(0.2);
    expect(dto.plants[0].shortId).toBe('abcdef12');
});
