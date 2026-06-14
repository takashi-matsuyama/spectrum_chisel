// Global spectrum layers drawn on top of the per-band styles: a ring of all
// band energies and a stippled diff of the change since the previous frame.

import { uiComponents } from '../state.js';
import { BAND_CONFIG } from '../core/bands.js';
import { freqToBin } from '../core/energy.js';

export function drawSpectrumRingByBands(pg, spectrum, frameCount, boost) {
  const ringUI = uiComponents.ring;
  const gain = ringUI.gainSlider.value();
  const threshold = ringUI.thresholdSlider.value();
  const overallEnergy = spectrum.reduce((sum, value) => sum + value, 0) / spectrum.length;

  if (overallEnergy * gain * boost < threshold) {
    return;
  }

  pg.noFill();
  let totalBands = spectrum.length;

  BAND_CONFIG.forEach((bandInfo) => {
    const color = uiComponents[bandInfo.name].colorPicker.color();
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

export function drawSpectrumDiff(pg, current, previous, boost) {
  if (!previous || previous.length === 0) return;

  const diffUI = uiComponents.diff;
  let diffColor = diffUI.colorPicker.color();
  const gain = diffUI.gainSlider.value();
  const threshold = diffUI.thresholdSlider.value();

  diffColor.setAlpha(180); pg.noFill();
  for (let i = 0; i < current.length; i++) {
    let diff = Math.abs(current[i] - (previous[i] || 0));
    // ★★★ micBoostを適用 ★★★
    if (diff * gain * boost > threshold) {
      let angle = pg.map(i, 0, current.length, 0, pg.TWO_PI);
      let radius = pg.map(diff, 10, 255, 120, 370);
      let x = pg.cos(angle) * radius; let y = pg.sin(angle) * radius;
      pg.stroke(diffColor); pg.strokeWeight(pg.map(diff, 10, 255, 1, 3));
      pg.point(x, y);
    }
  }
}
