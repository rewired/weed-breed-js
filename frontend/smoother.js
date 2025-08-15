// smoothing.js (ES Module)
export function makeSmoother({
  alpha = 0.2,          // 0..1  (höher = reaktiver, niedriger = glatter)
  deadband = 0.05,      // Mindeständerung, damit die UI aktualisiert (z. B. 0.1°C)
  step = 0.01,          // Quantisierungsschritt (0 => aus)
  minUpdateMs = 120,    // frühestens alle X ms updaten (UI beruhigen)
  maxUpdateMs = 800,    // spätestens nach X ms erzwingen (gegen "Einfrieren")
  maxSlewPerSec = Infinity // max. Änderung pro Sekunde (z. B. 1.0 Einheit/s)
} = {}) {
  let ema = null;
  let shown = null;
  let lastEmit = 0;

  return function next(rawValue, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    // 1) EMA
    ema = ema == null ? rawValue : (1 - alpha) * ema + alpha * rawValue;

    // 2) Slew-Rate (optional)
    let target = ema;
    if (shown != null && isFinite(maxSlewPerSec)) {
      const dt = Math.max(1, now - lastEmit) / 1000;
      const maxDelta = maxSlewPerSec * dt;
      const diff = ema - shown;
      if (Math.abs(diff) > maxDelta) target = shown + Math.sign(diff) * maxDelta;
    }

    // 3) Quantisierung
    const quant = step > 0 ? Math.round(target / step) * step : target;

    // 4) Deadband + Update-Taktik
    const timeSince = now - lastEmit;
    const mustEmit =
      shown == null ||
      Math.abs(quant - shown) >= deadband || // genug Änderung?
      timeSince >= maxUpdateMs ||            // zu lange her?
      (timeSince >= minUpdateMs && Math.abs(quant - shown) > 0); // kleiner Nudge nach minUpdateMs

    if (mustEmit) {
      shown = quant;
      lastEmit = now;
      return shown; // -> neuen Anzeige-Wert liefern
    }
    return null; // -> nichts ändern (UI bleibt ruhig)
  };
}

// Rolling average over a time window (default 24h)
export function makeSmooth({ windowHours = 24 } = {}) {
  const windowMs = windowHours * 3600 * 1000;
  const samples = [];
  let sum = 0;

  return function next(value, now = Date.now()) {
    samples.push({ t: now, v: value });
    sum += value;
    while (samples.length && now - samples[0].t > windowMs) {
      sum -= samples.shift().v;
    }
    return samples.length ? sum / samples.length : 0;
  };
}
