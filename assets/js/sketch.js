// --- Canvas Size Constant ---
const CANVAS_SIZE = 800;
let fft;

// ★ Phase 1 変更点: 音源管理用の変数を追加
let mic, soundFile;
let currentInputMode = 'mic'; // 'mic' or 'file'
let isPlaying = false; // 再生状態を管理

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

// =============================================================================
// p5.js Lifecycle Functions
// =============================================================================

function setup() {
  let myCanvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  myCanvas.parent('canvas-container');
  colorMode(HSB, 360, 100, 100);
  background(0);

  fft = new p5.FFT(0.9, 512);

  // ★ Phase 1 変更点: UI初期化と音源初期化
  initMic();
  setupSoundControls(); // 新しい音源コントロールUIのセットアップ
  createUI(); // 既存のUIセットアップ
}

function draw() {
  // ★ Phase 1 変更点: isPlayingがfalseの時は描画を止める
  if (!isPlaying) return;

  frameRate(frameRateSlider.value());
  drawVisuals(this, frameCount);
}

// =============================================================================
// Core Drawing and Event Handling
// =============================================================================

function drawVisuals(pg, currentFrame, isForSVG = false) {
  let spectrum;

  if (isForSVG) {
    spectrum = spectrumHistory[currentFrame - 1];
  } else {
    spectrum = fft.analyze();
    spectrumHistory.push(spectrum.slice());
  }

  if (!spectrum) return;

  let totalEnergy = spectrum.reduce((a, b) => a + b, 0);
  if (totalEnergy < 100) {
    if (!isForSVG) prevSpectrum = spectrum.slice();
    return;
  }

  pg.push();
  pg.translate(pg.width / 2, pg.height / 2);

  const time = currentFrame * 0.005;

  const getEnergyFromSpectrum = (freq1, freq2) => {
    const nyquist = 22050;
    const startIndex = Math.floor(map(freq1, 0, nyquist, 0, spectrum.length));
    const endIndex = Math.ceil(map(freq2, 0, nyquist, 0, spectrum.length));
    let sum = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      sum += spectrum[i];
    }
    return sum / (endIndex - startIndex + 1);
  };

  const bandsToDraw = [
    { name: 'subBass', energy: getEnergyFromSpectrum(20, 60) },
    { name: 'low', energy: getEnergyFromSpectrum(60, 250) },
    { name: 'lowMid', energy: getEnergyFromSpectrum(250, 500) },
    { name: 'mid', energy: getEnergyFromSpectrum(500, 2000) },
    { name: 'upperMid', energy: getEnergyFromSpectrum(2000, 4000) },
    { name: 'presence', energy: getEnergyFromSpectrum(4000, 6000) },
    { name: 'brilliance', energy: getEnergyFromSpectrum(6000, 16000) },
    { name: 'high', energy: getEnergyFromSpectrum(16000, 20000) }
  ];

  bandsToDraw.forEach(band => {
    const components = uiComponents[band.name];
    // ★★★ 修正点2: チェックを1つに統合 ★★★
    if (components && components.enabledCheckbox.checked()) {
      const ui = {
        color: components.colorPicker.color(),
        weight: components.strokeSlider.value(),
        alpha: components.alphaSlider.value(),
        gain: components.gainSlider.value(),
        threshold: components.thresholdSlider.value(),
        intensityGain: components.intensityGainSlider.value(),
        angleSpeed: components.angleSpeedSlider.value(),
        drawFunc: components.drawSelector.value()
      };

      let scaledEnergy = pg.constrain(band.energy * ui.gain, 0, 255);
      if (scaledEnergy > ui.threshold) {
        pg.push();

        let intensity = pg.map(band.energy, 0, 255, 0, 1);
        let angle = currentFrame * 0.02;
        let dx = pg.sin(angle + time) * 10 * intensity;
        let dy = pg.cos(angle + time * 1.5) * 10 * intensity;
        pg.translate(dx, dy);

        const style = { color: ui.color, weight: ui.weight, alpha: ui.alpha };
        const params = { intensityGain: ui.intensityGain, angleSpeed: ui.angleSpeed };
        const func = drawFunctionMap[ui.drawFunc].func;
        func(pg, scaledEnergy, currentFrame, time, style, params);
        pg.pop();
      }
    }
  });

  if (spectrumRingCheckbox.checked()) {
    drawSpectrumRingByBands(pg, spectrum, currentFrame);
  }
  if (spectrumDiffCheckbox.checked()) {
    const prevSpecForDiff = isForSVG ? (spectrumHistory[currentFrame - 2] || []) : prevSpectrum;
    drawSpectrumDiff(pg, spectrum, prevSpecForDiff);
  }

  pg.pop();

  if (!isForSVG) prevSpectrum = spectrum.slice();
}


