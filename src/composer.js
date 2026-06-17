// Custom-pattern composer (Phase 2 slice 2b).
//
// A no-code editor for the parametric patterns the core defines (core/pattern.js)
// and the interpreter draws (drawing/customPattern.js). It owns the in-memory
// library (state.patternLibrary, keyed by content-addressed id) plus display
// names (state.patternNames), persists them to localStorage, and provides the
// sidebar UI: a library bar (new/duplicate/rename/delete), a single-layer editor
// (primitive/generator + sliders + dropdown-only modulation routing), and the
// per-band "use a custom pattern" picker.
//
// Editing recomputes the content id; bands referencing the old id are rewired,
// so the stable UX handle is the name while the stable render handle is the id.

import { state } from './state.js';
import {
  PRIMITIVES,
  GENERATORS,
  MOD_SOURCES,
  MOD_TARGETS,
  CURVES,
  PATTERN_SPEC_VERSION,
  MAX_SIDES,
  normalizePatternSpec,
  patternId,
  parseLibrary,
  STARTER_PATTERNS,
} from './core/pattern.js';
import { drawCustomPattern } from './drawing/customPattern.js';
import { hexColor } from './drawing/render.js';
import { t } from './i18n/index.js';

const LIBRARY_KEY = 'spectrum-chisel-patterns';
const LIBRARY_VERSION = '1.0.0';
const MAX_EDITOR_MODS = 4;

/** @type {string|null} The pattern currently open in the editor. */
let currentId = null;
/** @type {Array<{name: string, select: any}>} Per-band pickers to refresh. */
const bandSelects = [];
/** @type {any} */ let librarySelect = null;
/** @type {any} */ let editorBody = null;
/** @type {any} */ let saveTimer = null;
/** @type {any} */ let previewColor = null;
/** Gates the idle canvas preview until the section is fully built. */
let composerReady = false;
/** Live editor control handles, rebuilt when a different pattern is selected. */
let editor = null;

// --- persistence -----------------------------------------------------------

/** Load the library from localStorage, seeding the starter patterns if empty. */
export function loadPatternLibrary() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(LIBRARY_KEY) || 'null');
  } catch {
    raw = null;
  }
  if (raw && typeof raw === 'object') {
    state.patternLibrary = parseLibrary(raw);
    const names = raw.names && typeof raw.names === 'object' ? raw.names : {};
    /** @type {Record<string, string>} */
    const clean = {};
    for (const id of Object.keys(state.patternLibrary)) {
      clean[id] = typeof names[id] === 'string' ? names[id] : 'Pattern';
    }
    state.patternNames = clean;
    const stored = raw.patterns && typeof raw.patterns === 'object' ? Object.keys(raw.patterns).length : 0;
    if (stored > Object.keys(state.patternLibrary).length) {
      // Some stored specs were structurally invalid and dropped on parse.
      try {
        alert(t('alertPatternDropped'));
      } catch {
        /* alert may be unavailable in headless contexts */
      }
    }
  }
  if (Object.keys(state.patternLibrary).length === 0) seedStarters();
}

function seedStarters() {
  for (const { name, spec } of STARTER_PATTERNS) {
    const norm = normalizePatternSpec(spec);
    const id = patternId(norm);
    state.patternLibrary[id] = norm;
    state.patternNames[id] = name;
  }
  saveLibrary();
}

/** Debounced persist of the library + names. Best-effort (private mode safe). */
function saveLibrary() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        LIBRARY_KEY,
        JSON.stringify({ version: LIBRARY_VERSION, patterns: state.patternLibrary, names: state.patternNames })
      );
    } catch {
      /* localStorage may be unavailable; the in-memory library still works */
    }
  }, 300);
}

// --- library helpers -------------------------------------------------------

