// Core render orchestrator: analyzes the current spectrum (or replays a stored
// frame for SVG export) and draws every enabled band plus the global layers.

import { state, uiComponents } from '../state.js';
import { BAND_CONFIG } from '../core/bands.js';
import { bandEnergy } from '../core/energy.js';
import { drawFunctionMap } from './styles.js';
import { drawSpectrumRingByBands, drawSpectrumDiff } from './layers.js';

/**
 * @param {any} pg              p5 graphics target (main canvas or SVG buffer).
 * @param {number} currentFrame Frame index (1-based when replaying history).
 * @param {boolean} [isForSVG]  Whether this is an offline SVG render.
 * @param {number} [boost]      Input gain multiplier.
 */
export function drawVisuals(pg, currentFrame, isForSVG = false, boost = 1) {
  let spectrum;

  if (isForSVG) {
    spectrum = state.spectrumHistory[currentFrame - 1];
  } else {
    spectrum = state.fft.analyze();
    // ★★★ 録画中のみ履歴を追加 ★★★
    if (state.isRecording) state.spectrumHistory.push(spectrum.slice());
  }

  if (!spectrum) return;

  let totalEnergy = spectrum.reduce((a, b) => a + b, 0);
  if (totalEnergy * boost < 100 && !isForSVG) {
    if (!isForSVG) state.prevSpectrum = spectrum.slice();
    return;
  }

  pg.push();
  pg.translate(pg.width / 2, pg.height / 2);
  const scaleFactor = min(pg.width, pg.height) / 800;
  pg.scale(scaleFactor);

  const time = currentFrame * 0.005;

  // ★★★ プレビュー中は描画しない ★★★
  if (!state.isRecording && !isForSVG) {
    pg.pop();
    state.prevSpectrum = spectrum.slice();
    return;
  }

  BAND_CONFIG.forEach((bandInfo) => {
    const components = uiComponents[bandInfo.name];
    if (components && components.enabledCheckbox.checked()) {
      const energy = bandEnergy(spectrum, bandInfo.freq[0], bandInfo.freq[1]);
      const ui = {
        color: components.colorPicker.color(), weight: components.strokeSlider.value(), alpha: components.alphaSlider.value(),
        gain: components.gainSlider.value(), threshold: components.thresholdSlider.value(),
        intensityGain: components.intensityGainSlider.value(), angleSpeed: components.angleSpeedSlider.value(),
        drawFunc: components.drawSelector.value()
      };

      let scaledEnergy = pg.constrain(energy * ui.gain * boost, 0, 255);

      if (scaledEnergy > ui.threshold) {
        pg.push();
        let intensity = pg.map(energy * boost, 0, 255, 0, 1);
        let angle = currentFrame * 0.02;
        let dx = pg.sin(angle + time) * 10 * intensity;
        let dy = pg.cos(angle + time * 1.5) * 10 * intensity;
        pg.translate(dx, dy);
        const style = { color: ui.color, weight: ui.weight, alpha: ui.alpha };
        const params = { intensityGain: ui.intensityGain, angleSpeed: ui.angleSpeed, threshold: ui.threshold };
        const func = drawFunctionMap[ui.drawFunc].func;
        func(pg, scaledEnergy, currentFrame, time, style, params);
        pg.pop();
      }
    }
  });

  if (state.spectrumRingCheckbox.checked()) {
    drawSpectrumRingByBands(pg, spectrum, currentFrame, boost);
  }
  if (state.spectrumDiffCheckbox.checked()) {
    const prevSpecForDiff = isForSVG ? (state.spectrumHistory[currentFrame - 2] || []) : state.prevSpectrum;
    drawSpectrumDiff(pg, spectrum, prevSpecForDiff, boost);
  }

  pg.pop();
  if (!isForSVG) state.prevSpectrum = spectrum.slice();
}
