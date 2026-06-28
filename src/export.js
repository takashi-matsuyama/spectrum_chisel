// Export and preset I/O: SVG/PNG output, filename construction, and JSON
// preset save/load.

import { state, uiComponents } from './state.js';
import { BAND_CONFIG, bandNames } from './core/bands.js';
import { buildTimestampedFilename } from './core/filename.js';
import { detectBandIncompatibility, isValidPreset, PRESET_VERSION } from './core/preset.js';
import {
  buildRecipe,
  isValidRecipe,
  computeContentHash,
  formatEdition,
  isValidEdition,
} from './core/recipe.js';
import { parseLibrary, instanceCount, isSupportedSpecVersion } from './core/pattern.js';
import { derivePlateSet, combinePlatesSvg } from './core/plates.js';
import { drawVisuals, replaySculpture } from './drawing/render.js';
import { collectRenderParams } from './params.js';
import { syncComposerToState } from './composer.js';
import { t } from './i18n/index.js';

// Above this many estimated vector nodes, a sculpture SVG export is warned about
// (it still proceeds). Bounds the TOTAL cost (frames x bands x instances), which
// the per-frame instance cap alone does not.
const SVG_NODE_WARN_THRESHOLD = 200000;
// Upper-bound sources for the estimate: max energy, centroid (both [0,1]) and
// jitter maximize resolved counts so the warning stays a true upper bound.
const SVG_ESTIMATE_SOURCES = {
  energy: 1,
  time: 0,
  index: 0,
  constant: 1,
  frameCount: 0,
  jitter: 1,
  centroid: 1,
};

/**
 * Estimate the vector node count of an SVG export so a huge sculpture is a
 * conscious choice. A custom band contributes its resolved instance count; a
 * built-in band ~1 group.
 * @param {object} params  collectRenderParams() snapshot.
 * @param {number} frames
 * @returns {number}
 */
function estimateSvgNodes(params, frames) {
  let perFrame = 0;
  BAND_CONFIG.forEach((band) => {
    const bp = params.bands[band.name];
    if (!bp || !bp.enabled) return;
    const spec =
      bp.drawFunc === 'drawCustomPattern' &&
      params.patternLibrary &&
      params.patternLibrary[bp.customPatternId];
    perFrame += spec ? instanceCount(spec, SVG_ESTIMATE_SOURCES) : 1;
  });
  if (params.spectrumRing && params.spectrumRing.enabled) perFrame += BAND_CONFIG.length;
  if (params.spectrumDiff && params.spectrumDiff.enabled) perFrame += 1;
  return perFrame * Math.max(1, frames);
}

export function downloadSVG() {
  console.log('Starting SVG export...');
  noLoop();

  // Warn (without blocking) before a very large sculpture export.
  const sculpture = uiComponents.sculptureModeCheckbox.checked();
  const frames = sculpture ? state.spectrumHistory.length : 1;
  if (estimateSvgNodes(collectRenderParams(), frames) > SVG_NODE_WARN_THRESHOLD) {
    alert(t('alertSvgLarge'));
  }

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

/**
 * Color-plate SVG export: render each enabled band (and the ring/diff global
 * layers) alone into its own transparent SVG buffer, then assemble all plates
 * into ONE document with a labeled <g> layer each. Every plate shares the canvas
 * coordinate space, so the layers register exactly when overlaid — a single
 * download ready for multi-color printmaking. Reuses the same drawVisuals replay
 * as downloadSVG (with a per-plate bandFilter), so a plate's marks match that
 * band's contribution to the combined SVG for deterministic styles; random
 * built-in styles keep their pre-existing live<->SVG nondeterminism per plate.
 * Mirrors downloadSVG's loop/boost handling.
 */
export function downloadSVGPlates() {
  noLoop();

  const params = collectRenderParams();
  const descriptors = derivePlateSet(params);
  if (descriptors.length === 0) {
    alert(t('alertNoPlates'));
    if (state.isPlaying || state.isRecording) loop();
    return;
  }

  const sculpture = uiComponents.sculptureModeCheckbox.checked();
  const frames = sculpture ? state.spectrumHistory.length : 1;
  if (estimateSvgNodes(params, frames) > SVG_NODE_WARN_THRESHOLD) {
    alert(t('alertSvgLarge'));
  }

  const micBoostForSVG = state.currentInputMode === 'mic' ? select('#mic-boost-slider').value() : 1;

  const plates = [];
  descriptors.forEach((d) => {
    const svg = createGraphics(width, height, SVG);
    svg.colorMode(HSB, 360, 100, 100);
    // No background: a transparent ground so the plates register when overlaid.
    if (sculpture) {
      for (let i = 0; i < state.spectrumHistory.length; i++) {
        drawVisuals(svg, i + 1, true, micBoostForSVG, d.filter);
      }
    } else if (state.spectrumHistory.length > 0) {
      drawVisuals(svg, state.spectrumHistory.length, true, micBoostForSVG, d.filter);
    }
    // p5.js-svg exposes the root <svg> as elt.svg (its own save() serializes the
    // same node); elt has no querySelector. Take its inner markup (an empty
    // <defs/> + the marks <g>) as the plate layer. The current draw set emits no
    // root-level transform/defs, so reconstructing the combined root loses nothing.
    const root = svg.elt && svg.elt.svg;
    plates.push({ label: d.label, inner: root ? root.innerHTML : '' });
    try {
      svg.remove();
    } catch (err) {
      console.warn('SVG plate cleanup failed (non-fatal):', err);
    }
  });

  const svgData = combinePlatesSvg(width, height, plates);
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = createA(url, '');
  a.elt.download = generateTimestampedFilename('svg', 'plates');
  a.elt.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);

  if (state.isPlaying || state.isRecording) loop();
}

