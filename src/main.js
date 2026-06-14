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
import { createUI, toggleUIVisibility } from './ui.js';
import { downloadSVG, generateTimestampedFilename } from './export.js';
import { toggleVideoRecording } from './recording.js';
import { applyStaticTranslations } from './i18n/index.js';

function setup() {
  applyStaticTranslations(); // Localize the static markup in index.html.

  let myCanvas = createCanvas(windowWidth, windowHeight);
  myCanvas.parent('canvas-container');
  colorMode(HSB, 360, 100, 100);
  background(0);

  state.fft = new p5.FFT(0.9, 512);

  initMic();
  setupSoundControls();
  createUI();
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
  const micBoost = state.currentInputMode === 'mic' ? select('#mic-boost-slider').value() : 1;
  drawVisuals(this, frameCount, false, micBoost);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);

  // resizeCanvas() clears the pixel buffer, so the accumulated artwork would be
  // lost. Keep spectrumHistory and prevSpectrum intact (so SVG export and the
  // diff layer survive) and, in sculpture mode, replay the recorded frames onto
  // the resized canvas. In afterimage mode the image is transient, so the next
  // draw() frame repaints it.
  const isSculpture = uiComponents.sculptureModeCheckbox && uiComponents.sculptureModeCheckbox.checked();
  if (isSculpture && state.spectrumHistory.length > 0) {
    const boost = state.currentInputMode === 'mic' ? select('#mic-boost-slider').value() : 1;
    for (let i = 0; i < state.spectrumHistory.length; i++) {
      drawVisuals(this, i + 1, true, boost);
    }
  }
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
    toggleUIVisibility();
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
}

// p5 global-mode bootstrap. In a classic <script>, top-level function
// declarations become window properties automatically; inside an ES module they
// are module-scoped, so the p5 lifecycle hooks must be exposed on window
// explicitly.
window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
window.keyPressed = keyPressed;
