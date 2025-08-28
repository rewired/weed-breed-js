import { validateStrain } from '../src/server/validation/strainValidation.mjs';

describe('strainValidation', () => {
  test('accepts valid strain', () => {
    const s = {
      id: '00000000-0000-4000-8000-000000000000',
      slug: 'test',
      name: 'Test',
      genotype: { sativa: 0.5, indica: 0.5, ruderalis: 0 },
      meta: { status: 'draft', version: '1.0.0', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };
    const { valid } = validateStrain(s);
    expect(valid).toBe(true);
  });

  test('rejects invalid strain', () => {
    const { valid } = validateStrain({ name: 'Nope' });
    expect(valid).toBe(false);
  });
});
