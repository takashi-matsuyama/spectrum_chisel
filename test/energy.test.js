import { describe, it, expect } from 'vitest';
import { freqToBin, bandEnergy, NYQUIST_HZ } from '../src/core/energy.js';

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
