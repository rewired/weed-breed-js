/** Format number with thousand separators. */
export const fmtNumber = (n) => (n === null || n === undefined ? 'n/a' : n.toLocaleString());

/** Format grams. */
export const fmtGram = (g) => (g === null || g === undefined ? 'n/a' : `${g.toFixed(1)} g`);

/** Format Celsius. */
export const fmtCelsius = (c) => (c === null || c === undefined ? 'n/a' : `${c.toFixed(1)} °C`);

/** Format percent. */
export const fmtPercent = (p) => (p === null || p === undefined ? 'n/a' : `${(p * 100).toFixed(1)} %`);

/** Format ppm. */
export const fmtPPM = (p) => (p === null || p === undefined ? 'n/a' : `${Math.round(p)} ppm`);

/** Format PPFD. */
export const fmtPPFD = (p) => (p === null || p === undefined ? 'n/a' : `${Math.round(p)} µmol/m²/s`);

/** Format DLI. */
export const fmtDLI = (d) => (d === null || d === undefined ? 'n/a' : `${d.toFixed(1)} mol/m²/d`);

/** Format tick number. */
export const fmtTick = (t) => (t === null || t === undefined ? 'n/a' : `#${t}`);
