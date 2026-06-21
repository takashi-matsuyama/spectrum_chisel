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
import { bandEnergy, spectralCentroid } from '../core/energy.js';
import { drawFunctionMap } from './styles.js';
import { drawCustomPattern } from './customPattern.js';
import { isSupportedSpecVersion } from '../core/pattern.js';
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
  // This frame's timbral brightness in [0,1], shared by every band's custom
  // pattern as the `centroid` modulation source. A pure function of the raw
  // spectrum (pre-boost), so it is recomputed identically in the atelier, the
  // viewer, and SVG export — no extra param rides along, and it sidesteps the
  // per-frame-boost replay asymmetry.
  const centroid = spectralCentroid(spectrum);

  // Resolve every band color up front: the ring layer uses all of them,
  // regardless of whether each band's own marks are enabled.
  const bandColors = {};
  BAND_CONFIG.forEach((bandInfo) => {
    const bandParams = params.bands[bandInfo.name];
    if (bandParams) bandColors[bandInfo.name] = hexColor(pg, bandParams.color);
  });

  BAND_CONFIG.forEach((bandInfo, bandIndex) => {
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

      if (bandParams.drawFunc === 'drawCustomPattern') {
        // Custom pattern: resolve its spec from the self-contained library that
        // rode in with the params. Missing or too-new specs degrade to the
        // band's default built-in (no throw), so a shared preset referencing an
        // unknown pattern still renders.
        const spec = params.patternLibrary && params.patternLibrary[bandParams.customPatternId];
        if (spec && isSupportedSpecVersion(spec)) {
          drawCustomPattern(pg, scaledEnergy, currentFrame, time, style, { ...drawParams, spec, bandIndex, centroid });
        } else {
          drawFunctionMap[bandInfo.defFunc].func(pg, scaledEnergy, currentFrame, time, style, drawParams);
        }
      } else {
        // `?? defFunc` hardens against an unknown built-in key from a
        // forward-compatible preset (drawCustomPattern is dispatched above and is
        // intentionally absent from drawFunctionMap).
        const entry = drawFunctionMap[bandParams.drawFunc] ?? drawFunctionMap[bandInfo.defFunc];
        entry.func(pg, scaledEnergy, currentFrame, time, style, drawParams);
      }
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
 * @returns {{spectrum: number[], params: object}|null} The spectrum that was
 *   drawn together with the params snapshot it was drawn with, or null if the
 *   frame was skipped (no data, near-silent, or previewing). The live caller
 *   forwards both to the viewer so params are collected only once per frame.
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

  if (!spectrum) return null;

  // Skip near-silent frames identically for live and SVG export, so the
  // exported image matches what was drawn live. Only the live path owns
  // state.prevSpectrum; SVG replay reads its previous frame from history
  // (see below) and must not clobber the live diff state.
  let totalEnergy = spectrum.reduce((a, b) => a + b, 0);
  if (totalEnergy * boost < 100) {
    if (!isForSVG) state.prevSpectrum = spectrum.slice();
    return null;
  }

  // Previewing (file playing, not recording): keep prevSpectrum fresh, draw nothing.
  if (!state.isRecording && !isForSVG) {
    state.prevSpectrum = spectrum.slice();
    return null;
  }

  const params = collectRenderParams();
  const prevSpectrum = isForSVG ? state.spectrumHistory[currentFrame - 2] || [] : state.prevSpectrum;

  renderFrame(pg, currentFrame, spectrum, prevSpectrum, params, boost);

  if (!isForSVG) state.prevSpectrum = spectrum.slice();
  return { spectrum, params };
}