function downloadSVG() {
  console.log("Starting SVG export...");
  noLoop();

  const svg = createGraphics(CANVAS_SIZE, CANVAS_SIZE, SVG);
  svg.colorMode(HSB, 360, 100, 100);
  svg.background(0);

  for (let i = 0; i < spectrumHistory.length; i++) {
    drawVisuals(svg, i + 1, true);
  }

  save(svg, 'sound_visualization.svg');
  console.log("SVG export complete.");
  svg.remove();
  loop();
}

function toggleUIVisibility() {
  uiVisible = !uiVisible;
  uiPanel.style('display', uiVisible ? 'block' : 'none');
  select('#sound-controls').style('display', uiVisible ? 'flex' : 'none');
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    downloadSVG();
  }
  if (key === 'p' || key === 'P') {
    saveCanvas("sound_visualization.png");
  }
  if (key === 'c' || key === 'C') {
    toggleUIVisibility();
  }
  if (key === 'e' || key === 'E') {
    stopAndReset();
  }
}

// =============================================================================
// ★ Phase 1 変更点: Sound Control Functions
// =============================================================================

function setupSoundControls() {
  const micBtn = select('#mic-mode-btn');
  const fileBtn = select('#file-mode-btn');
  const uploadInput = select('#upload-sound');
  const playPauseBtn = select('#play-pause-btn');
  const stopBtn = select('#stop-btn');

  micBtn.mousePressed(() => switchInputMode('mic'));
  fileBtn.mousePressed(() => uploadInput.elt.click()); // ファイル選択ダイアログを開く

  uploadInput.changed(handleSoundFile);
  playPauseBtn.mousePressed(togglePlayPause);
  stopBtn.mousePressed(stopAndReset);
}

function switchInputMode(mode) {
  if (isPlaying) stopAndReset(); // モード切替時はリセット

  currentInputMode = mode;
  const micBtn = select('#mic-mode-btn');
  const fileBtn = select('#file-mode-btn');

  if (mode === 'mic') {
    micBtn.addClass('active');
    fileBtn.removeClass('active');
    fft.setInput(mic);
    console.log("Input mode: Mic");
  } else if (mode === 'file' && soundFile) {
    micBtn.removeClass('active');
    fileBtn.addClass('active');
    fft.setInput(soundFile);
    console.log("Input mode: File");
  }
}

function handleSoundFile(event) {
  if (event.target.files[0]) {
    if (soundFile && soundFile.isPlaying()) {
      soundFile.stop();
    }
    soundFile = loadSound(event.target.files[0], () => {
      console.log("Sound file loaded.");
      switchInputMode('file');
      togglePlayPause(); // ロードされたら自動再生
    });
  }
}


function togglePlayPause() {
  // ★★★ 修正点: 音声エンジンが一時停止していたら再開させる ★★★
  if (getAudioContext().state !== 'running') {
    userStartAudio();
  }
  // ★★★ ここまで ★★★

  isPlaying = !isPlaying;
  const playPauseBtn = select('#play-pause-btn');

  if (isPlaying) {
    if (currentInputMode === 'mic') {
      mic.start();
    } else if (soundFile) {
      soundFile.loop(); // ファイルの場合はループ再生
    }
    loop(); // p5.jsの描画ループを開始
    playPauseBtn.html('一時停止');
  } else {
    if (currentInputMode === 'mic') {
      mic.stop();
    } else if (soundFile) {
      soundFile.pause();
    }
    noLoop(); // p5.jsの描画ループを停止
    playPauseBtn.html('再生');
  }
}

