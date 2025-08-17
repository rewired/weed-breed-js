import { useRef } from 'react';

export function makeSmoother({
  alpha = 0.2,
  deadband = 0.05,
  step = 0.01,
  minUpdateMs = 120,
  maxUpdateMs = 800,
  maxSlewPerSec = Infinity
} = {}) {
  let ema: number | null = null;
  let shown: number | null = null;
  let lastEmit = 0;

  return function next(rawValue: number, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    ema = ema == null ? rawValue : (1 - alpha) * ema + alpha * rawValue;

    let target = ema;
    if (shown != null && isFinite(maxSlewPerSec)) {
      const dt = Math.max(1, now - lastEmit) / 1000;
      const maxDelta = maxSlewPerSec * dt;
      const diff = ema - shown;
      if (Math.abs(diff) > maxDelta) target = shown + Math.sign(diff) * maxDelta;
    }

    const quant = step > 0 ? Math.round(target / step) * step : target;

    const timeSince = now - lastEmit;
    const mustEmit =
      shown == null ||
      Math.abs(quant - shown) >= deadband ||
      timeSince >= maxUpdateMs ||
      (timeSince >= minUpdateMs && Math.abs(quant - shown) > 0);

    if (mustEmit) {
      shown = quant;
      lastEmit = now;
      return shown;
    }
    return null;
  };
}

export function makeSmooth({ windowHours = 24 } = {}) {
  const windowMs = windowHours * 3600 * 1000;
  const samples: { t: number; v: number }[] = [];
  let sum = 0;

  return function next(value: number, now = Date.now()) {
    samples.push({ t: now, v: value });
    sum += value;
    while (samples.length && now - samples[0].t > windowMs) {
      sum -= samples.shift()!.v;
    }
    return samples.length ? sum / samples.length : 0;
  };
}

export function useSmoother(options?: Parameters<typeof makeSmoother>[0]) {
  const ref = useRef<ReturnType<typeof makeSmoother>>();
  if (!ref.current) {
    ref.current = makeSmoother(options ?? {});
  }
  return ref.current;
}

export function useSmooth(options?: Parameters<typeof makeSmooth>[0]) {
  const ref = useRef<ReturnType<typeof makeSmooth>>();
  if (!ref.current) {
    ref.current = makeSmooth(options ?? {});
  }
  return ref.current;
}
