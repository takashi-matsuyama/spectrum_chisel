// Export and preset I/O: SVG/PNG output, filename construction, and JSON
// preset save/load.

import { state, uiComponents } from './state.js';
import { BAND_CONFIG, bandNames } from './core/bands.js';
import { buildTimestampedFilename } from './core/filename.js';
import { detectBandIncompatibility, isValidPreset, PRESET_VERSION } from './core/preset.js';
import { parseLibrary } from './core/pattern.js';
import { drawVisuals } from './drawing/render.js';
import { collectRenderParams } from './params.js';
import { syncComposerToState } from './composer.js';
import { t } from './i18n/index.js';

export function downloadSVG() {
  console.log('Starting SVG export...');
  noLoop();

  const svg = createGraphics(width, height, SVG);
  svg.colorMode(HSB, 360, 100, 100);
  svg.background(0);

  const micBoostForSVG = state.currentInputMode === 'mic' ? select('#mic-boost-slider').value() : 1;

  if (uiComponents.sculptureModeCheckbox.checked()) {
    // Sculpture mode: render the full history.
    console.log('Exporting in Sculpture Mode (full history)...');
    for (let i = 0; i < state.spectrumHistory.length; i++) {
      drawVisuals(svg, i + 1, true, micBoostForSVG);
    }
  } else {
    // Afterimage mode: render only the latest frame.
    console.log('Exporting in Live Mode (snapshot)...');
    if (state.spectrumHistory.length > 0) {
      drawVisuals(svg, state.spectrumHistory.length, true, micBoostForSVG);
    }
  }

  const fileName = generateTimestampedFilename('svg');
  save(svg, fileName);

  console.log('SVG export complete.');
  // The file is already saved here. p5.js-svg graphics can throw inside p5's
  // Element.remove() during cleanup, so guard it to avoid an uncaught error.
  try {
    svg.remove();
  } catch (err) {
    console.warn('SVG graphics cleanup failed (non-fatal):', err);
  }

  if (state.isPlaying || state.isRecording) {
    loop();
  }
}

// Save the current UI settings as a JSON preset. The preset body is the live
// render-params snapshot (same shape), tagged with the schema version.
export function savePreset() {
  const preset = { version: PRESET_VERSION, ...collectRenderParams() };
  saveJSON(preset, `sc-preset-${Date.now()}.json`);
}

// Load a JSON preset and apply it to the UI.
export function loadPreset() {
  const input = createFileInput((file) => {
    if (file.type === 'application' && file.subtype === 'json') {
      const preset = file.data;

      // Reject a malformed or unrelated JSON file before reading its fields, so
      // a missing global layer or bands map cannot throw mid-load.
      if (!isValidPreset(preset)) {
        console.warn('Preset is missing required fields; skipping load.', preset);
        alert(t('alertPresetInvalid'));
        input.remove();
        return;
      }

      // Presets saved before the rainbow redesign use the old band names; warn
      // that those band settings will not apply (global settings still do).
      const compat = detectBandIncompatibility(preset, bandNames());
      if (!compat.compatible) {
        console.warn('Preset band layout differs from the current bands.', compat);
        alert(t('alertPresetIncompatible'));
      }

      uiComponents.sculptureModeCheckbox.checked(preset.sculptureMode);
      state.frameRateSlider.value(preset.frameRate);

      state.spectrumRingCheckbox.checked(preset.spectrumRing.enabled);
      uiComponents.ring.gainSlider.value(preset.spectrumRing.gain);
      uiComponents.ring.thresholdSlider.value(preset.spectrumRing.threshold);

      state.spectrumDiffCheckbox.checked(preset.spectrumDiff.enabled);
      uiComponents.diff.gainSlider.value(preset.spectrumDiff.gain);
      uiComponents.diff.thresholdSlider.value(preset.spectrumDiff.threshold);
      uiComponents.diff.colorPicker.value(preset.spectrumDiff.color);

      // Merge any custom patterns the preset carries into the in-memory library
      // before restoring band assignments. Content-addressed ids make the merge
      // collision-safe (same content -> same id, different content -> different id).
      if (preset.patternLibrary) {
        state.patternLibrary = { ...state.patternLibrary, ...parseLibrary(preset.patternLibrary) };
      }

      BAND_CONFIG.forEach((band) => {
        const name = band.name;
        const bandPreset = preset.bands[name];
        if (bandPreset) {
          uiComponents[name].enabledCheckbox.checked(bandPreset.enabled);
          uiComponents[name].colorPicker.value(bandPreset.color);
          // A custom-pattern assignment lives in state (drawCustomPattern is not
          // a selector option); otherwise restore the built-in selection and
          // drop any stale assignment. The composer slice refreshes its own
          // assign-to-band affordance explicitly (p5 .value() fires no event).
          if (bandPreset.drawFunc === 'drawCustomPattern' && bandPreset.customPatternId) {
            state.bandPatterns[name] = bandPreset.customPatternId;
          } else {
            delete state.bandPatterns[name];
            uiComponents[name].drawSelector.value(bandPreset.drawFunc);
          }
          uiComponents[name].strokeSlider.value(bandPreset.stroke);
          uiComponents[name].alphaSlider.value(bandPreset.alpha);
          uiComponents[name].gainSlider.value(bandPreset.gain);
          uiComponents[name].thresholdSlider.value(bandPreset.threshold);
          uiComponents[name].intensityGainSlider.value(bandPreset.intensityGain);
          uiComponents[name].angleSpeedSlider.value(bandPreset.angleSpeed);
        }
      });

      // Refresh the value label next to every slider.
      const sliders = selectAll('.ui-slider');
      sliders.forEach((slider) => {
        const valueSpan = slider.elt.nextElementSibling;
        if (valueSpan && valueSpan.tagName === 'SPAN') {
          valueSpan.innerHTML = slider.value();
        }
      });

      // The Frame Rate slider has its own value label too.
      const frameRateValueSpan = state.frameRateSlider.elt.nextElementSibling;
      if (frameRateValueSpan && frameRateValueSpan.tagName === 'SPAN') {
        frameRateValueSpan.innerHTML = state.frameRateSlider.value();
      }

      // Refresh the composer + per-band pattern pickers: p5 .value() fires no
      // change event, so the merged library and restored assignments must be
      // re-synced explicitly.
      syncComposerToState();

      console.log('Preset loaded successfully.');
    } else {
      alert(t('alertSelectJson'));
    }
    input.remove();
  });
  input.elt.click();
}

/**
 * Collect the current p5/DOM state and build the output filename via the pure
 * helper in ./core/filename.js.
 * @param {string} extension
 * @returns {string}
 */
export function generateTimestampedFilename(extension) {
  const trim =
    state.currentInputMode === 'file' && state.soundFile && state.trimEnd !== null
      ? { start: state.trimStart, end: state.trimEnd, duration: state.soundFile.duration() }
      : null;
  return buildTimestampedFilename({
    extension,
    totalFrames: state.spectrumHistory.length,
    frameRate: state.frameRateSlider.value(),
    inputMode: state.currentInputMode,
    id: state.sessionId || Date.now(),
    sculptureMode: uiComponents.sculptureModeCheckbox.checked(),
    trim,
  });
}
