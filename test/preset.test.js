import { describe, it, expect } from 'vitest';
import { detectBandIncompatibility, isValidPreset, PRESET_VERSION } from '../src/core/preset.js';

const current = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'];

const validPreset = {
  sculptureMode: false,
  frameRate: 30,
  spectrumRing: { enabled: true, gain: 1, threshold: 0 },
  spectrumDiff: { enabled: false, gain: 1, threshold: 0, color: '#ffffff' },
  bands: {},
};

describe('detectBandIncompatibility', () => {
  it('flags an old eight-band preset as incompatible', () => {
    const old = {
      bands: {
        subBass: {}, low: {}, lowMid: {}, mid: {},
        upperMid: {}, presence: {}, brilliance: {}, high: {},
      },
    };
    const result = detectBandIncompatibility(old, current);
    expect(result.compatible).toBe(false);
    expect(result.unknown).toContain('subBass');
    expect(result.missing).toContain('red');
  });

  it('accepts a matching seven-band preset', () => {
    const ok = { bands: Object.fromEntries(current.map((n) => [n, {}])) };
    const result = detectBandIncompatibility(ok, current);
    expect(result).toEqual({ compatible: true, missing: [], unknown: [] });
  });

  it('treats a preset without a bands map as incompatible', () => {
    const result = detectBandIncompatibility({}, current);
    expect(result.compatible).toBe(false);
    expect(result.missing).toEqual(current);
    expect(result.unknown).toEqual([]);
  });
});

describe('isValidPreset', () => {
  it('accepts a well-formed preset', () => {
    expect(isValidPreset(validPreset)).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(isValidPreset(null)).toBe(false);
    expect(isValidPreset(undefined)).toBe(false);
    expect(isValidPreset('{}')).toBe(false);
    expect(isValidPreset(42)).toBe(false);
  });

  it('rejects a preset missing a global layer or the bands map', () => {
    for (const key of ['spectrumRing', 'spectrumDiff', 'bands']) {
      const partial = { ...validPreset };
      delete partial[key];
      expect(isValidPreset(partial)).toBe(false);
    }
  });

  it('rejects a preset whose frameRate is not a number', () => {
    expect(isValidPreset({ ...validPreset, frameRate: '30' })).toBe(false);
    expect(isValidPreset({ ...validPreset, frameRate: undefined })).toBe(false);
  });

  it('still accepts a structurally valid preset with an incompatible band layout', () => {
    // Old eight-band presets load their globals; band-name compatibility is a
    // separate check (detectBandIncompatibility).
    const eightBand = { ...validPreset, bands: { subBass: {}, high: {} } };
    expect(isValidPreset(eightBand)).toBe(true);
  });
});

describe('PRESET_VERSION', () => {
  it('is a semantic version string', () => {
    expect(PRESET_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
