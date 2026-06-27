// Reproducible recipe (pure, p5-independent), mirroring core/preset.js.
//
// A recipe is the self-contained, sellable/distributable package that re-renders
// an artwork deterministically WITHOUT re-analyzing the audio: the recorded
// spectrumHistory + the render params + the deterministic seed + the renderer
// version. A preset (params only) is a subset; a recipe adds history + seed.

import { isValidPreset } from './preset.js';

export const RECIPE_VERSION = '1.0.0';
// Kept in sync with package.json "version" by a unit test (test/recipe.test.js).
export const RENDERER_VERSION = '1.1.0';

/**
 * Assemble a recipe object from the live render state. Pure: the caller supplies
 * the timestamp (no Date.now here) so this stays deterministic and testable.
 * @param {object} args
 * @param {object} args.params              collectRenderParams() snapshot.
 * @param {number[][]} args.spectrumHistory Recorded spectrum frames.
 * @param {number|null} args.seed           Deterministic render seed.
 * @param {string} args.createdAt           ISO timestamp.
 * @returns {object}
 */
export function buildRecipe({ params, spectrumHistory, seed, createdAt }) {
  return {
    recipeVersion: RECIPE_VERSION,
    rendererVersion: RENDERER_VERSION,
    seed,
    spectrumHistory,
    params,
    metadata: { createdAt },
  };
}

/**
 * Structural check that a loaded object is a usable recipe: a non-empty spectrum
 * history, a numeric seed, and a valid preset body under `.params`. Distinguishes
 * a recipe from a plain preset (which lacks spectrumHistory/seed).
 * @param {any} data
 * @returns {boolean}
 */
export function isValidRecipe(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.spectrumHistory) || data.spectrumHistory.length === 0) return false;
  if (typeof data.seed !== 'number') return false;
  return isValidPreset(data.params);
}
