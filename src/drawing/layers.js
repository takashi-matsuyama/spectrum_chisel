// Global spectrum layers drawn on top of the per-band styles: a ring of all
// band energies and a stippled diff of the change since the previous frame.
// Both take explicit params (and pre-resolved colors) so they never read the
// DOM; the renderer passes them in.

import { BAND_CONFIG } from '../core/bands.js';
import { freqToBin } from '../core/energy.js';

/**
 * @param {any} pg
 * @param {number[]} spectrum
 * @param {number} frameCount
 * @param {number} boost
 * @param {{ gain: number, threshold: number }} ringParams
 * @param {Record<string, any>} bandColors  Resolved p5.Color per band name.
 */
export function drawSpectrumRingByBands(pg, spectrum, frameCount, boost, ringParams, bandColors) {
  const { gain, threshold } = ringParams;
  const overallEnergy = spectrum.reduce((sum, value) => sum + value, 0) / spectrum.length;

  if (overallEnergy * gain * boost < threshold) {
    return;
  }

  pg.noFill();
  let totalBands = spectrum.length;

  BAND_CONFIG.forEach((bandInfo) => {
    const color = bandColors[bandInfo.name];
    let startIndex = Math.floor(freqToBin(bandInfo.freq[0], totalBands));
    let endIndex = Math.floor(freqToBin(bandInfo.freq[1], totalBands));
    pg.stroke(color); pg.strokeWeight(1); pg.beginShape();
    for (let i = startIndex; i < endIndex; i++) {
      if (spectrum[i] === undefined) continue;
      let angle = pg.map(i, 0, totalBands, 0, pg.TWO_PI);
      let baseRadius = pg.map(spectrum[i], 0, 255, 60, 280);
      let breathing = pg.sin(frameCount * 0.05 + angle) * 8;
      let jitter = pg.noise(angle + frameCount * 0.01) * 10;
      let radius = baseRadius + breathing + jitter;
      let x = pg.cos(angle) * radius; let y = pg.sin(angle) * radius;
      pg.vertex(x, y);
    }
    pg.endShape();
  });
}

/**
 * @param {any} pg
 * @param {number[]} current
 * @param {number[]} previous
 * @param {number} boost
 * @param {{ gain: number, threshold: number }} diffParams
 * @param {any} diffColor  Resolved p5.Color (RGB mode, alpha max 255).
 */
export function drawSpectrumDiff(pg, current, previous, boost, diffParams, diffColor) {
  if (!previous || previous.length === 0) return;

  const { gain, threshold } = diffParams;

  diffColor.setAlpha(180); pg.noFill();
  for (let i = 0; i < current.length; i++) {
    let diff = Math.abs(current[i] - (previous[i] || 0));
    // Apply the input gain/boost before thresholding, matching the live path.
    if (diff * gain * boost > threshold) {
      let angle = pg.map(i, 0, current.length, 0, pg.TWO_PI);
      let radius = pg.map(diff, 10, 255, 120, 370);
      let x = pg.cos(angle) * radius; let y = pg.sin(angle) * radius;
      pg.stroke(diffColor); pg.strokeWeight(pg.map(diff, 10, 255, 1, 3));
      pg.point(x, y);
    }
  }
}
