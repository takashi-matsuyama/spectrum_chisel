import { describe, it, expect } from 'vitest';
import { buildRecipe, isValidRecipe, RECIPE_VERSION, RENDERER_VERSION } from '../src/core/recipe.js';
import pkg from '../package.json';

const validPresetBody = {
  sculptureMode: true,
  frameRate: 30,
  spectrumRing: { enabled: true, gain: 1, threshold: 0 },
  spectrumDiff: { enabled: false, gain: 1, threshold: 0, color: '#ffffff' },
  bands: {},
};

const validRecipe = {
  recipeVersion: '1.0.0',
  rendererVersion: RENDERER_VERSION,
  seed: 12345,
  spectrumHistory: [[1, 2, 3]],
  params: validPresetBody,
  metadata: { createdAt: '2026-01-01T00:00:00.000Z' },
};

describe('buildRecipe', () => {
  it('assembles a recipe with versions and the supplied fields', () => {
    const r = buildRecipe({ params: validPresetBody, spectrumHistory: [[1]], seed: 7, boost: 2, createdAt: 'X' });
    expect(r.recipeVersion).toBe(RECIPE_VERSION);
    expect(r.rendererVersion).toBe(RENDERER_VERSION);
    expect(r.seed).toBe(7);
    expect(r.boost).toBe(2);
    expect(r.spectrumHistory).toEqual([[1]]);
    expect(r.params).toBe(validPresetBody);
    expect(r.metadata).toEqual({ createdAt: 'X' });
  });

  it('round-trips through JSON (preserves history, seed, params)', () => {
    const r = buildRecipe({ params: validPresetBody, spectrumHistory: [[1, 2]], seed: 9, boost: 1, createdAt: 'X' });
    const parsed = JSON.parse(JSON.stringify(r));
    expect(isValidRecipe(parsed)).toBe(true);
    expect(parsed.seed).toBe(9);
    expect(parsed.spectrumHistory).toEqual([[1, 2]]);
    expect(parsed.params).toEqual(validPresetBody);
  });
});

describe('isValidRecipe', () => {
  it('accepts a well-formed recipe', () => {
    expect(isValidRecipe(validRecipe)).toBe(true);
  });

  it('rejects a plain preset (no history/seed) — distinguishes recipe from preset', () => {
    expect(isValidRecipe(validPresetBody)).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(isValidRecipe(null)).toBe(false);
    expect(isValidRecipe(undefined)).toBe(false);
    expect(isValidRecipe('{}')).toBe(false);
  });

  it('rejects a missing or empty spectrumHistory', () => {
    expect(isValidRecipe({ ...validRecipe, spectrumHistory: undefined })).toBe(false);
    expect(isValidRecipe({ ...validRecipe, spectrumHistory: [] })).toBe(false);
    expect(isValidRecipe({ ...validRecipe, spectrumHistory: 'x' })).toBe(false);
  });

  it('rejects a spectrumHistory whose frames are not arrays', () => {
    expect(isValidRecipe({ ...validRecipe, spectrumHistory: [{}] })).toBe(false);
    expect(isValidRecipe({ ...validRecipe, spectrumHistory: [1, 2] })).toBe(false);
  });

  it('rejects a non-numeric or non-finite seed', () => {
    expect(isValidRecipe({ ...validRecipe, seed: '12345' })).toBe(false);
    expect(isValidRecipe({ ...validRecipe, seed: null })).toBe(false);
    expect(isValidRecipe({ ...validRecipe, seed: Infinity })).toBe(false);
    expect(isValidRecipe({ ...validRecipe, seed: NaN })).toBe(false);
  });

  it('rejects an invalid preset body', () => {
    expect(isValidRecipe({ ...validRecipe, params: { frameRate: 30 } })).toBe(false);
    expect(isValidRecipe({ ...validRecipe, params: undefined })).toBe(false);
  });
});

describe('RENDERER_VERSION', () => {
  it('stays in sync with package.json version', () => {
    expect(RENDERER_VERSION).toBe(pkg.version);
  });
});
