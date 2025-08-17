export default function formatUnits(value: number | string, type: 'grams' | 'kWh' | 'liters'): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '-';
  }
  let val = num;
  const scales = {
    grams: [
      { limit: 1e6, divisor: 1e6, unit: 't' },
      { limit: 1e3, divisor: 1e3, unit: 'kg' },
      { limit: 0, divisor: 1, unit: 'g' },
    ],
    kWh: [
      { limit: 1e6, divisor: 1e6, unit: 'GWh' },
      { limit: 1e3, divisor: 1e3, unit: 'MWh' },
      { limit: 0, divisor: 1, unit: 'kWh' },
    ],
    liters: [
      { limit: 1e3, divisor: 1e3, unit: 'm³' },
      { limit: 0, divisor: 1, unit: 'L' },
    ],
  } as const;

  const scale = scales[type];
  for (const { limit, divisor, unit } of scale) {
    if (val >= limit) {
      return `${(val / divisor).toFixed(2)} ${unit}`;
    }
  }
  return `${val.toFixed(2)}`;
}
