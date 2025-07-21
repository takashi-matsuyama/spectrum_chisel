let fft;
let sessionId = null;

// ★ Phase 1 変更点: 音源管理用の変数を追加
let mic, soundFile;
let currentInputMode = 'mic';
let isPlaying = false;    // プレビュー再生中か？
let isRecording = false;  // 録画（描画）中か？

// Phase 2 追加: 描画管理用の変数
let trimStart = 0;
let trimEnd = null;
let recordStartTime = 0;

// ★ 修正点 1: SVG書き出し用のスペクトル履歴を管理する配列
let spectrumHistory = [];

// --- UI Elements (Global Scope) ---
let uiPanel, frameRateSlider;
let spectrumRingCheckbox, spectrumDiffCheckbox, spectrumDiffColorPicker;
let prevSpectrum = [];
let uiVisible = true;

// ★★★ UIコンポーネントを格納するオブジェクトを準備 ★★★
const uiComponents = {};

// Drawing function map from your original code
const drawFunctionMap = {
  drawSmoothEllipse: { func: drawSmoothEllipse, defaultWeight: 0.4 },
  drawRotatingWaves: { func: drawRotatingWaves, defaultWeight: 1.5 },
  drawRadialLines: { func: drawRadialLines, defaultWeight: 1.2 },
  drawExpandingDots: { func: drawExpandingDots, defaultWeight: 0.8 },
  drawRadiantBeams: { func: drawRadiantBeams, defaultWeight: 2.0 },
  drawSparks: { func: drawSparks, defaultWeight: 0.1 },
  drawNoisyContours: { func: drawNoisyContours, defaultWeight: 0.6 },
  drawFloatingDots: { func: drawFloatingDots, defaultWeight: 1.0 }
};

const BAND_CONFIG = [
  { name: 'subBass', freq: [20, 60], defFunc: "drawExpandingDots" },
  { name: 'low', freq: [60, 250], defFunc: "drawSmoothEllipse" },
  { name: 'lowMid', freq: [250, 500], defFunc: "drawNoisyContours" },
  { name: 'mid', freq: [500, 2000], defFunc: "drawRotatingWaves" },
  { name: 'upperMid', freq: [2000, 4000], defFunc: "drawFloatingDots" },
  { name: 'presence', freq: [4000, 6000], defFunc: "drawSparks" },
  { name: 'brilliance', freq: [6000, 16000], defFunc: "drawRadiantBeams" },
  { name: 'high', freq: [16000, 20000], defFunc: "drawRadialLines" }
];

// =============================================================================
// p5.js Lifecycle Functions
// =============================================================================

function setup() {
  // ★★★ ウィンドウサイズでキャンバスを作成 ★★★
  let myCanvas = createCanvas(windowWidth, windowHeight);
  myCanvas.parent('canvas-container');
  colorMode(HSB, 360, 100, 100);
  background(0);

  fft = new p5.FFT(0.9, 512);

  // ★ Phase 1 変更点: UI初期化と音源初期化
  initMic();
  setupSoundControls(); // 新しい音源コントロールUIのセットアップ
  createUI(); // 既存のUIセットアップ
}

// draw()関数を、このコードでまるごと置き換えてください

function draw() {
  if (!isPlaying && !isRecording) {
    noLoop();
    return;
  }

  // ★★★ ここからが修正箇所です ★★★
  // 描画モードに応じて背景の処理を切り替える
  if (isRecording) {
    if (!uiComponents.sculptureModeCheckbox.checked()) {
      // 「彫刻モード」がオフの場合、残像効果（ライブモード）
      background(0, 20);
    }
    // 「彫刻モード」がオンの場合は、背景をクリアしない（描画を蓄積）
  } else {
    // プレビュー中は常に背景をクリア
    background(0);
  }
  // ★★★ ここまで修正 ★-★★

  // 描画中のタイマー更新
  if (isRecording) {
    const elapsedTime = (millis() - recordStartTime) / 1000;
    select('#time-display').html(`${elapsedTime.toFixed(1)}s`);
  }

  // ファイル再生中のプログレスバー更新
  if (currentInputMode === 'file' && soundFile && soundFile.isLoaded() && soundFile.isPlaying()) {
    updateFileProgressBar();
    if (isRecording && soundFile.currentTime() >= trimEnd) {
      stopAndReset();
    }
  }

  frameRate(frameRateSlider.value());
  const micBoost = (currentInputMode === 'mic') ? select('#mic-boost-slider').value() : 1;
  drawVisuals(this, frameCount, false, micBoost);
}