function stopAndReset() {
  if (isPlaying) {
    // isPlaying = false と playPauseBtn.html('再生') は togglePlayPause 内で処理される
    togglePlayPause();
  }

  // 状態を完全に初期に戻す
  isPlaying = false;
  select('#play-pause-btn').html('再生');

  if (soundFile) {
    soundFile.stop();
  }
  if (mic.started) {
    mic.stop();
  }

  // キャンバスと履歴をリセット
  background(0);
  spectrumHistory = [];
  prevSpectrum = [];
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
  uiPanel.style('max-width', '90vw');
  uiPanel.style('overflow-y', 'auto');
  uiPanel.style('max-height', '90vh');

  let randomColors = generateDistinctColors(8);

  createDiv('Controls').parent(uiPanel).addClass('ui-section-title');
  const saveButton = createButton('Save SVG (S)').parent(uiPanel);
  saveButton.mousePressed(downloadSVG);
  const pngButton = createButton('Save PNG (P)').parent(uiPanel);
  pngButton.mousePressed(() => saveCanvas("sound_visualization.png"));
  const clearButton = createButton('Clear Canvas (E)').parent(uiPanel);
  clearButton.mousePressed(stopAndReset);
  const toggleUiButton = createButton('Toggle UI (C)').parent(uiPanel);
  toggleUiButton.mousePressed(toggleUIVisibility);

  createDiv('Frame Rate').parent(uiPanel).addClass('ui-section-title');
  frameRateSlider = createSlider(1, 60, 15, 1).parent(uiPanel);
  const frameRateValueSpan = createSpan(frameRateSlider.value()).parent(frameRateSlider.parent()).style('color', 'white');
  frameRateSlider.input(() => frameRateValueSpan.html(frameRateSlider.value()));

  const spectrumDiv = createDiv('Spectrum Layers').parent(uiPanel).addClass('ui-section-title');
  spectrumRingCheckbox = createCheckbox('Draw Spectrum Ring', true).parent(spectrumDiv).style('color', 'white');
  spectrumDiffCheckbox = createCheckbox('Draw Spectrum Diff', true).parent(spectrumDiv).style('color', 'white');
  spectrumDiffColorPicker = createColorPicker('#ffffff').parent(spectrumDiv);

  const energySettings = { low: { gain: 2.5, threshold: 20 }, mid: { gain: 1.5, threshold: 25 }, high: { gain: 2.2, threshold: 30 }, subBass: { gain: 2.8, threshold: 20 }, lowMid: { gain: 1.8, threshold: 25 }, upperMid: { gain: 2.0, threshold: 30 }, presence: { gain: 2.3, threshold: 25 }, brilliance: { gain: 2.4, threshold: 30 } };
  const energyBandUIs = [
    { name: "subBass", defFunc: "drawExpandingDots", color: randomColors[3] }, { name: "low", defFunc: "drawSmoothEllipse", color: randomColors[0] }, { name: "lowMid", defFunc: "drawNoisyContours", color: randomColors[6] }, { name: "mid", defFunc: "drawRotatingWaves", color: randomColors[1] }, { name: "upperMid", defFunc: "drawFloatingDots", color: randomColors[7] }, { name: "presence", defFunc: "drawSparks", color: randomColors[5] }, { name: "brilliance", defFunc: "drawRadiantBeams", color: randomColors[4] }, { name: "high", defFunc: "drawRadialLines", color: randomColors[2] }
  ];

  energyBandUIs.forEach(band => {
    let name = band.name;
    let title = name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1');
    const section = createDiv(title).parent(uiPanel).addClass('ui-section-title');

    // ★★★ evalを使わず、オブジェクトにUI要素を格納する ★★★
    uiComponents[name] = {}; // 各バンドのオブジェクトを初期化

    const createSliderWithLabel = (label, min, max, initial, step) => {
      let container = createDiv(label + ': ').parent(section);
      let slider = createSlider(min, max, initial, step).parent(container).addClass('ui-slider');
      let valueSpan = createSpan(initial).parent(container).style('margin-left', '5px');
      slider.input(() => valueSpan.html(slider.value()));
      return slider;
    };

    uiComponents[name].enabledCheckbox = createCheckbox('Enabled', true).parent(section);
    uiComponents[name].colorPicker = createColorPicker(band.color).parent(section);

    const drawSelector = createSelect().parent(section);
    for (let key in drawFunctionMap) {
      drawSelector.option(key);
    }
    drawSelector.selected(band.defFunc);
    uiComponents[name].drawSelector = drawSelector;

    const defaultWeight = drawFunctionMap[band.defFunc].defaultWeight;
    uiComponents[name].strokeSlider = createSliderWithLabel('Stroke', 0.1, 5, defaultWeight, 0.1);
    uiComponents[name].alphaSlider = createSliderWithLabel('Alpha', 0, 255, 20, 1);
    uiComponents[name].gainSlider = createSliderWithLabel('Gain', 0.1, 5.0, energySettings[name].gain, 0.01);
    uiComponents[name].thresholdSlider = createSliderWithLabel('Threshold', 0, 255, energySettings[name].threshold, 1);
    uiComponents[name].intensityGainSlider = createSliderWithLabel('IntensityGain', 0.0, 5.0, 1.0, 0.01);
    uiComponents[name].angleSpeedSlider = createSliderWithLabel('AngleSpeed', 0.0, 5.0, 1.0, 0.01);

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

function drawSpectrumRingByBands(pg, spectrum, frameCount) {
  pg.noFill();
  let totalBands = spectrum.length;

  // ★★★ uiComponents オブジェクトから色を取得するように変更 ★★★
  const bands = [
    { fromHz: 20, toHz: 60, color: uiComponents.subBass.colorPicker.color() },
    { fromHz: 60, toHz: 140, color: uiComponents.low.colorPicker.color() },
    { fromHz: 140, toHz: 400, color: uiComponents.lowMid.colorPicker.color() },
    { fromHz: 400, toHz: 1000, color: uiComponents.mid.colorPicker.color() },
    { fromHz: 1000, toHz: 3000, color: uiComponents.upperMid.colorPicker.color() },
    { fromHz: 3000, toHz: 6000, color: uiComponents.presence.colorPicker.color() },
    { fromHz: 6000, toHz: 16000, color: uiComponents.brilliance.colorPicker.color() },
    { fromHz: 16000, toHz: 22050, color: uiComponents.high.colorPicker.color() }
  ];

  for (let band of bands) {
    let startIndex = floor(pg.map(band.fromHz, 0, 22050, 0, totalBands));
    let endIndex = floor(pg.map(band.toHz, 0, 22050, 0, totalBands));
    pg.stroke(band.color); pg.strokeWeight(1); pg.beginShape();
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
  }
}
function drawSpectrumDiff(pg, current, previous) {
  if (!previous || previous.length === 0) return;
  let diffColor = spectrumDiffColorPicker ? spectrumDiffColorPicker.color() : pg.color(255);
  diffColor.setAlpha(180); pg.noFill();
  for (let i = 0; i < current.length; i++) {
    let diff = Math.abs(current[i] - (previous[i] || 0));
    if (diff > 10) {
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
  let detail = 2 + pg.floor(pg.map(energy, 0, 255, 1, 4));
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
  let detail = pg.floor(pg.map(energy, 0, 255, 3, 14)); pg.noFill(); pg.beginShape();
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
  let detail = pg.floor(pg.map(energy, 0, 255, 2, 12));
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
  let ringCount = 1 + pg.floor(pg.map(energy, 0, 255, 1, 6));
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
  let rays = 6 + pg.floor(pg.map(energy, 0, 255, 2, 20));
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
  let sparkCount = pg.floor(pg.map(energy, 0, 255, 3, 20));
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
  let layerCount = 2 + pg.floor(pg.map(energy, 0, 255, 1, 4));
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
  let count = pg.floor(pg.map(energy, 0, 255, 10, 100));
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