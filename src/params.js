// Render-parameter snapshot. Reads the live control values into a plain,
// JSON-serializable object. This is the seam that lets the renderer run without
// touching the DOM: the atelier collects params here, and a UI-less viewer can
// render the same frame from a received snapshot (see drawing/render.js
// renderFrame). The shape matches the preset schema minus `version`, so live
// params and saved presets are interchangeable.

import { state, uiComponents } from './state.js';
import { BAND_CONFIG } from './core/bands.js';

/**
 * Collect the current UI settings into a serializable params object.
 * @returns {{
 *   sculptureMode: boolean,
 *   frameRate: number,
 *   spectrumRing: { enabled: boolean, gain: number, threshold: number },
 *   spectrumDiff: { enabled: boolean, gain: number, threshold: number, color: string },
 *   bands: Record<string, {
 *     enabled: boolean, color: string, drawFunc: string, stroke: number,
 *     alpha: number, gain: number, threshold: number,
 *     intensityGain: number, angleSpeed: number,
 *   }>,
 * }}
 */
export function collectRenderParams() {
  const bands = {};
  BAND_CONFIG.forEach((band) => {
    const name = band.name;
    const c = uiComponents[name];
    bands[name] = {
      enabled: c.enabledCheckbox.checked(),
      color: c.colorPicker.value(),
      drawFunc: c.drawSelector.value(),
      stroke: c.strokeSlider.value(),
      alpha: c.alphaSlider.value(),
      gain: c.gainSlider.value(),
      threshold: c.thresholdSlider.value(),
      intensityGain: c.intensityGainSlider.value(),
      angleSpeed: c.angleSpeedSlider.value(),
    };
  });

  return {
    sculptureMode: uiComponents.sculptureModeCheckbox.checked(),
    frameRate: state.frameRateSlider.value(),
    spectrumRing: {
      enabled: state.spectrumRingCheckbox.checked(),
      gain: uiComponents.ring.gainSlider.value(),
      threshold: uiComponents.ring.thresholdSlider.value(),
    },
    spectrumDiff: {
      enabled: state.spectrumDiffCheckbox.checked(),
      gain: uiComponents.diff.gainSlider.value(),
      threshold: uiComponents.diff.thresholdSlider.value(),
      color: uiComponents.diff.colorPicker.value(),
    },
    bands,
  };
}
