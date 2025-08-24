export function computeBudDeltaTick({
  basePerDay_g = 0,
  tempC = 0,
  tempOptC = 0,
  tempWidthC = 1,
  CO2ppm = 0,
  co2HalfSat_ppm = 1,
  DLI = 0,
  dliHalfSat_mol_m2d = 1,
  ppfd = 0,
  ppfdMax = Infinity,
  tickHours = 1
} = {}) {
  const f_T = Math.exp(-((tempC - tempOptC) ** 2) / (2 * tempWidthC ** 2));
  const f_CO2 = CO2ppm / (CO2ppm + co2HalfSat_ppm);
  const f_DLI = DLI / (DLI + dliHalfSat_mol_m2d);
  let budDelta = basePerDay_g * clamp(f_T, 0, 1.2) * clamp(f_CO2, 0, 1.2) * clamp(f_DLI, 0, 1.0) * (tickHours / 24);
  budDelta = Math.max(0, budDelta);
  if (ppfd > ppfdMax) budDelta *= 0.6;
  return budDelta;
}

function clamp(x, min, max) {
  const n = Number(x);
  if (!Number.isFinite(n)) return Number(min);
  return Math.min(Math.max(n, Number(min)), Number(max));
}
