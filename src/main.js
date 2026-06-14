// p5 is used in global mode. ./p5-global.js sets window.p5 first; the p5 UMD
// build also registers the global init that attaches the p5 API to window
// before setup()/draw() run. The sound and SVG add-ons then augment that same
// global p5 (they must load after window.p5 is set).
import p5 from './p5-global.js';
import 'p5/lib/addons/p5.sound.js';
import 'p5.js-svg';

import { state, uiComponents } from './state.js';
import { BAND_CONFIG } from './core/bands.js';
import { buildTimestampedFilename } from './core/filename.js';
import { drawFunctionMap } from './drawing/styles.js';
import { drawVisuals } from './drawing/render.js';

// =============================================================================
// p5.js Lifecycle Functions
// =============================================================================

function setup() {
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
  // Reset history on resize so re-drawing starts cleanly.
  background(0);
  state.spectrumHistory = [];
  state.prevSpectrum = [];
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

// =============================================================================
// Export (SVG / PNG / preset)
// =============================================================================

function downloadSVG() {
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
  svg.remove();

  if (state.isPlaying || state.isRecording) {
    loop();
  }
}

// Save the current UI settings as a JSON preset.
function savePreset() {
  const preset = {
    version: '1.0.0',
    sculptureMode: uiComponents.sculptureModeCheckbox.checked(),
    frameRate: state.frameRateSlider.value(),
    spectrumRing: {
      enabled: state.spectrumRingCheckbox.checked(),
      gain: uiComponents.ring.gainSlider.value(),
      threshold: uiComponents.ring.thresholdSlider.value(),
    },
    spectrumDiff: {
      enabled: state.spectrumDiffCheckbox.checked(),
      gain: uiComponents.diff.gainSlider.value(),
      threshold: uiComponents.diff.thresholdSlider.value(),
      color: uiComponents.diff.colorPicker.value(),
    },
    bands: {},
  };

  BAND_CONFIG.forEach((band) => {
    const name = band.name;
    preset.bands[name] = {
      enabled: uiComponents[name].enabledCheckbox.checked(),
      color: uiComponents[name].colorPicker.value(),
      drawFunc: uiComponents[name].drawSelector.value(),
      stroke: uiComponents[name].strokeSlider.value(),
      alpha: uiComponents[name].alphaSlider.value(),
      gain: uiComponents[name].gainSlider.value(),
      threshold: uiComponents[name].thresholdSlider.value(),
      intensityGain: uiComponents[name].intensityGainSlider.value(),
      angleSpeed: uiComponents[name].angleSpeedSlider.value(),
    };
  });

  saveJSON(preset, `sc-preset-${Date.now()}.json`);
}

// Load a JSON preset and apply it to the UI.
function loadPreset() {
  const input = createFileInput((file) => {
    if (file.type === 'application' && file.subtype === 'json') {
      const preset = file.data;

      uiComponents.sculptureModeCheckbox.checked(preset.sculptureMode);
      state.frameRateSlider.value(preset.frameRate);

      state.spectrumRingCheckbox.checked(preset.spectrumRing.enabled);
      uiComponents.ring.gainSlider.value(preset.spectrumRing.gain);
      uiComponents.ring.thresholdSlider.value(preset.spectrumRing.threshold);

      state.spectrumDiffCheckbox.checked(preset.spectrumDiff.enabled);
      uiComponents.diff.gainSlider.value(preset.spectrumDiff.gain);
      uiComponents.diff.thresholdSlider.value(preset.spectrumDiff.threshold);
      uiComponents.diff.colorPicker.value(preset.spectrumDiff.color);

      BAND_CONFIG.forEach((band) => {
        const name = band.name;
        const bandPreset = preset.bands[name];
        if (bandPreset) {
          uiComponents[name].enabledCheckbox.checked(bandPreset.enabled);
          uiComponents[name].colorPicker.value(bandPreset.color);
          uiComponents[name].drawSelector.value(bandPreset.drawFunc);
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

      console.log('Preset loaded successfully.');
    } else {
      alert('エラー: JSONファイルを指定してください。');
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
function generateTimestampedFilename(extension) {
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

// =============================================================================
// Video recording
// =============================================================================

function toggleVideoRecording() {
  if (state.isVideoRecording) {
    stopVideoRecording();
  } else {
    startVideoRecording();
  }
}

function startVideoRecording() {
  if (state.isVideoRecording) return;
  if (getAudioContext().state !== 'running') userStartAudio();
  if (!state.isRecording && !state.isPlaying) {
    alert('描画または再生が開始されていません。録画を開始できません。');
    return;
  }

  if (!state.mediaRecorder) {
    console.log('Initializing MediaRecorder for the first time...');
    try {
      const canvas = document.querySelector('canvas');
      const videoStream = canvas.captureStream(state.frameRateSlider.value());
      const audioContext = getAudioContext();

      // Route only the active source into a dedicated capture destination.
      const mediaStreamDestination = audioContext.createMediaStreamDestination();

      if (state.currentInputMode === 'mic') {
        state.mic.connect(mediaStreamDestination);
      } else if (state.soundFile) {
        state.soundFile.connect(mediaStreamDestination);
      }

      const audioStream = mediaStreamDestination.stream;

      if (audioStream.getAudioTracks().length === 0) {
        alert('エラー: 音声トラックをキャプチャできませんでした。');
        return;
      }

      const combinedStream = new MediaStream([
        videoStream.getVideoTracks()[0],
        audioStream.getAudioTracks()[0],
      ]);

      state.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm; codecs=vp9,opus',
      });

      state.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) state.recordedChunks.push(event.data);
      };

      state.mediaRecorder.onstop = () => {
        const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style = 'display: none';
        a.href = url;
        a.download = generateTimestampedFilename('webm');
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        state.recordedChunks = [];
        console.log('Video file saved.');
      };
    } catch (err) {
      console.error('Failed to initialize MediaRecorder:', err);
      alert('動画の録画機能の初期化に失敗しました。お使いのブラウザが対応していない可能性があります。');
      return;
    }
  }

  state.recordedChunks = [];
  state.mediaRecorder.start();
  state.isVideoRecording = true;
  select('#video-record-btn').html('録画停止 (V)').addClass('active');
  console.log('Video recording started.');
}

function stopVideoRecording() {
  if (state.isVideoRecording) {
    state.mediaRecorder.stop();
    state.isVideoRecording = false;
    select('#video-record-btn').html('録画開始 (V)').removeClass('active');
    console.log('Video recording stopped.');
  }
}

// =============================================================================
// UI visibility
// =============================================================================

function toggleUIVisibility() {
  state.uiVisible = !state.uiVisible;
  state.uiPanel.style('display', state.uiVisible ? 'block' : 'none');
  select('#sound-controls').style('display', state.uiVisible ? 'flex' : 'none');
}

// =============================================================================
// Time / progress helpers
// =============================================================================

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function updateFileProgressBar() {
  const progressBar = select('#progress-bar');
  const timeDisplay = select('#file-time-display');
  if (state.soundFile && state.soundFile.isLoaded()) {
    const currentTime = state.soundFile.currentTime();
    const duration = state.soundFile.duration();
    progressBar.value((currentTime / duration) * 100); // p5 slider expects 0-100.
    timeDisplay.html(`${formatTime(currentTime)} / ${formatTime(duration)}`);
  }
}

// =============================================================================
// Sound control
// =============================================================================

function switchInputMode(mode) {
  stopAndReset();
  state.currentInputMode = mode;
  const micBtn = select('#mic-mode-btn');
  const fileBtn = select('#file-mode-btn');
  const micControls = select('#mic-controls');
  const fileControls = select('#file-controls');

  if (mode === 'mic') {
    micBtn.addClass('active');
    fileBtn.removeClass('active');
    micControls.style('display', 'flex');
    fileControls.style('display', 'none');
    state.fft.setInput(state.mic);
  } else {
    fileBtn.addClass('active');
    micBtn.removeClass('active');
    micControls.style('display', 'none');
    fileControls.style('display', 'flex');

    // Fully reset the mic connection so audio input is reliably off.
    if (state.mic.started) {
      state.mic.stop();
    }
    state.mic.disconnect();

    if (state.soundFile) {
      state.fft.setInput(state.soundFile);
    }
  }
}

function setupSoundControls() {
  const micBtn = select('#mic-mode-btn');
  const fileBtn = select('#file-mode-btn');
  const uploadInput = select('#upload-sound');
  const playPauseBtn = select('#play-pause-btn');
  const resetBtn = select('#reset-btn');
  const fileVolumeSlider = select('#file-volume-slider');
  const micRecordBtn = select('#mic-record-btn');
  const fileRecordBtn = select('#file-record-btn');
  const progressBar = select('#progress-bar');
  const videoRecordBtn = select('#video-record-btn');

  micBtn.mousePressed(() => switchInputMode('mic'));
  fileBtn.mousePressed(() => uploadInput.elt.click());
  uploadInput.changed(handleSoundFile);

  playPauseBtn.mousePressed(toggleFilePlayback);
  micRecordBtn.mousePressed(toggleMicRecording);
  fileRecordBtn.mousePressed(toggleFileRecording);
  videoRecordBtn.mousePressed(toggleVideoRecording);

  resetBtn.mousePressed(stopAndReset);

  fileVolumeSlider.input(() => {
    if (state.soundFile) {
      state.soundFile.setVolume(fileVolumeSlider.value());
    }
  });

  progressBar.elt.addEventListener('input', () => {
    if (state.soundFile && state.soundFile.isLoaded() && !state.soundFile.isPlaying()) {
      const duration = state.soundFile.duration();
      const jumpTime = (progressBar.value() / 100) * duration;
      state.soundFile.jump(jumpTime);
      updateFileProgressBar();
    }
  });
}

function handleSoundFile(event) {
  if (event.target.files[0]) {
    if (state.soundFile) {
      state.soundFile.stop();
    }
    state.soundFile = loadSound(event.target.files[0], () => {
      console.log('Sound file loaded.');

      // Initialize the trim range to the whole file.
      state.trimStart = 0;
      state.trimEnd = state.soundFile.duration();

      switchInputMode('file');

      const fileVolumeSlider = select('#file-volume-slider');
      state.soundFile.setVolume(fileVolumeSlider.value());

      select('#play-pause-btn').html('再生');
      select('#file-record-btn').html('描画開始');
      state.isPlaying = false;
      state.isRecording = false;
      noLoop();
    });
  }
}

function toggleFilePlayback() {
  if (!state.soundFile || !state.soundFile.isLoaded()) return;
  if (getAudioContext().state !== 'running') userStartAudio();

  state.isPlaying = !state.isPlaying;
  if (state.isPlaying) {
    state.soundFile.play();
    select('#play-pause-btn').html('一時停止');
    loop();
  } else {
    state.soundFile.pause();
    select('#play-pause-btn').html('再生');
    if (!state.isRecording) noLoop(); // Keep looping while recording.
  }
}

function toggleFileRecording() {
  if (!state.soundFile || !state.soundFile.isLoaded()) return;

  state.isRecording = !state.isRecording;
  if (state.isRecording) {
    if (state.spectrumHistory.length === 0) {
      state.sessionId = Date.now();
      state.recordStartTime = millis();
      state.trimStart = state.soundFile.currentTime();
    }
    select('#file-record-btn').html('描画停止');
    if (!state.isPlaying) loop();
  } else {
    state.trimEnd = state.soundFile.currentTime();
    select('#file-record-btn').html('描画開始');
    if (!state.isPlaying) noLoop();
  }
}

function toggleMicRecording() {
  if (getAudioContext().state !== 'running') userStartAudio();

  state.isRecording = !state.isRecording;
  state.isPlaying = state.isRecording;

  if (state.isRecording) {
    if (state.spectrumHistory.length === 0) {
      state.sessionId = Date.now();
      state.recordStartTime = millis();
    }
    state.mic.start();
    loop();
    select('#mic-record-btn').html('一時停止');
  } else {
    state.mic.stop();
    noLoop();
    select('#mic-record-btn').html('描画開始');
  }
}

function stopAndReset() {
  if (state.soundFile && (state.soundFile.isPlaying() || state.soundFile.isPaused())) {
    state.soundFile.stop();
  }
  if (state.mic && state.mic.started) {
    state.mic.stop();
  }

  state.isPlaying = false;
  state.isRecording = false;

  select('#play-pause-btn').html('再生');
  select('#mic-record-btn').html('描画開始');
  select('#file-record-btn').html('描画開始');

  background(0);
  state.spectrumHistory = [];
  state.prevSpectrum = [];

  // Fully reset video recording too.
  if (state.isVideoRecording) {
    stopVideoRecording();
  }
  state.mediaRecorder = null;
  state.recordedChunks = [];

  state.sessionId = null;
  select('#time-display').html('0.0s');

  if (state.currentInputMode === 'file' && state.soundFile && state.soundFile.isLoaded()) {
    updateFileProgressBar();
  }

  noLoop();
  console.log('Canvas and history cleared.');
}

// =============================================================================
// Initialization and UI construction
// =============================================================================

function initMic() {
  state.mic = new p5.AudioIn();
  state.mic.start(
    () => {
      console.log('Mic ready.');
      state.fft.setInput(state.mic);
      state.mic.stop(); // Start in a stopped state.
    },
    (err) => {
      console.error('Mic error:', err);
      alert('マイクの初期化に失敗しました。ブラウザの設定を確認してください。');
    }
  );
}

function createUI() {
  state.uiPanel = createDiv();
  state.uiPanel.parent('ui-container');
  state.uiPanel.addClass('ui-panel');
  state.uiPanel.position(10, 10);
  state.uiPanel.style('color', 'white');
  state.uiPanel.style('background', 'rgba(0, 0, 0, 0.6)');
  state.uiPanel.style('padding', '10px');
  state.uiPanel.style('border-radius', '8px');
  state.uiPanel.style('max-width', '320px');
  state.uiPanel.style('overflow-y', 'auto');
  state.uiPanel.style('max-height', '90vh');

  let randomColors = generateDistinctColors(8);

  const createSliderWithLabel = (label, min, max, initial, step, parentEl) => {
    let container = createDiv(label + ': ').parent(parentEl);
    let slider = createSlider(min, max, initial, step).parent(container).addClass('ui-slider');
    let valueSpan = createSpan(initial).parent(container).style('margin-left', '5px');
    slider.input(() => valueSpan.html(slider.value()));
    return slider;
  };

  createDiv('Controls').parent(state.uiPanel).addClass('ui-section-title');
  const saveButton = createButton('Save SVG (S)').parent(state.uiPanel);
  saveButton.mousePressed(downloadSVG);
  const pngButton = createButton('Save PNG (P)').parent(state.uiPanel);
  pngButton.mousePressed(() => {
    const fileName = generateTimestampedFilename('png');
    saveCanvas(fileName);
  });
  const clearButton = createButton('Clear Canvas (E)').parent(state.uiPanel);
  clearButton.mousePressed(stopAndReset);
  const toggleUiButton = createButton('Toggle UI (C)').parent(state.uiPanel);
  toggleUiButton.mousePressed(toggleUIVisibility);

  const presetDiv = createDiv().parent(state.uiPanel);
  const savePresetButton = createButton('技法を保存').parent(presetDiv);
  savePresetButton.mousePressed(savePreset);
  const loadPresetButton = createButton('技法を読込').parent(presetDiv);
  loadPresetButton.mousePressed(loadPreset);

  createDiv('Drawing Mode').parent(state.uiPanel).addClass('ui-section-title');
  uiComponents.sculptureModeCheckbox = createCheckbox('彫刻モード（描画を蓄積）', false)
    .parent(state.uiPanel)
    .style('color', 'white');

  createDiv('Frame Rate').parent(state.uiPanel).addClass('ui-section-title');
  state.frameRateSlider = createSlider(1, 60, 15, 1).parent(state.uiPanel);
  const frameRateValueSpan = createSpan(state.frameRateSlider.value())
    .parent(state.frameRateSlider.parent())
    .style('color', 'white');
  state.frameRateSlider.input(() => frameRateValueSpan.html(state.frameRateSlider.value()));

  const spectrumDiv = createDiv('Spectrum Layers').parent(state.uiPanel).addClass('ui-section-title');

  state.spectrumRingCheckbox = createCheckbox('Draw Spectrum Ring', true)
    .parent(spectrumDiv)
    .style('color', 'white');
  const ringControls = createDiv().parent(spectrumDiv).style('padding-left', '20px');
  uiComponents.ring = {
    gainSlider: createSliderWithLabel('Gain', 0.1, 10.0, 1.0, 0.1, ringControls),
    thresholdSlider: createSliderWithLabel('Threshold', 0, 255, 30, 1, ringControls),
  };

  state.spectrumDiffCheckbox = createCheckbox('Draw Spectrum Diff', true)
    .parent(spectrumDiv)
    .style('color', 'white');
  const diffControls = createDiv().parent(spectrumDiv).style('padding-left', '20px');
  state.spectrumDiffColorPicker = createColorPicker('#ffffff').parent(diffControls);
  uiComponents.diff = {
    gainSlider: createSliderWithLabel('Gain', 0.1, 10.0, 1.0, 0.1, diffControls),
    thresholdSlider: createSliderWithLabel('Threshold', 0, 255, 15, 1, diffControls),
    colorPicker: state.spectrumDiffColorPicker,
  };

  const energySettings = {
    low: { gain: 1.0, threshold: 100 },
    mid: { gain: 1.0, threshold: 100 },
    high: { gain: 1.0, threshold: 100 },
    subBass: { gain: 1.0, threshold: 100 },
    lowMid: { gain: 1.0, threshold: 100 },
    upperMid: { gain: 1.0, threshold: 100 },
    presence: { gain: 1.0, threshold: 100 },
    brilliance: { gain: 1.0, threshold: 100 },
  };

  BAND_CONFIG.forEach((band, index) => {
    let name = band.name;
    let title = `${name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')} (${band.freq[0]} - ${band.freq[1]} Hz)`;
    const section = createDiv(title).parent(state.uiPanel).addClass('ui-section-title');

    uiComponents[name] = {};

    uiComponents[name].enabledCheckbox = createCheckbox('Enabled', true).parent(section);
    uiComponents[name].colorPicker = createColorPicker(randomColors[index]).parent(section);
    const drawSelector = createSelect().parent(section);
    for (let key in drawFunctionMap) {
      drawSelector.option(key);
    }
    drawSelector.selected(band.defFunc);
    uiComponents[name].drawSelector = drawSelector;
    const defaultWeight = drawFunctionMap[band.defFunc].defaultWeight;
    uiComponents[name].strokeSlider = createSliderWithLabel('Stroke', 0.1, 5, defaultWeight, 0.1, section);
    uiComponents[name].alphaSlider = createSliderWithLabel('Alpha', 0, 255, 20, 1, section);
    uiComponents[name].gainSlider = createSliderWithLabel('Gain', 0.1, 5.0, energySettings[name].gain, 0.01, section);
    uiComponents[name].thresholdSlider = createSliderWithLabel('Threshold', 0, 255, energySettings[name].threshold, 1, section);
    uiComponents[name].intensityGainSlider = createSliderWithLabel('IntensityGain', 0.0, 5.0, 1.0, 0.01, section);
    uiComponents[name].angleSpeedSlider = createSliderWithLabel('AngleSpeed', 0.0, 5.0, 1.0, 0.01, section);

    drawSelector.changed(() => {
      const selectedKey = drawSelector.value();
      const newWeight = drawFunctionMap[selectedKey].defaultWeight;
      uiComponents[name].strokeSlider.value(newWeight);
    });
  });
}

function generateDistinctColors(count) {
  const colors = [];
  let baseHue = random(360);
  for (let i = 0; i < count; i++) {
    let hue = (baseHue + i * (360 / count) + random(-20, 20)) % 360;
    colors.push(color(hue, random(60, 100), random(70, 100)));
  }
  return colors;
}

// =============================================================================
// p5 global-mode bootstrap
// =============================================================================
// In a classic <script>, top-level function declarations become window
// properties automatically; inside an ES module they are module-scoped, so the
// p5 lifecycle hooks must be exposed on window explicitly for global mode.
window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
window.keyPressed = keyPressed;
