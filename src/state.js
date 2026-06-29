// Shared, mutable application state.
//
// p5 runs in global mode and the original sketch kept all state in module-level
// `let` bindings. ES module imports are read-only views, so cross-module mutable
// state lives on these singleton objects instead: modules read and write
// `state.x` and add entries to `uiComponents`.

export const state = {
  /** @type {any} p5.FFT analyzer. */
  fft: null,
  /** @type {number|null} Session id stamped on the first recorded frame. */
  sessionId: null,
  /**
   * @type {number|null} Per-artwork deterministic render seed, set with a
   * crypto RNG on the first recorded frame and saved in presets/recipes. Drives
   * every random/noise style (see drawing/render.js) so a render reproduces
   * exactly. Null until a recording starts (and after reset).
   */
  renderSeed: null,
  /** @type {any} p5.AudioIn microphone. */
  mic: null,
  /** @type {any} p5.SoundFile for the loaded audio file. */
  soundFile: null,
  /** @type {'mic'|'file'} Active input mode. */
  currentInputMode: 'mic',
  /** Whether file preview playback is running. */
  isPlaying: false,
  /** Whether drawing (recording) is active. */
  isRecording: false,
  /** Trim start time (seconds) for file mode. */
  trimStart: 0,
  /** @type {number|null} Trim end time (seconds) for file mode. */
  trimEnd: null,
  /** millis() timestamp when recording started. */
  recordStartTime: 0,
  /**
   * @type {number[][]} Every spectrum frame captured while recording. This is
   * intentionally unbounded: SVG export replays the full history to build the
   * accumulated image, and the viewer mirrors it for resize fidelity, so it must
   * not be capped without regressing both. Cleared on reset.
   */
  spectrumHistory: [],
  /** @type {number[]} Previous spectrum frame (for the diff layer). */
  prevSpectrum: [],
  /**
   * @type {Record<string, any>} In-memory custom-pattern library, keyed by the
   * content-addressed pattern id (see core/pattern.js). Persisted to
   * localStorage and embedded in shareable presets by a later composer slice.
   */
  patternLibrary: {},
  /**
   * @type {Record<string, string>} Per-band custom-pattern assignment: band name
   * -> pattern id. A band present here renders that custom pattern instead of
   * its built-in draw style (resolved in params.js / drawing/render.js).
   */
  bandPatterns: {},
  /**
   * @type {Record<string, string>} Display names for library patterns, keyed by
   * the content-addressed pattern id. The id is the stable render handle; the
   * name is the stable UX handle (editing a pattern recomputes its id but keeps
   * the name, and rewires the bands that referenced the old id).
   */
  patternNames: {},
  /** Whether the control UI is visible. */
  uiVisible: true,
  /** @type {MediaRecorder|null} Video recorder for the current recording. */
  mediaRecorder: null,
  /** Whether video recording is active. */
  isVideoRecording: false,

  // Dynamic recipe playback (atelier-local): replay a loaded recipe's history
  // one recorded frame per draw() tick, so the artwork is re-carved over time
  // rather than shown as a finished still. See playback.js.
  /** Whether dynamic recipe playback is active. */
  isReplaying: false,
  /** Current 1-based history index during playback (0 = at the start). */
  replayIndex: 0,
  /** Playback frame rate, captured from recipe.params.frameRate at load. */
  replayFrameRate: 30,
  /** Playback input gain, captured from recipe.boost for faithful reproduction. */
  replayBoost: 1,
  /**
   * Whether the current spectrumHistory came from a loaded recipe (vs a live
   * recording). When true, every render of that history — dynamic playback, SVG
   * and color-plate export, the canvas resize replay, and viewer late-join —
   * uses `replayBoost` (the recipe's record-time gain) instead of the live mic
   * boost, so a loaded recipe reproduces self-contained everywhere, not just on
   * the canvas. Set on recipe load, cleared on reset and when a recording starts.
   */
  recipeLoaded: false,

  // UI element singletons, assigned in createUI().
  /** @type {any} */
  uiPanel: null,
  /** @type {any} */
  frameRateSlider: null,
  /** @type {any} */
  spectrumRingCheckbox: null,
  /** @type {any} */
  spectrumDiffCheckbox: null,
  /** @type {any} */
  spectrumDiffColorPicker: null,
};

/**
 * Per-band and per-layer UI component handles, keyed by band name plus the
 * special keys `ring`, `diff`, and `sculptureModeCheckbox`. Populated by
 * createUI() and read by the drawing and export code.
 * @type {Record<string, any>}
 */
export const uiComponents = {};
