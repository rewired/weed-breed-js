/**
 * Formats a number into a more readable string with appropriate units.
 * @param {number|string} value The number to format.
 * @param {'grams' | 'kWh' | 'liters'} type The type of unit.
 * @returns {string} The formatted string with units.
 */
export default function formatUnits(value, type) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '-';
  }

  value = num;

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
  };

  const scale = scales[type];
  if (!scale) {
    return `${value.toFixed(2)}`;
  }

  for (const { limit, divisor, unit } of scale) {
    if (value >= limit) {
      return `${(value / divisor).toFixed(2)} ${unit}`;
    }
  }

  return `${value.toFixed(2)}`;
}