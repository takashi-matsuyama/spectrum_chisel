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
  /** Whether the control UI is visible. */
  uiVisible: true,
  /** @type {MediaRecorder|null} Video recorder for the current recording. */
  mediaRecorder: null,
  /** Whether video recording is active. */
  isVideoRecording: false,

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
