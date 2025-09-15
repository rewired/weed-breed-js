export function normalizeStrain(s) {
  const veg = s?.vegDays ?? s?.photoperiod?.vegetationDays ?? null;
  const flo = s?.flowerDays ?? s?.photoperiod?.floweringDays ?? null;
  return { ...s, _norm: { vegetationDays: veg, floweringDays: flo } };
}
export default { normalizeStrain };
