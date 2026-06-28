import { describe, it, expect } from 'vitest';
import {
  buildRecipe,
  isValidRecipe,
  RECIPE_VERSION,
  RENDERER_VERSION,
  stableStringify,
  canonicalRecipeString,
  computeContentHash,
  isValidEdition,
  formatEdition,
  serializeRecipe,
  deserializeRecipe,
  supportsGzip,
} from '../src/core/recipe.js';
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
    const r = buildRecipe({
      params: validPresetBody,
      spectrumHistory: [[1]],
      seed: 7,
      boost: 2,
      createdAt: 'X',
    });
    expect(r.recipeVersion).toBe(RECIPE_VERSION);
    expect(r.rendererVersion).toBe(RENDERER_VERSION);
    expect(r.seed).toBe(7);
    expect(r.boost).toBe(2);
    expect(r.spectrumHistory).toEqual([[1]]);
    expect(r.params).toBe(validPresetBody);
    expect(r.metadata).toEqual({ title: '', edition: '1/1', createdAt: 'X' });
  });

  it('carries title and edition into metadata when supplied', () => {
    const r = buildRecipe({
      params: validPresetBody,
      spectrumHistory: [[1]],
      seed: 1,
      boost: 1,
      createdAt: 'X',
      title: 'Aurora',
      edition: '2/10',
    });
    expect(r.metadata).toEqual({ title: 'Aurora', edition: '2/10', createdAt: 'X' });
  });

  it('round-trips through JSON (preserves history, seed, params)', () => {
    const r = buildRecipe({
      params: validPresetBody,
      spectrumHistory: [[1, 2]],
      seed: 9,
      boost: 1,
      createdAt: 'X',
    });
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

  it('still accepts a pre-Slice-D recipe (no title/edition/contentHash)', () => {
    // Back-compat: Slice A recipes carry only createdAt in metadata.
    expect(isValidRecipe(validRecipe)).toBe(true);
    expect(validRecipe.metadata.title).toBeUndefined();
    expect(validRecipe.metadata.contentHash).toBeUndefined();
  });

  it('accepts a recipe with the Slice D metadata fields', () => {
    const withMeta = {
      ...validRecipe,
      metadata: {
        title: 'X',
        edition: '1/5',
        createdAt: 'Y',
        contentHash: 'sha256:abc',
        authenticity: null,
      },
    };
    expect(isValidRecipe(withMeta)).toBe(true);
  });
});

describe('RENDERER_VERSION', () => {
  it('stays in sync with package.json version', () => {
    expect(RENDERER_VERSION).toBe(pkg.version);
  });
});

describe('formatEdition / isValidEdition', () => {
  it('formats an n/N string', () => {
    expect(formatEdition(1, 1)).toBe('1/1');
    expect(formatEdition(3, 10)).toBe('3/10');
  });

  it('accepts well-formed editions', () => {
    expect(isValidEdition('1/1')).toBe(true);
    expect(isValidEdition('2/10')).toBe(true);
    expect(isValidEdition('10/10')).toBe(true);
  });

  it('rejects malformed or out-of-range editions', () => {
    expect(isValidEdition('11/10')).toBe(false); // index > total
    expect(isValidEdition('0/10')).toBe(false); // zero index
    expect(isValidEdition('1/0')).toBe(false); // zero total
    expect(isValidEdition('1.5/3')).toBe(false); // non-integer
    expect(isValidEdition('1 / 3')).toBe(false); // spaces
    expect(isValidEdition('abc')).toBe(false);
    expect(isValidEdition('')).toBe(false);
    expect(isValidEdition(5)).toBe(false);
    expect(isValidEdition(null)).toBe(false);
  });

  it('rejects non-canonical (leading-zero) editions so the valid set == formatEdition output', () => {
    // A leading-zero form would re-normalize on load->save and silently change
    // the contentHash; rejecting it keeps isValidEdition aligned with formatEdition.
    expect(isValidEdition('01/1')).toBe(false);
    expect(isValidEdition('1/05')).toBe(false);
    expect(isValidEdition('00/1')).toBe(false);
  });

  it('rejects editions beyond the safe-integer range', () => {
    expect(isValidEdition('99999999999999999999/99999999999999999999')).toBe(false);
  });

  it('every formatEdition output is itself a valid edition (round-trip closure)', () => {
    for (const [i, n] of [
      [1, 1],
      [3, 7],
      [10, 10],
      [1, 1000],
    ]) {
      expect(isValidEdition(formatEdition(i, n))).toBe(true);
    }
  });
});