// Save the current UI settings as a JSON preset. The preset body is the live
// render-params snapshot (same shape), tagged with the schema version.
export function savePreset() {
  const preset = { version: PRESET_VERSION, ...collectRenderParams() };
  saveJSON(preset, `sc-preset-${Date.now()}.json`);
}

/**
 * Apply a preset body (also a recipe's `.params`) to the UI and state: warn on
 * band-layout incompatibility, restore globals/bands/library/renderSeed, refresh
 * the slider labels, and re-sync the composer. The caller validates the shape.
 * @param {object} preset
 */
function applyPresetToUi(preset) {
  // Presets saved before the rainbow redesign use the old band names; warn that
  // those band settings will not apply (global settings still do).
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
      // A custom-pattern assignment lives in state (drawCustomPattern is not a
      // selector option); otherwise restore the built-in selection and drop any
      // stale assignment. The composer slice refreshes its own assign-to-band
      // affordance explicitly (p5 .value() fires no event).
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

  // Graceful degradation: a band may reference a custom pattern that the merged
  // library lacks (dropped on parse) or that a newer spec version authored. Such
  // bands render their built-in style (render.js falls back); clear dangling
  // assignments and notify once.
  let degraded = false;
  for (const band of Object.keys(state.bandPatterns)) {
    const spec = state.patternLibrary[state.bandPatterns[band]];
    if (!spec) {
      delete state.bandPatterns[band];
      degraded = true;
    } else if (!isSupportedSpecVersion(spec)) {
      degraded = true;
    }
  }
  if (degraded) alert(t('alertPatternMissing'));

  // Restore the deterministic render seed, normalizing on every load: a preset
  // predating it (or one saved before recording) omits the field, so reset to
  // null and let render.js fall back — never inherit the seed from a previously
  // loaded preset.
  state.renderSeed = typeof preset.renderSeed === 'number' ? preset.renderSeed : null;

  // Refresh the composer + per-band pattern pickers: p5 .value() fires no change
  // event, so the merged library and restored assignments must be re-synced.
  syncComposerToState();
}

// Load a JSON preset and apply it to the UI.
export function loadPreset() {
  const input = createFileInput((file) => {
    if (file.type === 'application' && file.subtype === 'json') {
      const preset = file.data;
      // Reject a malformed or unrelated JSON file before reading its fields, so a
      // missing global layer or bands map cannot throw mid-load.
      if (!isValidPreset(preset)) {
        console.warn('Preset is missing required fields; skipping load.', preset);
        alert(t('alertPresetInvalid'));
        input.remove();
        return;
      }
      applyPresetToUi(preset);
      console.log('Preset loaded successfully.');
    } else {
      alert(t('alertSelectJson'));
    }
    input.remove();
  });
  input.elt.click();
}

// Read the edition title / 'n/N' from the UI inputs, falling back to safe
// defaults so a recipe always carries well-formed metadata. An out-of-range or
// malformed edition (e.g. index > total) is reported and clamped to a unique
// piece rather than poisoning the recipe.
function collectRecipeMetadata() {
  const meta = uiComponents.recipeMeta;
  const title = meta ? String(meta.titleInput.value()).trim() : '';
  let index = meta ? Math.trunc(Number(meta.editionIndexInput.value())) : 1;
  let total = meta ? Math.trunc(Number(meta.editionTotalInput.value())) : 1;
  let edition = formatEdition(index, total);
  if (!isValidEdition(edition)) {
    console.warn('Invalid edition input; defaulting to a unique piece (1/1).', { index, total });
    edition = '1/1';
  }
  return { title, edition };
}

