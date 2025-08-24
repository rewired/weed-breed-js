import { loadAllStrains, loadStrainById, loadStrainBySlug } from '../src/engine/loaders/strainLoader.js';

describe('strainLoader', () => {
  test('loads all strains with defaults', async () => {
    const strains = await loadAllStrains();
    expect(strains.length).toBe(5);
    for (const s of strains) {
      expect(typeof s.photoperiodic).toBe('boolean');
      expect(typeof s.vegDays).toBe('number');
      expect(s.light).toBeDefined();
      expect(s.coeffs).toBeDefined();
    }
  });

  test('slug and id lookup return same strain', async () => {
    const ak = await loadStrainBySlug('ak47');
    expect(ak).toBeTruthy();
    const byId = await loadStrainById(ak.id);
    expect(byId.name).toBe(ak.name);
    const legacy = await loadStrainBySlug('ak-47');
    expect(legacy.id).toBe(ak.id);
  });
});