// =============================================================================
// Core Drawing and Event Handling
// =============================================================================

function drawVisuals(pg, currentFrame, isForSVG = false, boost = 1) {
  let spectrum;

  if (isForSVG) {
    spectrum = spectrumHistory[currentFrame - 1];
  } else {
    spectrum = fft.analyze();
    // ★★★ 録画中のみ履歴を追加 ★★★
    if (isRecording) spectrumHistory.push(spectrum.slice());
  }

  if (!spectrum) return;

  let totalEnergy = spectrum.reduce((a, b) => a + b, 0);
  if (totalEnergy * boost < 100 && !isForSVG) {
    if (!isForSVG) prevSpectrum = spectrum.slice();
    return;
  }

  pg.push();
  pg.translate(pg.width / 2, pg.height / 2);
  const scaleFactor = min(pg.width, pg.height) / 800;
  pg.scale(scaleFactor);

  const time = currentFrame * 0.005;

  const getEnergyFromSpectrum = (freq1, freq2) => {
    const nyquist = 22050;
    const startIndex = Math.floor(map(freq1, 0, nyquist, 0, spectrum.length));
    const endIndex = Math.ceil(map(freq2, 0, nyquist, 0, spectrum.length));
    let sum = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      if (spectrum[i] !== undefined) {
        sum += spectrum[i];
      }
    }
    return sum / (endIndex - startIndex + 1);
  };

  // ★★★ プレビュー中は描画しない ★★★
  if (!isRecording && !isForSVG) {
    pg.pop();
    prevSpectrum = spectrum.slice();
    return;
  }

  BAND_CONFIG.forEach(bandInfo => {
    const components = uiComponents[bandInfo.name];
    if (components && components.enabledCheckbox.checked()) {
      const bandEnergy = getEnergyFromSpectrum(bandInfo.freq[0], bandInfo.freq[1]);
      const ui = {
        color: components.colorPicker.color(), weight: components.strokeSlider.value(), alpha: components.alphaSlider.value(),
        gain: components.gainSlider.value(), threshold: components.thresholdSlider.value(),
        intensityGain: components.intensityGainSlider.value(), angleSpeed: components.angleSpeedSlider.value(),
        drawFunc: components.drawSelector.value()
      };

      let scaledEnergy = pg.constrain(bandEnergy * ui.gain * boost, 0, 255);

      if (scaledEnergy > ui.threshold) {
        pg.push();
        let intensity = pg.map(bandEnergy * boost, 0, 255, 0, 1);
        let angle = currentFrame * 0.02;
        let dx = pg.sin(angle + time) * 10 * intensity;
        let dy = pg.cos(angle + time * 1.5) * 10 * intensity;
        pg.translate(dx, dy);
        const style = { color: ui.color, weight: ui.weight, alpha: ui.alpha };
        const params = { intensityGain: ui.intensityGain, angleSpeed: ui.angleSpeed, threshold: ui.threshold };
        const func = drawFunctionMap[ui.drawFunc].func;
        func(pg, scaledEnergy, currentFrame, time, style, params);
        pg.pop();
      }
    }
  });

  if (spectrumRingCheckbox.checked()) {
    drawSpectrumRingByBands(pg, spectrum, currentFrame, boost);
  }
  if (spectrumDiffCheckbox.checked()) {
    const prevSpecForDiff = isForSVG ? (spectrumHistory[currentFrame - 2] || []) : prevSpectrum;
    drawSpectrumDiff(pg, spectrum, prevSpecForDiff, boost);
  }

  pg.pop();
  if (!isForSVG) prevSpectrum = spectrum.slice();
}

