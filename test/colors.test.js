import { describe, it, expect } from 'vitest';
import { BAND_COLORS, defaultBandColor } from '../src/core/colors.js';
import { BAND_CONFIG } from '../src/core/bands.js';

describe('rainbow band colors', () => {
  it('defines a valid hex color for every band', () => {
    for (const band of BAND_CONFIG) {
      expect(BAND_COLORS[band.name]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('returns the mapped color and falls back to white', () => {
    expect(defaultBandColor('red')).toBe('#ff0000');
    expect(defaultBandColor('violet')).toBe('#d500ff');
    expect(defaultBandColor('unknown')).toBe('#ffffff');
  });
});
