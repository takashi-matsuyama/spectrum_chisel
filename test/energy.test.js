import { describe, it, expect } from 'vitest';
import { freqToBin, bandEnergy, spectralCentroid, NYQUIST_HZ } from '../src/core/energy.js';

describe('freqToBin', () => {
  it('maps 0 Hz to bin 0 and Nyquist to the bin count', () => {
    expect(freqToBin(0, 512)).toBe(0);
    expect(freqToBin(NYQUIST_HZ, 512)).toBe(512);
  });

  it('maps linearly', () => {
    expect(freqToBin(NYQUIST_HZ / 2, 8)).toBe(4);
  });
});

describe('bandEnergy', () => {
  const spectrum = [10, 20, 30, 40, 50, 60, 70, 80]; // 8 bins

  it('averages the bins covering the band', () => {
    // 0..Nyquist/2 -> floor(0)=0 .. ceil(4)=4 -> bins 0..4 inclusive
    // (10+20+30+40+50)/5 = 30
    expect(bandEnergy(spectrum, 0, NYQUIST_HZ / 2)).toBe(30);
  });

  it('counts out-of-range bins in the denominator (faithful to original)', () => {
    // 0..Nyquist -> floor(0)=0 .. ceil(8)=8 -> i=0..8, bin 8 is undefined
    // sum = 360, span = (8-0+1) = 9 -> 40
    expect(bandEnergy(spectrum, 0, NYQUIST_HZ)).toBe(40);
  });
});

describe('spectralCentroid', () => {
  it('returns 0 for silence and degenerate spectra', () => {
    expect(spectralCentroid([0, 0, 0, 0])).toBe(0);
    expect(spectralCentroid([])).toBe(0);
    expect(spectralCentroid([42])).toBe(0); // < 2 bins
  });

  it('returns the normalized position of a single spike', () => {
    // spike at bin 3 of 5 bins -> 3 / (5 - 1) = 0.75
    expect(spectralCentroid([0, 0, 0, 10, 0])).toBeCloseTo(0.75);
    // spike at bin 0 -> 0; spike at the last bin -> 1
    expect(spectralCentroid([10, 0, 0, 0, 0])).toBe(0);
    expect(spectralCentroid([0, 0, 0, 0, 10])).toBeCloseTo(1);
  });

  it('returns ~0.5 for a flat spectrum (mean bin is the middle)', () => {
    expect(spectralCentroid([5, 5, 5, 5, 5])).toBeCloseTo(0.5);
  });

  it('rises as energy shifts to higher bins (brightness)', () => {
    const dark = spectralCentroid([10, 8, 4, 1, 0]);
    const bright = spectralCentroid([0, 1, 4, 8, 10]);
    expect(bright).toBeGreaterThan(dark);
  });

  it('is independent of overall loudness (scale-invariant)', () => {
    expect(spectralCentroid([1, 2, 3, 4])).toBeCloseTo(spectralCentroid([10, 20, 30, 40]));
  });

  it('handles the minimum 2-bin spectrum', () => {
    expect(spectralCentroid([10, 0])).toBe(0); // all weight at bin 0
    expect(spectralCentroid([0, 10])).toBeCloseTo(1); // all weight at bin 1
  });

  it('ignores non-finite and negative bins (never NaN or out of [0,1])', () => {
    for (const input of [[NaN, 10, 0, 0], [-5, 10, 0, 0], [Infinity, 0, 0], [10, -Infinity, 5, 0]]) {
      const c = spectralCentroid(input);
      expect(Number.isFinite(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
    // a skipped NaN at bin 0 leaves bin 1's weight: 1/(4-1) = 0.333…
    expect(spectralCentroid([NaN, 10, 0, 0])).toBeCloseTo(1 / 3);
  });
});