function drawSpectrumRingByBands(pg, spectrum, frameCount, boost) {
  const ringUI = uiComponents.ring;
  const gain = ringUI.gainSlider.value();
  const threshold = ringUI.thresholdSlider.value();
  const overallEnergy = spectrum.reduce((sum, value) => sum + value, 0) / spectrum.length;

  if (overallEnergy * gain * boost < threshold) {
    return;
  }

  pg.noFill();
  let totalBands = spectrum.length;

  // ★★★ グローバルなBAND_CONFIGを参照 ★★★
  BAND_CONFIG.forEach(bandInfo => {
    const color = uiComponents[bandInfo.name].colorPicker.color();
    let startIndex = floor(pg.map(bandInfo.freq[0], 0, 22050, 0, totalBands));
    let endIndex = floor(pg.map(bandInfo.freq[1], 0, 22050, 0, totalBands));
    pg.stroke(color); pg.strokeWeight(1); pg.beginShape();
    for (let i = startIndex; i < endIndex; i++) {
      if (spectrum[i] === undefined) continue;
      let angle = pg.map(i, 0, totalBands, 0, pg.TWO_PI);
      let baseRadius = pg.map(spectrum[i], 0, 255, 60, 280);
      let breathing = pg.sin(frameCount * 0.05 + angle) * 8;
      let jitter = pg.noise(angle + frameCount * 0.01) * 10;
      let radius = baseRadius + breathing + jitter;
      let x = pg.cos(angle) * radius; let y = pg.sin(angle) * radius;
      pg.vertex(x, y);
    }
    pg.endShape();
  });
}

// 【1】downloadSVG関数を、このコードでまるごと置き換えてください

function downloadSVG() {
  console.log("Starting SVG export...");
  noLoop();

  const svg = createGraphics(width, height, SVG);
  svg.colorMode(HSB, 360, 100, 100);
  svg.background(0);

  const micBoostForSVG = (currentInputMode === 'mic') ? select('#mic-boost-slider').value() : 1;

  // ★★★ 描画モードに応じて保存内容を切り替え ★★★
  if (uiComponents.sculptureModeCheckbox.checked()) {
    // 「彫刻モード」の場合：全履歴を描画
    console.log("Exporting in Sculpture Mode (full history)...");
    for (let i = 0; i < spectrumHistory.length; i++) {
      drawVisuals(svg, i + 1, true, micBoostForSVG);
    }
  } else {
    // 「残像モード」の場合：最新の1フレームだけを描画
    console.log("Exporting in Live Mode (snapshot)...");
    if (spectrumHistory.length > 0) {
      drawVisuals(svg, spectrumHistory.length, true, micBoostForSVG);
    }
  }

  const fileName = generateTimestampedFilename('svg');
  save(svg, fileName);

  console.log("SVG export complete.");
  svg.remove();

  if (isPlaying || isRecording) {
    loop();
  }
}

function generateTimestampedFilename(extension) {
  const totalSeconds = (spectrumHistory.length / frameRateSlider.value()).toFixed(1);
  const totalFrames = spectrumHistory.length;
  let prefix = currentInputMode === 'mic' ? 'sc-mic' : 'sc-file';
  const id = sessionId || Date.now();

  if (currentInputMode === 'file' && soundFile && trimEnd !== null) {
    if (trimStart !== 0 || trimEnd < soundFile.duration() - 0.1) {
      prefix += `-trim[${trimStart.toFixed(1)}-${trimEnd.toFixed(1)}]s`;
    }
  }

  // ★★★ ファイル名に詩的な描画モードを追加 ★★★
  const modeSuffix = uiComponents.sculptureModeCheckbox.checked() ? 'eternity' : 'moment';

  return `${prefix}-${id}-${modeSuffix}-t${totalSeconds}s-f${totalFrames}.${extension}`;
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    downloadSVG();
  }
  if (key === 'p' || key === 'P') {
    // ★★★ 新しい関数でファイル名を生成 ★★★
    const fileName = generateTimestampedFilename('png');
    saveCanvas(fileName);
  }
  if (key === 'c' || key === 'C') {
    toggleUIVisibility();
  }
  if (key === 'e' || key === 'E') {
    stopAndReset();
  }
}

function toggleUIVisibility() {
  uiVisible = !uiVisible;
  uiPanel.style('display', uiVisible ? 'block' : 'none');
  select('#sound-controls').style('display', uiVisible ? 'flex' : 'none');
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // リサイズ時に描画履歴をリセットして、きれいに再描画を開始
  background(0);
  spectrumHistory = [];
  prevSpectrum = [];
}


