// Dynamic recipe playback (atelier-local).
//
// A loaded recipe statically reproduces its finished image (export.js loadRecipe).
// This module adds the dynamic experience: replaying the recorded spectrum
// history one frame per draw() tick, at the recording's own frame rate, so the
// artwork is re-carved over time the way it was first drawn. Playback runs once
// to the end and stops (the final state stays on screen, continuous with the
// static A reproduction). It mirrors the recording-time draw path: sculpture
// accumulates, afterimage leaves a fading trail.
//
// The frame advance / draw is deliberately one history index per tick (no
// millis->target-frame jump), so sculpture accumulation never goes patchy;
// frameRate() carries the real-time cadence. Replaying uses drawVisuals with
// isForSVG=true so it reads the spectrum (and the diff layer's previous frame)
// from spectrumHistory instead of analyzing the live FFT.

import { state, uiComponents } from './state.js';
import { drawVisuals } from './drawing/render.js';
import { t } from './i18n/index.js';

/**
 * Enable/disable the three playback buttons together. Tolerates buttons not yet
 * created (called from state-reset paths that may run before createUI()).
 * @param {{play: boolean, pause: boolean, restart: boolean}} s
 */
function setControls(s) {
  if (uiComponents.playRecipeBtn) uiComponents.playRecipeBtn.elt.disabled = !s.play;
  if (uiComponents.pauseRecipeBtn) uiComponents.pauseRecipeBtn.elt.disabled = !s.pause;
  if (uiComponents.restartRecipeBtn) uiComponents.restartRecipeBtn.elt.disabled = !s.restart;
}

/** Whether playback is at the start (fresh) or has run past the last frame. */
function atStartOrEnd() {
  return state.replayIndex === 0 || state.replayIndex >= state.spectrumHistory.length;
}

/**
 * A recipe just loaded: mark the history as recipe-sourced (so every render path
 * uses the recipe's boost), arm the controls (Play/Restart available, Pause not),
 * and reset the playhead. Called by loadRecipe after it reproduces the static
 * image (and after it has set state.replayBoost from the recipe).
 */
export function enableReplayControls() {
  state.recipeLoaded = true;
  state.isReplaying = false;
  state.replayIndex = 0;
  setControls({ play: true, pause: false, restart: true });
}

/**
 * No recipe is loaded (canvas reset, or a fresh recording started): the history
 * is no longer recipe-sourced, so render paths return to the live boost. Disable
 * every control and clear the playhead. Called by stopAndReset and the record
 * transport.
 */
export function resetReplayControls() {
  state.recipeLoaded = false;
  state.isReplaying = false;
  state.replayIndex = 0;
  setControls({ play: false, pause: false, restart: false });
}

/** Start (or resume) dynamic playback. */
export function playRecipe() {
  if (state.spectrumHistory.length === 0) {
    alert(t('alertNoHistoryForRecipe'));
    return;
  }
  // Replay is mutually exclusive with live recording / file playback: both drive
  // draw() and share spectrumHistory. Refuse rather than coexist (the controls
  // are also disabled while recording; this is the belt-and-suspenders guard).
  if (state.isRecording || state.isPlaying) return;
  // From the start or after finishing, begin a clean pass from black — matching
  // how a recording starts (post-reset the canvas is black) for both modes.
  // Mid-way (paused), resume in place without clearing — Pause/Play resumes,
  // Restart is the explicit from-the-top control.
  if (atStartOrEnd()) {
    state.replayIndex = 0;
    background(0);
  }
  state.isReplaying = true;
  frameRate(state.replayFrameRate); // Real-time cadence at the recording's fps.
  setControls({ play: false, pause: true, restart: true });
  loop();
}

/** Pause dynamic playback, leaving the playhead where it is. */
export function pauseRecipe() {
  state.isReplaying = false;
  setControls({ play: true, pause: false, restart: true });
  noLoop();
}

/** Restart dynamic playback from the first recorded frame. */
export function restartRecipe() {
  if (state.spectrumHistory.length === 0) {
    alert(t('alertNoHistoryForRecipe'));
    return;
  }
  if (state.isRecording || state.isPlaying) return; // See playRecipe.
  state.replayIndex = 0;
  background(0); // Fresh pass starts from black for both modes.
  state.isReplaying = true;
  frameRate(state.replayFrameRate);
  setControls({ play: false, pause: true, restart: true });
  loop();
}

/** Playback reached the end: stop, leave the final state on screen, re-arm Play. */
function finishReplay() {
  state.isReplaying = false;
  setControls({ play: true, pause: false, restart: true });
  noLoop();
}

/**
 * Advance and draw one recorded frame. Called from draw() while isReplaying.
 * @param {any} pg  The p5 graphics target (the main canvas / window).
 */
export function advanceReplay(pg) {
  // End the one-shot pass BEFORE touching the canvas, so playback freezes on the
  // last recorded frame. In afterimage mode, applying background(0, 20) here
  // after the final frame would fade it one step past where recording stopped.
  const next = state.replayIndex + 1;
  if (next > state.spectrumHistory.length) {
    finishReplay();
    return;
  }
  // Afterimage fades a trail before each drawn frame (as at record time);
  // sculpture accumulates (background cleared once at play/restart, never here).
  if (!uiComponents.sculptureModeCheckbox.checked()) background(0, 20);
  state.replayIndex = next;
  // isForSVG=true: read this frame's spectrum (and the diff layer's previous
  // frame) from history rather than the live FFT, and don't touch live diff
  // state. Near-silent frames are skipped here exactly as at record time; the
  // index still advances so the timing matches.
  drawVisuals(pg, state.replayIndex, true, state.replayBoost);
}
