// src/engine/cultivationMethodFactory.js
// Baut ein Zonen-taugliches Objekt und kann die Kompatibilität mit einem Strain bewerten.

function getByPath(obj, dotPath) {
  return dotPath.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/**
 * Evaluates the compatibility between strain and method based on
 * method.strainTraitCompatibility.{preferred,conflicting}
 * Example keys: "genotype.indica", "photoperiod.vegetationDays"
 */
export function evaluateCompatibility(strain, method) {
  const cfg = method.strainTraitCompatibility || {};
  const preferred = cfg.preferred || {};
  const conflicting = cfg.conflicting || {};

  let score = 0;
  const hits = [];

  // preferred: erfüllt -> +1 pro Treffer
  for (const key of Object.keys(preferred)) {
    const rule = preferred[key]; // {min?, max?}
    const val = getByPath(strain, key);
    if (typeof val === 'number') {
      const okMin = rule.min == null || val >= rule.min;
      const okMax = rule.max == null || val <= rule.max;
      if (okMin && okMax) { score += 1; hits.push({ key, type: 'preferred' }); }
    }
  }

  // conflicting: erfüllt -> -1 pro Treffer
  for (const key of Object.keys(conflicting)) {
    const rule = conflicting[key];
    const val = getByPath(strain, key);
    if (typeof val === 'number') {
      const okMin = rule.min != null && val >= rule.min;
      const okMax = rule.max != null && val <= rule.max;
      if (okMin || okMax) { score -= 1; hits.push({ key, type: 'conflicting' }); }
    }
  }

  // Normierung in [-1, 1] (soft)
  const maxAbs = Math.max(1, Math.abs(score));
  const normalized = Math.max(-1, Math.min(1, score / maxAbs));

  return { score, normalized, hits };
}

/**
 * Builds a method object that fits directly into Zone.setCultivationMethod(method).
 * Optional: immediate compatibility evaluation against a strain (if provided).
 */
export function buildCultivationMethod(methodJson, opts = {}) {
  const method = {
    id: methodJson.id,
    kind: methodJson.kind || 'CultivationMethod',
    name: methodJson.name,
    setupCost: methodJson.setupCost ?? 0,
    laborIntensity: methodJson.laborIntensity ?? 0.3,
    areaPerPlant: methodJson.areaPerPlant,
    minimumSpacing: methodJson.minimumSpacing,
    maxCycles: methodJson.maxCycles ?? 1,
    substrate: methodJson.substrate ?? null,
    containerSpec: methodJson.containerSpec ?? null,
    idealConditions: methodJson.idealConditions ?? {},
    meta: methodJson.meta ?? {},

    // Convenience: derived metrics
    // e.g., maximum number of plants per m² (taking into account areaPerPlant & packingDensity)
    metrics(zoneAreaM2 = 1) {
      const base = Math.floor(zoneAreaM2 / (this.areaPerPlant || 1));
      const density = this.containerSpec?.packingDensity ?? 1;
      return {
        basePlantsPerArea: base,
        effectivePlantsPerArea: Math.floor(base * density)
      };
    }
  };

  if (opts.strain) {
    method.compatibility = evaluateCompatibility(opts.strain, methodJson);
  }

  return method;
}