// ★★★ この3つの関数を setupSoundControls() の上に追加 ★★★

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function updateFileProgressBar() {
  const progressBar = select('#progress-bar');
  const timeDisplay = select('#file-time-display');
  if (soundFile && soundFile.isLoaded()) {
    const currentTime = soundFile.currentTime();
    const duration = soundFile.duration();
    progressBar.value((currentTime / duration) * 100); // p5.jsのsliderは0-100の値
    timeDisplay.html(`${formatTime(currentTime)} / ${formatTime(duration)}`);
  }
}

function updateTrimInfo() {
  const trimInfo = select('#trim-info');
  if (soundFile && trimEnd !== null) {
    if (trimStart === 0 && trimEnd >= soundFile.duration()) {
      trimInfo.html('Trim: Full');
    } else {
      trimInfo.html(`Trim: ${trimStart.toFixed(1)}s - ${trimEnd.toFixed(1)}s`);
    }
  } else {
    trimInfo.html('Trim: Full');
  }
}

// =============================================================================
// Sound Control Functions
// =============================================================================

function switchInputMode(mode) {
  stopAndReset();
  currentInputMode = mode;
  const micBtn = select('#mic-mode-btn');
  const fileBtn = select('#file-mode-btn');
  const micControls = select('#mic-controls');
  const fileControls = select('#file-controls');

  if (mode === 'mic') {
    micBtn.addClass('active');
    fileBtn.removeClass('active');
    micControls.style('display', 'flex');
    fileControls.style('display', 'none');
    fft.setInput(mic);
  } else { // 'file'モード
    fileBtn.addClass('active');
    micBtn.removeClass('active');
    micControls.style('display', 'none');
    fileControls.style('display', 'flex');
    if (soundFile) fft.setInput(soundFile);
  }
}

function setupSoundControls() {
  const micBtn = select('#mic-mode-btn');
  const fileBtn = select('#file-mode-btn');
  const uploadInput = select('#upload-sound');
  const playPauseBtn = select('#play-pause-btn');
  const stopBtn = select('#reset-btn');
  const fileVolumeSlider = select('#file-volume-slider');
  const micRecordBtn = select('#mic-record-btn');
  const fileRecordBtn = select('#file-record-btn');
  const setStartBtn = select('#set-start-btn');
  const setEndBtn = select('#set-end-btn');
  const progressBar = select('#progress-bar');

  // ★★★ 新しいグローバル関数を呼び出すように変更 ★★★
  micBtn.mousePressed(() => switchInputMode('mic'));
  fileBtn.mousePressed(() => {
    uploadInput.elt.click();
  });

  uploadInput.changed(handleSoundFile);

  playPauseBtn.mousePressed(toggleFilePreview);
  micRecordBtn.mousePressed(toggleMicRecording);
  fileRecordBtn.mousePressed(startFileRecording);

  stopBtn.mousePressed(stopAndReset);

  fileVolumeSlider.input(() => {
    if (soundFile) {
      soundFile.setVolume(fileVolumeSlider.value());
    }
  });

  progressBar.elt.addEventListener('input', () => {
    if (soundFile && soundFile.isLoaded() && !soundFile.isPlaying()) {
      const duration = soundFile.duration();
      const jumpTime = (progressBar.value() / 100) * duration;
      soundFile.jump(jumpTime);
      updateFileProgressBar();
    }
  });

  setStartBtn.mousePressed(() => {
    if (soundFile) {
      trimStart = soundFile.currentTime();
      if (trimEnd !== null && trimStart >= trimEnd) trimEnd = soundFile.duration();
      updateTrimInfo();
    }
  });

  setEndBtn.mousePressed(() => {
    if (soundFile) {
      trimEnd = soundFile.currentTime();
      if (trimStart > trimEnd) trimStart = 0;
      updateTrimInfo();
    }
  });
}

