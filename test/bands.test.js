import { describe, it, expect } from 'vitest';
import { BAND_CONFIG, bandNames } from '../src/core/bands.js';

describe('BAND_CONFIG', () => {
  it('has a well-formed entry per band', () => {
    for (const band of BAND_CONFIG) {
      expect(typeof band.name).toBe('string');
      expect(band.name).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/); // ASCII machine key
      expect(Array.isArray(band.freq)).toBe(true);
      expect(band.freq).toHaveLength(2);
      expect(band.freq[0]).toBeLessThan(band.freq[1]);
      expect(typeof band.defFunc).toBe('string');
    }
  });

  it('orders bands by ascending frequency and is contiguous', () => {
    for (let i = 1; i < BAND_CONFIG.length; i++) {
      // Each band starts where the previous one ended (contiguous coverage).
      expect(BAND_CONFIG[i].freq[0]).toBe(BAND_CONFIG[i - 1].freq[1]);
    }
  });

  it('uses unique band names', () => {
    const names = bandNames();
    expect(new Set(names).size).toBe(names.length);
  });
});