// Save a reproducible recipe: the recorded spectrum history + seed + params +
// renderer version, so the artwork re-renders deterministically without the
// audio. Requires a recording (history); a params-only snapshot is savePreset.
// Async: stamps a deterministic SHA-256 contentHash (the attachment point any
// authenticity scheme attests to) over the canonicalized recipe.
export async function saveRecipe() {
  if (state.spectrumHistory.length === 0) {
    alert(t('alertNoHistoryForRecipe'));
    return;
  }
  // Capture the gain at record time so the recipe reproduces self-contained,
  // independent of the importer's input mode / mic-boost slider.
  const boost = state.currentInputMode === 'mic' ? select('#mic-boost-slider').value() : 1;
  const { title, edition } = collectRecipeMetadata();
  const recipe = buildRecipe({
    params: collectRenderParams(),
    spectrumHistory: state.spectrumHistory,
    seed: state.renderSeed,
    boost,
    createdAt: new Date().toISOString(),
    title,
    edition,
  });
  // Bind everything above into a deterministic digest. We do not sign in-app —
  // a certificate/signature/NFT scheme can attest to this hash later.
  recipe.metadata.contentHash = await computeContentHash(recipe);
  saveJSON(recipe, `sc-recipe-${Date.now()}.json`);
}

// Restore a recipe's edition metadata (title / 'n/N') into the UI inputs so a
// re-save round-trips it. Back-compat: recipes saved before Slice D lack these.
function applyRecipeMetadataToUi(metadata = {}) {
  const meta = uiComponents.recipeMeta;
  if (!meta) return;
  meta.titleInput.value(typeof metadata.title === 'string' ? metadata.title : '');
  const edition = isValidEdition(metadata.edition) ? metadata.edition : '1/1';
  const [index, total] = edition.split('/');
  meta.editionIndexInput.value(Number(index));
  meta.editionTotalInput.value(Number(total));
}

// Verify a loaded recipe against its stamped contentHash (tamper-evidence /
// provenance, not a gate): recompute the canonical digest and warn on mismatch.
// Recipes saved before Slice D carry no contentHash and are skipped silently.
async function verifyRecipeIntegrity(recipe) {
  const stamped = recipe.metadata && recipe.metadata.contentHash;
  if (!stamped) return;
  const recomputed = await computeContentHash(recipe);
  if (recomputed !== stamped) {
    console.warn('Recipe contentHash mismatch — the recipe was modified after it was saved.', {
      stamped,
      recomputed,
    });
    alert(t('alertRecipeTampered'));
  }
}

// Load a recipe and statically reproduce it: restore the params, the recorded
// history and seed, then replay the whole history onto the canvas (sculpture).
export function loadRecipe() {
  const input = createFileInput((file) => {
    if (file.type === 'application' && file.subtype === 'json') {
      const recipe = file.data;
      if (!isValidRecipe(recipe)) {
        console.warn('Not a valid recipe; skipping load.', recipe);
        alert(t('alertRecipeInvalid'));
        input.remove();
        return;
      }
      // Stop any live recording/playback first, so the draw loop cannot append
      // live FFT frames to the restored history and corrupt the reproduction.
      state.isRecording = false;
      state.isPlaying = false;
      noLoop();
      applyPresetToUi(recipe.params);
      applyRecipeMetadataToUi(recipe.metadata);
      state.spectrumHistory = recipe.spectrumHistory;
      state.renderSeed = recipe.seed;
      uiComponents.sculptureModeCheckbox.checked(true);
      // Static reproduction: clear the canvas, then replay every recorded frame
      // with the recipe's own boost so it reproduces self-contained (back-compat:
      // recipes saved before boost existed fall back to 1).
      background(0);
      const boost = Number.isFinite(recipe.boost) ? recipe.boost : 1;
      replaySculpture(window, boost);
      console.log('Recipe loaded and reproduced.');
      // Integrity check runs after reproduction (non-blocking): a tampered recipe
      // still reproduces, but the mismatch is surfaced for provenance.
      verifyRecipeIntegrity(recipe);
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
 * @param {string|null} [plate]  Optional plate label for a color-plate export.
 * @returns {string}
 */
export function generateTimestampedFilename(extension, plate = null) {
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
    plate,
  });
}