function handleSoundFile(event) {
  if (event.target.files[0]) {
    if (soundFile && (soundFile.isPlaying() || soundFile.isPaused())) {
      soundFile.stop();
    }
    soundFile = loadSound(event.target.files[0], () => {
      console.log("Sound file loaded.");
      // ★★★ 録画範囲を初期化 ★★★
      trimStart = 0;
      trimEnd = soundFile.duration();
      updateTrimInfo();
      updateFileProgressBar();

      const fileVolumeSlider = select('#file-volume-slider');
      soundFile.setVolume(fileVolumeSlider.value());
      switchInputMode('file');
      toggleFilePreview(); // ロードされたら自動でプレビュー再生を開始
    });
  }
}

function toggleFilePreview() {
  if (!soundFile || !soundFile.isLoaded()) return;
  if (getAudioContext().state !== 'running') userStartAudio();

  isPlaying = !isPlaying;
  if (isPlaying) {
    if (isRecording) stopAndReset(); // もし録画中ならリセット
    soundFile.loop();
    select('#play-pause-btn').html('描画停止');
    loop(); // 描画ループを開始してプログレスバーを動かす
  } else {
    soundFile.pause();
    select('#play-pause-btn').html('プレビュー再生');
    noLoop();
  }
}

function toggleMicRecording() {
  if (getAudioContext().state !== 'running') userStartAudio();

  // isPlaying をマイクの録画状態として使う
  isPlaying = !isPlaying;
  isRecording = isPlaying; // マイクモードでは再生と録画は同義

  if (isPlaying) {
    if (spectrumHistory.length === 0) {
      sessionId = Date.now();
      recordStartTime = millis();
    }
    mic.start();
    loop();
    select('#mic-record-btn').html('描画停止');
  } else {
    mic.stop();
    noLoop();
    select('#mic-record-btn').html('描画開始');
  }
}

function startFileRecording() {
  if (soundFile && soundFile.isLoaded() && !isRecording) {
    stopAndReset();
    isRecording = true;
    sessionId = Date.now();
    recordStartTime = millis();

    soundFile.play(); // loop()ではなくplay()で一度だけ再生
    soundFile.jump(trimStart); // 開始点から再生
    loop();
    select('#file-record-btn').html('描画中...');
  }
}

// stopAndReset()関数を、このコードでまるごと置き換えてください
function stopAndReset() {
  if (isPlaying || isRecording) {
    if (soundFile && soundFile.isPlaying()) soundFile.stop();
    if (mic.started) mic.stop();
  }

  isPlaying = false;
  isRecording = false;

  select('#play-pause-btn').html('プレビュー再生');
  select('#mic-record-btn').html('描画開始');
  select('#file-record-btn').html('描画開始');

  background(0);
  spectrumHistory = [];
  prevSpectrum = [];

  sessionId = null;
  select('#time-display').html('0.0s');

  if (currentInputMode === 'file' && soundFile && soundFile.isLoaded()) {
    trimStart = 0;
    trimEnd = soundFile.duration();
    updateFileProgressBar();
    updateTrimInfo();
  }

  noLoop();
  console.log("Canvas and history cleared.");
}

// =============================================================================
// Initialization and Helper Functions
// =============================================================================
function initMic() {
  mic = new p5.AudioIn();
  mic.start(() => {
    console.log("Mic ready.");
    fft.setInput(mic);
    mic.stop(); // 初期状態は停止させておく
  }, (err) => {
    console.error("Mic error:", err);
    alert("マイクの初期化に失敗しました。ブラウザの設定を確認してください。");
  });
}

