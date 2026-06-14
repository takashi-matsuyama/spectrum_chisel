import { describe, it, expect } from 'vitest';
import { detectBandIncompatibility, PRESET_VERSION } from '../src/core/preset.js';

const current = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'];

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

describe('PRESET_VERSION', () => {
  it('is a semantic version string', () => {
    expect(PRESET_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
