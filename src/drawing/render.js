// Render orchestrator and reusable frame renderer.
//
// renderFrame() is the seam: it draws one spectrum frame from an explicit
// params snapshot and never touches the DOM, the audio analyzer, or the
// app state machine, so a UI-less viewer can call it with received data.
//
// drawVisuals() is the live/SVG orchestrator: it acquires the spectrum (live
// FFT or a stored history frame), applies the recording/preview gates, snapshots
// the current params, and delegates the actual drawing to renderFrame().

import { state } from '../state.js';
import { BAND_CONFIG } from '../core/bands.js';
import { bandEnergy } from '../core/energy.js';
import { drawFunctionMap } from './styles.js';
import { drawSpectrumRingByBands, drawSpectrumDiff } from './layers.js';
import { collectRenderParams } from '../params.js';

/**
 * Resolve a hex color string the way the color pickers do: as an RGB-mode
 * p5.Color (alpha max 255). Resolving it under the canvas's HSB color mode
 * instead would make setAlpha() treat the value as 0-1 and render every mark
 * fully opaque. push()/pop() restores the caller's active color mode. Shared so
 * a UI-less viewer resolves received hex params identically.
 * @param {any} pg
 * @param {string} hex
 * @returns {any} p5.Color in RGB mode.
 */
export function hexColor(pg, hex) {
  pg.push();
  pg.colorMode(RGB, 255);
  const c = pg.color(hex);
  pg.pop();
  return c;
}

/**
 * Draw one spectrum frame onto `pg` from an explicit params snapshot.
 * @param {any} pg                p5 graphics target (main canvas or SVG buffer).
 * @param {number} currentFrame   Frame index (1-based when replaying history).
 * @param {number[]} spectrum     Spectrum bins (0-255).
 * @param {number[]} prevSpectrum Previous spectrum frame (for the diff layer).
 * @param {object} params         Render-params snapshot (see params.js).
 * @param {number} [boost]        Input gain multiplier.
 */
export function renderFrame(pg, currentFrame, spectrum, prevSpectrum, params, boost = 1) {
  if (!spectrum) return;

  pg.push();
  pg.translate(pg.width / 2, pg.height / 2);
  const scaleFactor = Math.min(pg.width, pg.height) / 800;
  pg.scale(scaleFactor);

  const time = currentFrame * 0.005;

  // Resolve every band color up front: the ring layer uses all of them,
  // regardless of whether each band's own marks are enabled.
  const bandColors = {};
  BAND_CONFIG.forEach((bandInfo) => {
    const bandParams = params.bands[bandInfo.name];
    if (bandParams) bandColors[bandInfo.name] = hexColor(pg, bandParams.color);
  });

  BAND_CONFIG.forEach((bandInfo) => {
    const bandParams = params.bands[bandInfo.name];
    if (!bandParams || !bandParams.enabled) return;

    const energy = bandEnergy(spectrum, bandInfo.freq[0], bandInfo.freq[1]);
    let scaledEnergy = pg.constrain(energy * bandParams.gain * boost, 0, 255);

    if (scaledEnergy > bandParams.threshold) {
      pg.push();
      let intensity = pg.map(energy * boost, 0, 255, 0, 1);
      let angle = currentFrame * 0.02;
      let dx = pg.sin(angle + time) * 10 * intensity;
      let dy = pg.cos(angle + time * 1.5) * 10 * intensity;
      pg.translate(dx, dy);
      const style = { color: bandColors[bandInfo.name], weight: bandParams.stroke, alpha: bandParams.alpha };
      const drawParams = { intensityGain: bandParams.intensityGain, angleSpeed: bandParams.angleSpeed, threshold: bandParams.threshold };
      const func = drawFunctionMap[bandParams.drawFunc].func;
      func(pg, scaledEnergy, currentFrame, time, style, drawParams);
      pg.pop();
    }
  });

  if (params.spectrumRing.enabled) {
    drawSpectrumRingByBands(pg, spectrum, currentFrame, boost, params.spectrumRing, bandColors);
  }
  if (params.spectrumDiff.enabled) {
    drawSpectrumDiff(pg, spectrum, prevSpectrum, boost, params.spectrumDiff, hexColor(pg, params.spectrumDiff.color));
  }

  pg.pop();
}

/**
 * Live/SVG orchestrator: analyzes the current spectrum (or replays a stored
 * frame for SVG export) and draws every enabled band plus the global layers.
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
    // Record history only while drawing is active.
    if (state.isRecording) state.spectrumHistory.push(spectrum.slice());
  }

  if (!spectrum) return;

  // Skip near-silent live frames (the diff layer still needs prevSpectrum).
  let totalEnergy = spectrum.reduce((a, b) => a + b, 0);
  if (totalEnergy * boost < 100 && !isForSVG) {
    state.prevSpectrum = spectrum.slice();
    return;
  }

  // Previewing (file playing, not recording): keep prevSpectrum fresh, draw nothing.
  if (!state.isRecording && !isForSVG) {
    state.prevSpectrum = spectrum.slice();
    return;
  }

  const params = collectRenderParams();
  const prevSpectrum = isForSVG ? state.spectrumHistory[currentFrame - 2] || [] : state.prevSpectrum;

  renderFrame(pg, currentFrame, spectrum, prevSpectrum, params, boost);

  if (!isForSVG) state.prevSpectrum = spectrum.slice();
}