describe('stableStringify', () => {
  it('is independent of object key insertion order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it('preserves array order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
    expect(stableStringify([3, 1, 2])).not.toBe(stableStringify([1, 2, 3]));
  });

  it('serializes nested structures deterministically', () => {
    const a = { z: { y: [1, { b: 2, a: 1 }] }, m: 'x' };
    const b = { m: 'x', z: { y: [1, { a: 1, b: 2 }] } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('handles primitives and null', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify('hi')).toBe('"hi"');
  });
});

describe('canonicalRecipeString', () => {
  it('excludes metadata.contentHash and metadata.authenticity', () => {
    const base = { seed: 1, metadata: { title: 'X', edition: '1/1', createdAt: 'Y' } };
    const withAuth = {
      seed: 1,
      metadata: {
        title: 'X',
        edition: '1/1',
        createdAt: 'Y',
        contentHash: 'sha256:zzz',
        authenticity: { sig: 'q' },
      },
    };
    expect(canonicalRecipeString(withAuth)).toBe(canonicalRecipeString(base));
  });

  it('does bind title/edition/createdAt', () => {
    const a = { seed: 1, metadata: { title: 'A', edition: '1/1', createdAt: 'Y' } };
    const b = { seed: 1, metadata: { title: 'B', edition: '1/1', createdAt: 'Y' } };
    expect(canonicalRecipeString(a)).not.toBe(canonicalRecipeString(b));
  });
});

describe('computeContentHash', () => {
  const recipe = buildRecipe({
    params: validPresetBody,
    spectrumHistory: [[1, 2, 3]],
    seed: 12345,
    boost: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    title: 'Aurora',
    edition: '1/10',
  });

  it('is a sha256:<hex> string', async () => {
    const h = await computeContentHash(recipe);
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is stable for the same payload', async () => {
    expect(await computeContentHash(recipe)).toBe(await computeContentHash(recipe));
  });

  it('is unchanged when an authenticity block / contentHash is attached', async () => {
    const before = await computeContentHash(recipe);
    const signed = {
      ...recipe,
      metadata: {
        ...recipe.metadata,
        contentHash: before,
        authenticity: { scheme: 'x', signature: 'y' },
      },
    };
    expect(await computeContentHash(signed)).toBe(before);
  });

  it('changes when the reproducible payload changes', async () => {
    const before = await computeContentHash(recipe);
    const tampered = { ...recipe, seed: 99999 };
    expect(await computeContentHash(tampered)).not.toBe(before);
  });

  it('changes when the edition changes', async () => {
    const before = await computeContentHash(recipe);
    const reEdition = { ...recipe, metadata: { ...recipe.metadata, edition: '2/10' } };
    expect(await computeContentHash(reEdition)).not.toBe(before);
  });
});

describe('serializeRecipe / deserializeRecipe (gzip storage)', () => {
  // A recipe whose spectrumHistory dominates the size, like a real recording.
  const big = buildRecipe({
    params: validPresetBody,
    spectrumHistory: Array.from({ length: 200 }, (_, f) =>
      Array.from({ length: 512 }, (_, b) => (b + f) % 256)
    ),
    seed: 12345,
    boost: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    title: 'Aurora',
    edition: '1/10',
  });

  it('round-trips a recipe through gzip losslessly', async () => {
    const bytes = await serializeRecipe(big);
    expect(bytes[0]).toBe(0x1f); // gzip magic
    expect(bytes[1]).toBe(0x8b);
    const back = await deserializeRecipe(bytes);
    expect(back).toEqual(big);
  });

  it('gzip output is markedly smaller than the raw JSON', async () => {
    const raw = new TextEncoder().encode(JSON.stringify(big)).length;
    const gz = (await serializeRecipe(big)).length;
    expect(gz).toBeLessThan(raw / 3);
  });

  it('preserves the contentHash across the round-trip (format-independent)', async () => {
    const before = await computeContentHash(big);
    const back = await deserializeRecipe(await serializeRecipe(big));
    expect(await computeContentHash(back)).toBe(before);
  });

  it('deserializes a legacy plain-JSON (non-gzip) recipe (back-compat)', async () => {
    const plain = new TextEncoder().encode(JSON.stringify(validRecipe));
    const back = await deserializeRecipe(plain);
    expect(back).toEqual(validRecipe);
    expect(isValidRecipe(back)).toBe(true);
  });

  it('reports gzip support (CompressionStream present in this runtime)', () => {
    expect(supportsGzip()).toBe(true);
  });
});