/** @returns {Array<{id: string, name: string}>} Library entries sorted by name. */
function patternList() {
  return Object.keys(state.patternLibrary)
    .map((id) => ({ id, name: state.patternNames[id] || 'Pattern' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Commit an edited spec for the open pattern. If the content changed, its id
 * changes too: register the new id, carry the name over, rewire bands that
 * referenced the old id, and drop the old entry.
 * @param {any} newSpec
 */
function commitSpec(newSpec) {
  if (!currentId) return;
  const norm = normalizePatternSpec(newSpec);
  const newId = patternId(norm);
  const oldId = currentId;
  if (newId === oldId) {
    state.patternLibrary[oldId] = norm;
  } else {
    state.patternLibrary[newId] = norm;
    state.patternNames[newId] = state.patternNames[oldId] || 'Pattern';
    for (const band of Object.keys(state.bandPatterns)) {
      if (state.bandPatterns[band] === oldId) state.bandPatterns[band] = newId;
    }
    delete state.patternLibrary[oldId];
    delete state.patternNames[oldId];
    currentId = newId;
    refreshLibrarySelect();
    refreshBandSelects();
  }
  saveLibrary();
  requestPreview();
}

// --- editor ----------------------------------------------------------------

/** Build the spec currently described by the editor controls. */
function readEditorSpec() {
  return {
    specVersion: PATTERN_SPEC_VERSION,
    seed: editor.seed,
    layers: [
      {
        primitive: {
          type: editor.primitive.value(),
          size: editor.size.value(),
          sides: editor.sides.value(),
        },
        generator: {
          type: editor.generator.value(),
          count: editor.count.value(),
          radius: editor.radius.value(),
          phase: 0,
        },
        rotation: 0,
        scale: 1,
        modulations: editor.mods.map((m) => ({
          source: m.source.value(),
          target: m.target.value(),
          curve: m.curve.value(),
          gain: m.gain.value(),
        })),
      },
    ],
  };
}

/** A labeled slider that commits the spec on input. */
function slider(label, min, max, value, step, parent) {
  const row = createDiv(label + ': ').parent(parent);
  const s = createSlider(min, max, value, step).parent(row).addClass('ui-slider');
  const span = createSpan(s.value()).parent(row).addClass('ui-value');
  s.input(() => {
    span.html(s.value());
    commitSpec(readEditorSpec());
  });
  return s;
}

/** A labeled <select> over a token list that commits the spec on change. */
function picker(label, options, value, parent) {
  const row = createDiv(label + ': ').parent(parent);
  const sel = createSelect().parent(row);
  options.forEach((o) => sel.option(o));
  sel.selected(value);
  sel.changed(() => commitSpec(readEditorSpec()));
  return sel;
}

/** Append one modulation routing row (source/target/curve + gain). */
function addModRow(mod) {
  if (editor.mods.length >= MAX_EDITOR_MODS) return;
  const row = createDiv().parent(editor.modList).addClass('ui-subcontrols');
  const source = createSelect().parent(row);
  MOD_SOURCES.forEach((o) => source.option(o));
  source.selected(mod ? mod.source : 'energy');
  const target = createSelect().parent(row);
  MOD_TARGETS.forEach((o) => target.option(o));
  target.selected(mod ? mod.target : 'radius');
  const curve = createSelect().parent(row);
  CURVES.forEach((o) => curve.option(o));
  curve.selected(mod ? mod.curve : 'linear');
  const gainRow = createDiv('gain: ').parent(row);
  const gain = createSlider(-300, 300, mod ? mod.gain : 80, 1).parent(gainRow).addClass('ui-slider');
  const gainSpan = createSpan(gain.value()).parent(gainRow).addClass('ui-value');
  const del = createButton(t('deleteModulation')).parent(row).attribute('data-i18n', 'deleteModulation');

  const entry = { source, target, curve, gain, row };
  const commit = () => commitSpec(readEditorSpec());
  source.changed(commit);
  target.changed(commit);
  curve.changed(commit);
  gain.input(() => {
    gainSpan.html(gain.value());
    commit();
  });
  del.mousePressed(() => {
    row.remove();
    editor.mods = editor.mods.filter((e) => e !== entry);
    commitSpec(readEditorSpec());
  });
  editor.mods.push(entry);
}

/** Rebuild the editor body for the pattern `currentId`. */
function buildEditor() {
  editorBody.html('');
  editor = null;
  if (!currentId || !state.patternLibrary[currentId]) return;
  const layer = state.patternLibrary[currentId].layers[0] || normalizePatternSpec({ layers: [{}] }).layers[0];

  editor = { seed: state.patternLibrary[currentId].seed || 1, mods: [], modList: null };
  editor.primitive = picker('Shape', PRIMITIVES, layer.primitive.type, editorBody);
  editor.generator = picker('Layout', GENERATORS, layer.generator.type, editorBody);
  editor.count = slider('Count', 1, 64, Math.min(64, layer.generator.count), 1, editorBody);
  editor.radius = slider('Radius', 0, 400, Math.min(400, layer.generator.radius), 1, editorBody);
  editor.size = slider('Size', 0, 200, Math.min(200, layer.primitive.size), 1, editorBody);
  editor.sides = slider('Sides', 2, MAX_SIDES, layer.primitive.sides, 1, editorBody);

  editor.modList = createDiv().parent(editorBody);
  layer.modulations.slice(0, MAX_EDITOR_MODS).forEach((m) => addModRow(m));
  const addBtn = createButton(t('addModulation')).parent(editorBody).attribute('data-i18n', 'addModulation');
  addBtn.mousePressed(() => {
    addModRow(null);
    commitSpec(readEditorSpec());
  });
}

/** Open a pattern in the editor. */
function selectPattern(id) {
  if (!state.patternLibrary[id]) return;
  currentId = id;
  if (librarySelect) librarySelect.selected(id);
  buildEditor();
  requestPreview();
}

// --- library bar actions ---------------------------------------------------

function onNew() {
  const name = (prompt(t('promptPatternName'), 'My Pattern') || '').trim();
  if (!name) return;
  const spec = normalizePatternSpec({
    specVersion: PATTERN_SPEC_VERSION,
    seed: 1,
    layers: [
      {
        primitive: { type: 'polygon', size: 30, sides: 3 },
        generator: { type: 'radial', count: 6, radius: 80, phase: 0 },
        rotation: 0,
        scale: 1,
        modulations: [{ source: 'energy', target: 'radius', curve: 'linear', gain: 120 }],
      },
    ],
  });
  const id = patternId(spec);
  state.patternLibrary[id] = spec;
  state.patternNames[id] = name;
  saveLibrary();
  refreshLibrarySelect();
  refreshBandSelects();
  selectPattern(id);
}

function onDuplicate() {
  if (!currentId) return;
  const base = state.patternNames[currentId] || 'Pattern';
  // A bare duplicate has the same content, so the same id. Nudge the seed so the
  // copy is a distinct entry the user can edit independently.
  const spec = normalizePatternSpec({ ...state.patternLibrary[currentId], seed: (state.patternLibrary[currentId].seed || 1) + 1 });
  const id = patternId(spec);
  state.patternLibrary[id] = spec;
  state.patternNames[id] = base + ' copy';
  saveLibrary();
  refreshLibrarySelect();
  refreshBandSelects();
  selectPattern(id);
}

function onRename() {
  if (!currentId) return;
  const name = (prompt(t('promptPatternName'), state.patternNames[currentId] || '') || '').trim();
  if (!name) return;
  state.patternNames[currentId] = name;
  saveLibrary();
  refreshLibrarySelect();
  refreshBandSelects();
}

function onDelete() {
  if (!currentId) return;
  if (!confirm(t('confirmDeletePattern'))) return;
  const id = currentId;
  delete state.patternLibrary[id];
  delete state.patternNames[id];
  for (const band of Object.keys(state.bandPatterns)) {
    if (state.bandPatterns[band] === id) delete state.bandPatterns[band];
  }
  saveLibrary();
  const list = patternList();
  currentId = list.length ? list[0].id : null;
  refreshLibrarySelect();
  refreshBandSelects();
  buildEditor();
  requestPreview();
}

// --- selects ---------------------------------------------------------------

function refreshLibrarySelect() {
  if (!librarySelect) return;
  librarySelect.elt.innerHTML = '';
  patternList().forEach(({ id, name }) => librarySelect.option(name, id));
  if (currentId) librarySelect.selected(currentId);
}

function refreshBandSelects() {
  bandSelects.forEach(({ name, select }) => fillBandSelect(name, select));
}

function fillBandSelect(bandName, sel) {
  const assigned = state.bandPatterns[bandName] || '';
  sel.elt.innerHTML = '';
  const builtin = t('builtinStyle');
  sel.option(builtin, '');
  patternList().forEach(({ id, name }) => sel.option(name, id));
  // Keep the assignment if it still exists; otherwise fall back to built-in.
  if (assigned && state.patternLibrary[assigned]) sel.selected(assigned);
  else {
    sel.selected('');
    if (assigned) delete state.bandPatterns[bandName];
  }
  // The built-in option carries an i18n key so it re-localizes on a switch; the
  // name options are user data and must not be translated.
  const first = sel.elt.querySelector('option');
  if (first) first.setAttribute('data-i18n', 'builtinStyle');
}

/**
 * Attach a per-band custom-pattern picker. Called from ui.js inside the band
 * loop. Selecting a pattern sets state.bandPatterns[bandName]; "(built-in)"
 * clears it (the band falls back to its drawSelector style).
 * @param {string} bandName
 * @param {any} parentEl  A p5 element to parent the control onto.
 */
export function attachBandPatternControl(bandName, parentEl) {
  const row = createDiv().parent(parentEl);
  createSpan(t('customPatternPicker') + ' ').parent(row).attribute('data-i18n', 'customPatternPicker');
  const sel = createSelect().parent(row);
  fillBandSelect(bandName, sel);
  sel.changed(() => {
    const v = sel.value();
    if (v && state.patternLibrary[v]) state.bandPatterns[bandName] = v;
    else delete state.bandPatterns[bandName];
    nudge();
  });
  bandSelects.push({ name: bandName, select: sel });
}

// --- preview ---------------------------------------------------------------

/** Nudge the renderer so an assignment/edit shows immediately. */
function nudge() {
  if (state.isRecording || state.isPlaying) {
    if (typeof redraw === 'function') redraw();
  } else {
    requestPreview();
  }
}

/**
 * When idle, draw one frame of the open pattern on the main canvas with a sample
 * energy, so editing has immediate visual feedback without needing audio. When
 * recording/playing, the live draw loop already reflects edits, so just nudge.
 */
function requestPreview() {
  if (state.isRecording || state.isPlaying) {
    if (typeof redraw === 'function') redraw();
    return;
  }
  // Only draw an idle preview on a clean canvas: never wipe accumulated art.
  if (!composerReady || state.spectrumHistory.length > 0) return;
  if (!currentId || !state.patternLibrary[currentId]) return;
  const spec = state.patternLibrary[currentId];
  background(0);
  push();
  translate(width / 2, height / 2);
  const sf = Math.min(width, height) / 800;
  scale(sf);
  if (!previewColor) previewColor = hexColor(window, '#ffffff');
  drawCustomPattern(
    window,
    200,
    frameCount,
    frameCount * 0.005,
    { color: previewColor, weight: 1.2, alpha: 220 },
    { intensityGain: 1, angleSpeed: 1, threshold: 0, spec }
  );
  pop();
}

// --- section ---------------------------------------------------------------

/**
 * Re-sync the composer and the per-band pickers to the current state after an
 * external change (preset load merges patterns + assignments). p5 .value()
 * fires no event, so callers must invoke this explicitly. Also persists any
 * patterns merged from a shared preset into the local library.
 */
export function syncComposerToState() {
  for (const id of Object.keys(state.patternLibrary)) {
    if (!state.patternNames[id]) state.patternNames[id] = 'Pattern';
  }
  refreshLibrarySelect();
  refreshBandSelects();
  if (!currentId || !state.patternLibrary[currentId]) {
    const list = patternList();
    currentId = list.length ? list[0].id : null;
    if (librarySelect && currentId) librarySelect.selected(currentId);
    buildEditor();
  }
  saveLibrary();
}

/** Build the "Custom Patterns" sidebar section. Call after the band controls. */
export function initComposerUI() {
  const panel = state.uiPanel;
  createDiv(t('customPatterns')).parent(panel).addClass('ui-section-title').attribute('data-i18n', 'customPatterns');

  const bar = createDiv(t('selectPattern') + ' ').parent(panel);
  librarySelect = createSelect().parent(bar);
  librarySelect.changed(() => selectPattern(librarySelect.value()));

  const btnRow = createDiv().parent(panel);
  const mkBtn = (key, handler) => {
    const b = createButton(t(key)).parent(btnRow).attribute('data-i18n', key);
    b.mousePressed(handler);
  };
  mkBtn('newPattern', onNew);
  mkBtn('duplicatePattern', onDuplicate);
  mkBtn('renamePattern', onRename);
  mkBtn('deletePattern', onDelete);

  editorBody = createDiv().parent(panel).addClass('ui-subcontrols');

  refreshLibrarySelect();
  const list = patternList();
  if (list.length) selectPattern(list[0].id);
  composerReady = true;
}