function createUI() {
  uiPanel = createDiv();
  uiPanel.parent('ui-container');
  uiPanel.addClass('ui-panel');
  uiPanel.position(10, 10);
  uiPanel.style('color', 'white');
  uiPanel.style('background', 'rgba(0, 0, 0, 0.6)');
  uiPanel.style('padding', '10px');
  uiPanel.style('border-radius', '8px');
  uiPanel.style('max-width', '320px');
  uiPanel.style('overflow-y', 'auto');
  uiPanel.style('max-height', '90vh');

  let randomColors = generateDistinctColors(8);

  const createSliderWithLabel = (label, min, max, initial, step, parentEl) => {
    let container = createDiv(label + ': ').parent(parentEl);
    let slider = createSlider(min, max, initial, step).parent(container).addClass('ui-slider');
    let valueSpan = createSpan(initial).parent(container).style('margin-left', '5px');
    slider.input(() => valueSpan.html(slider.value()));
    return slider;
  };

  createDiv('Controls').parent(uiPanel).addClass('ui-section-title');
  const saveButton = createButton('Save SVG (S)').parent(uiPanel);
  saveButton.mousePressed(downloadSVG);
  const pngButton = createButton('Save PNG (P)').parent(uiPanel);
  pngButton.mousePressed(() => {
    const fileName = generateTimestampedFilename('png');
    saveCanvas(fileName);
  });
  const clearButton = createButton('Clear Canvas (E)').parent(uiPanel);
  clearButton.mousePressed(stopAndReset);
  const toggleUiButton = createButton('Toggle UI (C)').parent(uiPanel);
  toggleUiButton.mousePressed(toggleUIVisibility);

  createDiv('Drawing Mode').parent(uiPanel).addClass('ui-section-title');
  // ★★★ ここを true から false に変更 ★★★
  uiComponents.sculptureModeCheckbox = createCheckbox('彫刻モード（描画を蓄積）', false).parent(uiPanel).style('color', 'white');

  createDiv('Frame Rate').parent(uiPanel).addClass('ui-section-title');
  frameRateSlider = createSlider(1, 60, 15, 1).parent(uiPanel);
  const frameRateValueSpan = createSpan(frameRateSlider.value()).parent(frameRateSlider.parent()).style('color', 'white');
  frameRateSlider.input(() => frameRateValueSpan.html(frameRateSlider.value()));

  const spectrumDiv = createDiv('Spectrum Layers').parent(uiPanel).addClass('ui-section-title');

  spectrumRingCheckbox = createCheckbox('Draw Spectrum Ring', true).parent(spectrumDiv).style('color', 'white');
  const ringControls = createDiv().parent(spectrumDiv).style('padding-left', '20px');
  uiComponents.ring = {
    gainSlider: createSliderWithLabel('Gain', 0.1, 10.0, 1.0, 0.1, ringControls),
    thresholdSlider: createSliderWithLabel('Threshold', 0, 255, 30, 1, ringControls)
  };

  spectrumDiffCheckbox = createCheckbox('Draw Spectrum Diff', true).parent(spectrumDiv).style('color', 'white');
  const diffControls = createDiv().parent(spectrumDiv).style('padding-left', '20px');
  spectrumDiffColorPicker = createColorPicker('#ffffff').parent(diffControls);
  uiComponents.diff = {
    gainSlider: createSliderWithLabel('Gain', 0.1, 10.0, 1.0, 0.1, diffControls),
    thresholdSlider: createSliderWithLabel('Threshold', 0, 255, 15, 1, diffControls),
    colorPicker: spectrumDiffColorPicker
  };

  const energySettings = { low: { gain: 1.0, threshold: 100 }, mid: { gain: 1.0, threshold: 100 }, high: { gain: 1.0, threshold: 100 }, subBass: { gain: 1.0, threshold: 100 }, lowMid: { gain: 1.0, threshold: 100 }, upperMid: { gain: 1.0, threshold: 100 }, presence: { gain: 1.0, threshold: 100 }, brilliance: { gain: 1.0, threshold: 100 } };

  BAND_CONFIG.forEach((band, index) => {
    let name = band.name;
    let title = `${name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')} (${band.freq[0]} - ${band.freq[1]} Hz)`;
    const section = createDiv(title).parent(uiPanel).addClass('ui-section-title');

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
// Drawing Functions
// =============================================================================


function drawSpectrumDiff(pg, current, previous, boost) {
  if (!previous || previous.length === 0) return;

  const diffUI = uiComponents.diff;
  let diffColor = diffUI.colorPicker.color();
  const gain = diffUI.gainSlider.value();
  const threshold = diffUI.thresholdSlider.value();

  diffColor.setAlpha(180); pg.noFill();
  for (let i = 0; i < current.length; i++) {
    let diff = Math.abs(current[i] - (previous[i] || 0));
    // ★★★ micBoostを適用 ★★★
    if (diff * gain * boost > threshold) {
      let angle = pg.map(i, 0, current.length, 0, pg.TWO_PI);
      let radius = pg.map(diff, 10, 255, 120, 370);
      let x = pg.cos(angle) * radius; let y = pg.sin(angle) * radius;
      pg.stroke(diffColor); pg.strokeWeight(pg.map(diff, 10, 255, 1, 3));
      pg.point(x, y);
    }
  }
}

function drawSmoothEllipse(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let intensityGain = (params && typeof params.intensityGain === "number") ? params.intensityGain : 1.0;
  let angleSpeed = (params && typeof params.angleSpeed === "number") ? params.angleSpeed : 1.0;
  let baseA = pg.map(energy, 0, 255, 80, 340) * intensityGain; let baseB = pg.map(energy, 0, 255, 60, 240) * intensityGain;
  let waviness = pg.map(energy, 0, 255, 5, 50) * intensityGain; let waveCount = 2 + pg.floor(pg.map(energy, 0, 255, 2, 8));
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let detail = pg.ceil(pg.map(energy, params.threshold, 255, 1, 4));
  for (let d = 0; d < detail; d++) {
    pg.beginShape();
    for (let t = 0; t <= pg.TWO_PI + 0.05; t += 0.05) {
      let a = baseA + pg.sin(t * waveCount + time * 1.5 * angleSpeed + d) * waviness;
      let b = baseB + pg.cos(t * waveCount + time * 1.4 * angleSpeed + d) * (waviness * 0.7);
      let x = (a + pg.noise(t + d * 0.3 + time) * 10) * pg.cos(t); let y = (b + pg.noise(t + d * 0.5 + time + 100) * 10) * pg.sin(t);
      pg.curveVertex(x, y);
    }
    pg.endShape(pg.CLOSE);
  }
}
function drawRotatingWaves(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight);
  let rot = pg.map(energy, 0, 255, 0, pg.PI / 2) + frameCount * 0.01 * (params.angleSpeed || 1.0); pg.rotate(rot);
  let baseRadius = pg.map(energy, 0, 255, 60, 320) * (params.intensityGain || 1.0);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let detail = pg.ceil(pg.map(energy, params.threshold, 255, 3, 14));
  pg.noFill(); pg.beginShape();
  for (let i = 0; i < detail + 2; i++) {
    let angle = pg.map(i, 0, detail + 1, 0, pg.TWO_PI) + frameCount * 0.03 * (params.angleSpeed || 1.0);
    let radius = baseRadius + pg.sin(frameCount * 0.1 + i) * 30;
    let x = (pg.random(2, 20)) * pg.cos(angle) + radius * pg.cos(angle); let y = (pg.random(2, 20)) * pg.sin(angle) + radius * pg.sin(angle);
    pg.curveVertex(x, y);
  }
  pg.endShape(pg.CLOSE);
}
function drawRadialLines(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let rot = pg.map(energy, 0, 255, 0, pg.PI) + frameCount * 0.05 * (params.angleSpeed || 1.0); pg.rotate(rot);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let detail = pg.ceil(pg.map(energy, params.threshold, 255, 2, 12));
  for (let i = 0; i < detail; i++) {
    let minRadius = 40 * (params.intensityGain || 1.0);
    let angle = pg.random(pg.TWO_PI);
    let x1 = pg.cos(angle) * pg.random(minRadius, minRadius + 30); let y1 = pg.sin(angle) * pg.random(minRadius, minRadius + 30);
    let x2 = x1 + pg.cos(angle) * pg.random(20, 100); let y2 = y1 + pg.sin(angle) * pg.random(-20, 20);
    pg.line(x1, y1, x2, y2);
  }
}
function drawExpandingDots(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let rot = pg.map(energy, 0, 255, 0, pg.PI / 2) + time * 0.2 * (params.angleSpeed || 1.0); pg.rotate(rot);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let ringCount = 1 + pg.floor(pg.map(energy, params.threshold, 255, 1, 6));
  for (let r = 0; r < ringCount; r++) {
    let radius = (pg.map(energy, 0, 255, 20, 180) + r * 10) * (params.intensityGain || 1.0);
    let dotCount = pg.floor(pg.TWO_PI * radius / 14);
    for (let i = 0; i < dotCount; i++) {
      let angle = (pg.TWO_PI / dotCount) * i;
      let x = pg.cos(angle) * radius; let y = pg.sin(angle) * radius;
      pg.strokeWeight(pg.random(0.5, 1.5)); pg.point(x, y);
    }
  }
}
function drawRadiantBeams(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let rot = pg.map(energy, 0, 255, 0, pg.PI) + time * 1.2 * (params.angleSpeed || 1.0); pg.rotate(rot);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let rays = 6 + pg.floor(pg.map(energy, params.threshold, 255, 2, 20));
  let baseLen = pg.map(energy, 0, 255, 80, 340) * (params.intensityGain || 1.0);
  let detail = pg.floor(pg.map(energy, 0, 255, 1, 4));
  let innerRadius = pg.map(energy, 0, 255, 20, 100) * (params.intensityGain || 1.0);
  for (let d = 0; d < detail; d++) {
    for (let i = 0; i < rays; i++) {
      let angle = (pg.TWO_PI / rays) * i + time * 1.2 + d * 0.2;
      let len = baseLen + pg.sin(time * 2 + i + d) * 30 + pg.random(-10, 10);
      let x1 = pg.cos(angle) * innerRadius; let y1 = pg.sin(angle) * innerRadius;
      let x2 = pg.cos(angle) * len; let y2 = pg.sin(angle) * len;
      pg.line(x1, y1, x2, y2);
    }
  }
}
function drawSparks(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let rot = pg.map(energy, 0, 255, 0, pg.PI / 2) + frameCount * 0.1 * (params.angleSpeed || 1.0); pg.rotate(rot);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let sparkCount = pg.floor(pg.map(energy, params.threshold, 255, 3, 20));
  let maxLength = pg.map(energy, 0, 255, 20, 120) * (params.intensityGain || 1.0);
  let detail = pg.floor(pg.map(energy, 0, 255, 1, 4));
  let minRadius = pg.map(energy, 0, 255, 150, 250) * (params.intensityGain || 1.0);
  for (let d = 0; d < detail; d++) {
    for (let i = 0; i < sparkCount; i++) {
      let angle = (pg.TWO_PI / sparkCount) * i + frameCount * 0.1 + d * 0.13;
      let x1 = pg.cos(angle) * pg.random(minRadius, minRadius + 20);
      let y1 = pg.sin(angle) * pg.random(minRadius, minRadius + 20);
      let x2 = x1 + pg.cos(angle) * pg.random(maxLength * 0.5, maxLength); let y2 = y1 + pg.sin(angle) * pg.random(maxLength * 0.5, maxLength);
      pg.line(x1, y1, x2, y2);
    }
  }
}
function drawNoisyContours(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let rot = pg.map(energy, 0, 255, 0, pg.PI / 2) + time * 0.2 * (params.angleSpeed || 1.0); pg.rotate(rot);
  let noiseFactor = pg.map(energy, 0, 255, 10, 120) * (params.intensityGain || 1.0);
  let baseRadius = pg.map(energy, 0, 255, 40, 260) * (params.intensityGain || 1.0);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let layerCount = 2 + pg.floor(pg.map(energy, params.threshold, 255, 1, 4));
  for (let j = 0; j < layerCount; j++) {
    pg.beginShape();
    let angleOffset = time * 0.5 + j * 0.5;
    for (let i = 0; i < pg.TWO_PI; i += pg.random(0.08, 0.15)) {
      let r = baseRadius + (pg.noise(i * 5 + angleOffset) - 0.5) * noiseFactor + j * 3;
      let x = r * pg.cos(i); let y = r * pg.sin(i);
      pg.vertex(x, y);
    }
    pg.endShape(pg.CLOSE);
  }
}
function drawFloatingDots(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let count = pg.floor(pg.map(energy, params.threshold, 255, 1, 100));
  let detail = pg.floor(pg.map(energy, 0, 255, 1, 4));
  let rot = pg.map(energy, 0, 255, 0, pg.PI * 2) * 0.3; pg.rotate(rot);
  for (let d = 0; d < detail; d++) {
    for (let i = 0; i < count; i++) {
      let angle = pg.random(pg.TWO_PI);
      let radius = pg.random(200, 350) + pg.random(-30, 30);
      if (params.intensityGain) radius *= params.intensityGain;
      let x = radius * pg.cos(angle);
      let y = radius * pg.sin(angle);
      pg.point(x, y);
    }
  }
}