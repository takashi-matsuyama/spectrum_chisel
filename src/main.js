// Application entry point. p5 runs in global mode: ./p5-global.js sets window.p5
// first; the p5 UMD build registers the global init that attaches the p5 API to
// window before setup()/draw() run. The sound and SVG add-ons then augment that
// same global p5 (they must load after window.p5 is set).
import p5 from './p5-global.js';
import 'p5/lib/addons/p5.sound.js';
import 'p5.js-svg';

import { state, uiComponents } from './state.js';
import { drawVisuals } from './drawing/render.js';
import {
  initMic,
  setupSoundControls,
  updateFileProgressBar,
  stopAndReset,
  toggleMicRecording,
  toggleFileRecording,
} from './audio.js';
import { createUI, initLanguageToggle, applyCapabilityNotices } from './ui.js';
import { downloadSVG, generateTimestampedFilename } from './export.js';
import { toggleVideoRecording } from './recording.js';
import { broadcastFrame, broadcastSync, onViewerHello, openViewer } from './broadcast.js';
import { collectRenderParams } from './params.js';
import { applyStaticTranslations } from './i18n/index.js';

/** Current input gain multiplier (mic boost slider in mic mode, 1 otherwise). */
function currentBoost() {
  return state.currentInputMode === 'mic' ? select('#mic-boost-slider').value() : 1;
}

/**
 * Answer a late-joining viewer with the current params and, in sculpture mode,
 * the accumulated history so it can replay and match this atelier. Replaying
 * with the current params mirrors windowResized() below.
 * @param {string} viewerId
 */
function sendStateToViewer(viewerId) {
  const params = collectRenderParams();
  const history = params.sculptureMode ? state.spectrumHistory.map((s) => Array.from(s)) : null;
  broadcastSync({ viewerId, params, boost: currentBoost(), history });
}

function setup() {
  applyStaticTranslations(); // Localize the static markup in index.html.
  initLanguageToggle();

  // The canvas fills the area beside the sidebar (not the whole window).
  const container = document.getElementById('canvas-container');
  let myCanvas = createCanvas(container.clientWidth, container.clientHeight);
  myCanvas.parent('canvas-container');
  colorMode(HSB, 360, 100, 100);
  background(0);

  state.fft = new p5.FFT(0.9, 512);

  initMic();
  setupSoundControls();
  createUI();
  // Explain any features this browser can't run (video codec, viewer, mic).
  applyCapabilityNotices();

  // Collapse the sidebar (its header button, the floating reopen button, or the
  // C key). The canvas resizes to fill once the slide transition finishes.
  document.getElementById('sidebar-collapse')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-open')?.addEventListener('click', toggleSidebar);
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'flex-basis' || e.propertyName === 'width') resizeToContainer();
    });
  }

  // Reply to viewers that open mid-session so they can catch up (late-join).
  onViewerHello(sendStateToViewer);
}

function draw() {
  if (!state.isPlaying && !state.isRecording) {
    noLoop();
    return;
  }

  // "Previewing" = file playback that is running, not recording, and has not
  // accumulated any history yet.
  const isPreviewing =
    state.currentInputMode === 'file' &&
    state.isPlaying &&
    !state.isRecording &&
    state.spectrumHistory.length === 0;

  if (state.isRecording) {
    if (!uiComponents.sculptureModeCheckbox.checked()) {
      background(0, 20); // Afterimage mode.
    }
    // Sculpture mode does not clear the background.
  } else if (isPreviewing) {
    background(0);
  }

  if (state.isRecording) {
    const elapsedTime = (millis() - state.recordStartTime) / 1000;
    select('#time-display').html(`${elapsedTime.toFixed(1)}s`);
  }

  if (
    state.currentInputMode === 'file' &&
    state.soundFile &&
    state.soundFile.isLoaded() &&
    state.soundFile.isPlaying()
  ) {
    updateFileProgressBar();
  }

  frameRate(state.frameRateSlider.value());
  const micBoost = currentBoost();
  const rendered = drawVisuals(this, frameCount, false, micBoost);
  // Mirror each drawn frame to any open viewing window. drawVisuals already
  // collected the params, so forward them instead of collecting a second time.
  if (rendered) broadcastFrame(frameCount, rendered.spectrum, rendered.params, micBoost);
}

/**
 * Resize the canvas to fill its container. resizeCanvas() clears the pixel
 * buffer, so spectrumHistory/prevSpectrum are kept intact (SVG export and the
 * diff layer survive) and, in sculpture mode, the recorded frames are replayed
 * onto the resized canvas. In afterimage mode the next draw() frame repaints it.
 * No-op when the size is unchanged, so a sidebar toggle that does not move the
 * edge avoids a needless replay.
 */
function resizeToContainer() {
  const container = document.getElementById('canvas-container');
  if (!container) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w <= 0 || h <= 0 || (w === width && h === height)) return;

  resizeCanvas(w, h);
  background(0);
  const isSculpture = uiComponents.sculptureModeCheckbox && uiComponents.sculptureModeCheckbox.checked();
  if (isSculpture && state.spectrumHistory.length > 0) {
    const boost = currentBoost();
    for (let i = 0; i < state.spectrumHistory.length; i++) {
      drawVisuals(window, i + 1, true, boost);
    }
  }
}

function windowResized() {
  resizeToContainer();
}

/** Collapse/expand the sidebar; the canvas resizes on the slide's transitionend. */
function toggleSidebar() {
  document.getElementById('app')?.classList.toggle('collapsed');
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    downloadSVG();
  }
  if (key === 'p' || key === 'P') {
    const fileName = generateTimestampedFilename('png');
    saveCanvas(fileName);
  }
  if (key === 'c' || key === 'C') {
    toggleSidebar();
  }
  if (key === 'e' || key === 'E') {
    stopAndReset();
  }
  if (key === 'r' || key === 'R') {
    if (state.currentInputMode === 'mic') {
      toggleMicRecording();
    } else if (state.currentInputMode === 'file') {
      toggleFileRecording();
    }
  }
  if (key === 'v' || key === 'V') {
    toggleVideoRecording();
  }
  if (key === 'w' || key === 'W') {
    openViewer();
  }
}

// p5 global-mode bootstrap. In a classic <script>, top-level function
// declarations become window properties automatically; inside an ES module they
// are module-scoped, so the p5 lifecycle hooks must be exposed on window
// explicitly.
window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
window.keyPressed = keyPressed;
