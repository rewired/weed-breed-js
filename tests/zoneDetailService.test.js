import { createZoneDetailDTO } from '../src/server/services/zoneDetailService.js';

test('createZoneDetailDTO aggregates targets, stress and plants', () => {
    const plants = [
        {
            id: 'aaaaaaaaaaaaaaaa',
            strain: {
                name: 'Alpha',
                environmentalPreferences: {
                    idealTemperature: { vegetative: [20, 25] },
                    idealHumidity: { vegetative: [0.5, 0.6] },
                    lightIntensity: { vegetative: [400, 600] }
                }
            },
            stage: 'vegetative',
            ageHours: 48,
            health: 0.9,
            stress: 0.2,
            stressors: { temperature: { actual: 30, target: 25 } }
        },
        {
            id: 'bbbbbbbbbbbbbbbb',
            strain: {
                name: 'Beta',
                environmentalPreferences: {
                    idealTemperature: { vegetative: [22, 26] },
                    idealHumidity: { vegetative: [0.55, 0.65] },
                    lightIntensity: { vegetative: [450, 650] }
                }
            },
            stage: 'vegetative',
            ageHours: 72,
            health: 0.8,
            stress: 0.3,
            stressors: { humidity: { actual: 0.7, target: 0.6 } }
        }
    ];
    const zone = {
        status: { temperatureC: 23, humidity: 0.6, co2ppm: 800, ppfd: 500 },
        devices: [ { kind: 'CO2Injector', settings: { targetCO2: 900 } } ],
        plants
    };

    const dto = createZoneDetailDTO(zone);

    expect(dto.environment.temperature.target[0]).toBeCloseTo(21); // avg of 20 and 22
    expect(dto.environment.temperature.actual).toBe(23);
    expect(dto.environment.co2.target).toBe(900);
    expect(dto.stress.breakdown.temperature.count).toBe(1);
    expect(dto.stress.breakdown.humidity.count).toBe(1);
    expect(dto.plants[0].id).toBe('aaaaaaaa');
    expect(dto.plants[0].strain).toBe('Alpha');
    expect(dto.plants[0].ageHours).toBe(48);
});
