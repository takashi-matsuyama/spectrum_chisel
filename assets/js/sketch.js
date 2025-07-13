// --- Canvas Size Constant ---
const CANVAS_SIZE = 800;
let fft, mic;

// --- Spectrum History for SVG Export ---
let spectrumHistory = [];

// --- UI Elements (Global Scope) ---
let uiPanel, frameRateSlider;
let spectrumRingCheckbox, spectrumDiffCheckbox, spectrumDiffColorPicker;
let prevSpectrum = [];
let uiVisible = true;

// Declare all UI component variables globally
let lowDrawSelector, lowGainSlider, lowThresholdSlider, lowIntensityGainSlider, lowAngleSpeedSlider,
  lowColorPicker, lowStrokeSlider, lowAlphaSlider, lowEnabledCheckbox;
let midDrawSelector, midGainSlider, midThresholdSlider, midIntensityGainSlider, midAngleSpeedSlider,
  midColorPicker, midStrokeSlider, midAlphaSlider, midEnabledCheckbox;
let highDrawSelector, highGainSlider, highThresholdSlider, highIntensityGainSlider, highAngleSpeedSlider,
  highColorPicker, highStrokeSlider, highAlphaSlider, highEnabledCheckbox;
let subBassDrawSelector, subBassGainSlider, subBassThresholdSlider, subBassIntensityGainSlider, subBassAngleSpeedSlider,
  subBassColorPicker, subBassStrokeSlider, subBassAlphaSlider, subBassEnabledCheckbox;
let lowMidDrawSelector, lowMidGainSlider, lowMidThresholdSlider, lowMidIntensityGainSlider, lowMidAngleSpeedSlider,
  lowMidColorPicker, lowMidStrokeSlider, lowMidAlphaSlider, lowMidEnabledCheckbox;
let upperMidDrawSelector, upperMidGainSlider, upperMidThresholdSlider, upperMidIntensityGainSlider, upperMidAngleSpeedSlider,
  upperMidColorPicker, upperMidStrokeSlider, upperMidAlphaSlider, upperMidEnabledCheckbox;
let presenceDrawSelector, presenceGainSlider, presenceThresholdSlider, presenceIntensityGainSlider, presenceAngleSpeedSlider,
  presenceColorPicker, presenceStrokeSlider, presenceAlphaSlider, presenceEnabledCheckbox;
let brillianceDrawSelector, brillianceGainSlider, brillianceThresholdSlider, brillianceIntensityGainSlider, brillianceAngleSpeedSlider,
  brillianceColorPicker, brillianceStrokeSlider, brillianceAlphaSlider, brillianceEnabledCheckbox;

// Drawing function map from your original code
const drawFunctionMap = {
  drawSmoothEllipse: { func: drawSmoothEllipse, defaultWeight: 0.4 },
  drawRotatingWaves: { func: drawRotatingWaves, defaultWeight: 1.5 },
  drawRadialLines: { func: drawRadialLines, defaultWeight: 1.2 },
  drawExpandingDots: { func: drawExpandingDots, defaultWeight: 0.8 },
  drawRadiantBeams: { func: drawRadiantBeams, defaultWeight: 2.0 },
  drawSparks: { func: drawSparks, defaultWeight: 1.8 },
  drawNoisyContours: { func: drawNoisyContours, defaultWeight: 0.6 },
  drawFloatingDots: { func: drawFloatingDots, defaultWeight: 1.0 }
};

// =============================================================================
// p5.js Lifecycle Functions
// =============================================================================

function setup() {
  // ★ 修正点 1: メインのCanvasをビットマップモードで作成し、SVGモードは削除
  let myCanvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  myCanvas.parent('canvas-container');
  colorMode(HSB, 360, 100, 100);

  // 描画が蓄積されるように、background()はsetup()で一度だけ呼び出す
  background(0);

  fft = new p5.FFT(0.9, 512);
  initMic();
  createUI(); // あなたのUIセットアップコードをそのまま呼び出し
}

function draw() {
  if (!mic || !mic.enabled) {
    // マイクが有効でない場合は、待機メッセージなどを表示しても良い
    return;
  }

  frameRate(frameRateSlider.value());

  // ★ 修正点 2: メインのCanvas(this)に対して描画ロジックを実行
  drawVisuals(this, frameCount);
}

// =============================================================================
// Core Drawing and Event Handling
// =============================================================================

/**
 * 描画ロジック本体。
 * p5.jsのメインCanvas、またはSVGバッファのどちらに対しても描画できるように、
 * 描画対象のコンテキスト（pg）を引数に取る。
 */
function drawVisuals(pg, currentFrame) {
  let spectrum = fft.analyze();

  // ★ 修正点 3: リアルタイム描画の場合のみ、SVG書き出し用の「設計図」を記録
  if (pg === this) { // `this`はメインのp5インスタンス（=メインCanvas）を指す
    spectrumHistory.push(spectrum.slice());
  }

  let totalEnergy = spectrum.reduce((a, b) => a + b, 0);
  if (totalEnergy < 100) { // マイク入力用の閾値
    prevSpectrum = spectrum.slice();
    return;
  }

  // あなたの描画ロジックをそのまま実行
  pg.push();
  pg.translate(pg.width / 2, pg.height / 2);

  const time = currentFrame * 0.005;

  // 各周波数帯の描画（あなたのコードをそのまま流用）
  const bandsToDraw = [
    { name: 'subBass', energy: fft.getEnergy(20, 60), enabled: subBassEnabledCheckbox.checked() },
    { name: 'low', energy: fft.getEnergy("bass"), enabled: lowEnabledCheckbox.checked() },
    { name: 'lowMid', energy: fft.getEnergy(140, 400), enabled: lowMidEnabledCheckbox.checked() },
    { name: 'mid', energy: fft.getEnergy("mid"), enabled: midEnabledCheckbox.checked() },
    { name: 'upperMid', energy: fft.getEnergy(1000, 3000), enabled: upperMidEnabledCheckbox.checked() },
    { name: 'presence', energy: fft.getEnergy(3000, 6000), enabled: presenceEnabledCheckbox.checked() },
    { name: 'brilliance', energy: fft.getEnergy(6000, 16000), enabled: brillianceEnabledCheckbox.checked() },
    { name: 'high', energy: fft.getEnergy("treble"), enabled: highEnabledCheckbox.checked() }
  ];

  bandsToDraw.forEach(band => {
    if (band.enabled) {
      const ui = {
        color: eval(`${band.name}ColorPicker.color()`),
        weight: eval(`${band.name}StrokeSlider.value()`),
        alpha: eval(`${band.name}AlphaSlider.value()`),
        gain: eval(`${band.name}GainSlider.value()`),
        threshold: eval(`${band.name}ThresholdSlider.value()`),
        intensityGain: eval(`${band.name}IntensityGainSlider.value()`),
        angleSpeed: eval(`${band.name}AngleSpeedSlider.value()`),
        drawFunc: eval(`${band.name}DrawSelector.value()`)
      };

      let scaledEnergy = pg.constrain(band.energy * ui.gain, 0, 255);
      if (scaledEnergy > ui.threshold) {
        pg.push();

        // あなたのオフセット計算ロジック
        let intensity = pg.map(band.energy, 0, 255, 0, 1);
        let angle = currentFrame * 0.02;
        let dx = pg.sin(angle + time) * 10 * intensity;
        let dy = pg.cos(angle + time * 1.5) * 10 * intensity;
        pg.translate(dx, dy);

        const style = { color: ui.color, weight: ui.weight, alpha: ui.alpha };
        const params = { intensityGain: ui.intensityGain, angleSpeed: ui.angleSpeed };
        const func = drawFunctionMap[ui.drawFunc].func;
        // .call(pg, ...) で描画コンテキストを正しく設定
        func.call(pg, scaledEnergy, currentFrame, time, style, params);
        pg.pop();
      }
    }
  });

  // --- Spectrum Ring & Diff Layers ---
  if (spectrumRingCheckbox.checked()) {
    drawSpectrumRingByBands(pg, spectrum, currentFrame);
  }
  if (spectrumDiffCheckbox.checked()) {
    drawSpectrumDiff(pg, spectrum, prevSpectrum);
  }

  pg.pop();
  prevSpectrum = spectrum.slice();
}


/**
 * SVG書き出し処理
 */
function downloadSVG() {
  console.log("Starting SVG export...");
  noLoop(); // 安全のためにアニメーションを一時停止

  // SVG描画用のオフスクリーンバッファを一時的に作成
  const svg = createGraphics(CANVAS_SIZE, CANVAS_SIZE, SVG);

  // SVGバッファに初期設定を適用
  svg.colorMode(HSB, 360, 100, 100);
  svg.background(0); // SVGの背景を黒に

  // ★ 修正点 4: 蓄積された履歴を元にSVGに再描画
  // NOTE: この方法なら、fft.analyze()をハックする必要がなくなります。
  let tempPrevSpectrum = [];
  for (let i = 0; i < spectrumHistory.length; i++) {
    const spectrum = spectrumHistory[i];

    // drawVisualsForSVG という専用関数を用意し、fftから値を取らないようにする
    drawVisualsForSVG(svg, spectrum, tempPrevSpectrum, i + 1);

    tempPrevSpectrum = spectrum.slice();
  }

  save(svg, 'sound_visualization.svg');
  console.log("SVG export complete.");
  svg.remove(); // メモリを解放
  loop(); // アニメーションを再開
}

/**
 * SVG書き出し専用の描画関数
 * fft.getEnergy を使わず、引数のspectrumから直接エネルギーを計算する
 */
function drawVisualsForSVG(pg, spectrum, prevSpectrum, currentFrame) {
  pg.push();
  pg.translate(pg.width / 2, pg.height / 2);

  const time = currentFrame * 0.005;

  // エネルギー計算用のヘルパー関数
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
    { name: 'subBass', energy: getEnergyFromSpectrum(20, 60), enabled: subBassEnabledCheckbox.checked() },
    { name: 'low', energy: getEnergyFromSpectrum(60, 250), enabled: lowEnabledCheckbox.checked() }, // "bass"の代替
    { name: 'lowMid', energy: getEnergyFromSpectrum(250, 500), enabled: lowMidEnabledCheckbox.checked() },
    { name: 'mid', energy: getEnergyFromSpectrum(500, 2000), enabled: midEnabledCheckbox.checked() }, // "mid"の代替
    { name: 'upperMid', energy: getEnergyFromSpectrum(2000, 4000), enabled: upperMidEnabledCheckbox.checked() },
    { name: 'presence', energy: getEnergyFromSpectrum(4000, 6000), enabled: presenceEnabledCheckbox.checked() },
    { name: 'brilliance', energy: getEnergyFromSpectrum(6000, 10000), enabled: brillianceEnabledCheckbox.checked() },
    { name: 'high', energy: getEnergyFromSpectrum(10000, 20000), enabled: highEnabledCheckbox.checked() } // "treble"の代替
  ];

  // UI設定を取得する部分は drawVisuals と共通
  bandsToDraw.forEach(band => {
    if (band.enabled) {
      const ui = {
        color: eval(`${band.name}ColorPicker.color()`),
        weight: eval(`${band.name}StrokeSlider.value()`),
        alpha: eval(`${band.name}AlphaSlider.value()`),
        gain: eval(`${band.name}GainSlider.value()`),
        threshold: eval(`${band.name}ThresholdSlider.value()`),
        intensityGain: eval(`${band.name}IntensityGainSlider.value()`),
        angleSpeed: eval(`${band.name}AngleSpeedSlider.value()`),
        drawFunc: eval(`${band.name}DrawSelector.value()`)
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
        func.call(pg, scaledEnergy, currentFrame, time, style, params);
        pg.pop();
      }
    }
  });

  if (spectrumRingCheckbox.checked()) {
    drawSpectrumRingByBands(pg, spectrum, currentFrame);
  }
  if (spectrumDiffCheckbox.checked()) {
    drawSpectrumDiff(pg, spectrum, prevSpectrum);
  }

  pg.pop();
}


/**
 * キー入力のハンドリング
 */
function keyPressed() {
  if (key === 's' || key === 'S') downloadSVG();
  if (key === 'p' || key === 'P') saveCanvas("sound_visualization.png");
  if (key === 'c' || key === 'C') {
    uiVisible = !uiVisible;
    uiPanel.style('display', uiVisible ? 'block' : 'none');
  }
  if (key === 'e' || key === 'E') {
    background(0);
    spectrumHistory = []; // 履歴もリセット
  }
}

// =============================================================================
// Initialization and Helper Functions (Your original code, unchanged)
// =============================================================================
// ここに、あなたの元の `initMic`, `createUI`, `generateDistinctColors`, 
// そして全ての `draw...` 関数（drawSmoothEllipseなど）をペーストしてください。
// 変更は不要です。
// =============================================================================
function initMic() {
  mic = new p5.AudioIn();
  mic.start(() => {
    // fftのsetInputはmic.startのコールバック内で呼ぶのが確実
    fft.setInput(mic);
    console.log("FFT input set to mic.");
  }, (err) => {
    console.error("Mic error:", err);
  });
}

function createUI() {
  // --- UIパネルの初期化 ---
  uiPanel = createDiv();
  uiPanel.addClass('ui-panel');
  uiPanel.position(10, 10);
  uiPanel.style('color', 'white');
  uiPanel.style('background', 'rgba(0, 0, 0, 0.6)');
  uiPanel.style('padding', '10px');
  uiPanel.style('border-radius', '8px');
  uiPanel.style('max-width', '90vw');
  uiPanel.style('overflow-y', 'auto');
  uiPanel.style('max-height', '90vh');

  // ランダム色を取得
  let randomColors = generateDistinctColors(8);

  // --- General Controls ---
  createDiv('Controls').parent(uiPanel).addClass('ui-section-title');
  const saveButton = createButton('Save SVG (S)').parent(uiPanel);
  saveButton.mousePressed(downloadSVG);
  const clearButton = createButton('Clear Canvas (E)').parent(uiPanel);
  clearButton.mousePressed(() => keyPressed({ key: 'e' }));
  const toggleUiButton = createButton('Toggle UI (C)').parent(uiPanel);
  toggleUiButton.mousePressed(() => keyPressed({ key: 'c' }));

  createDiv('Frame Rate').parent(uiPanel).addClass('ui-section-title');
  frameRateSlider = createSlider(1, 60, 15, 1).parent(uiPanel);
  const frameRateValueSpan = createSpan(frameRateSlider.value()).parent(frameRateSlider.parent()).style('color', 'white');
  frameRateSlider.input(() => frameRateValueSpan.html(frameRateSlider.value()));

  // --- Spectrum Layers ---
  createDiv('Spectrum Layers').parent(uiPanel).addClass('ui-section-title');
  spectrumRingCheckbox = createCheckbox('Draw Spectrum Ring', true).parent(uiPanel).style('color', 'white');
  spectrumDiffCheckbox = createCheckbox('Draw Spectrum Diff', true).parent(uiPanel).style('color', 'white');
  spectrumDiffColorPicker = createColorPicker('#ffffff').parent(uiPanel);

  // --- Per-band UI setup ---
  const energyBandUIs = [
    { name: "subBass", defFunc: "drawExpandingDots", color: randomColors[3] },
    { name: "low", defFunc: "drawSmoothEllipse", color: randomColors[0] },
    { name: "lowMid", defFunc: "drawNoisyContours", color: randomColors[6] },
    { name: "mid", defFunc: "drawRotatingWaves", color: randomColors[1] },
    { name: "upperMid", defFunc: "drawFloatingDots", color: randomColors[7] },
    { name: "presence", defFunc: "drawSparks", color: randomColors[5] },
    { name: "brilliance", defFunc: "drawRadiantBeams", color: randomColors[4] },
    { name: "high", defFunc: "drawRadialLines", color: randomColors[2] }
  ];

  const energySettings = { low: { gain: 2.5, threshold: 20 }, mid: { gain: 1.5, threshold: 25 }, high: { gain: 2.2, threshold: 30 }, subBass: { gain: 2.8, threshold: 20 }, lowMid: { gain: 1.8, threshold: 25 }, upperMid: { gain: 2.0, threshold: 30 }, presence: { gain: 2.3, threshold: 25 }, brilliance: { gain: 2.4, threshold: 30 } };

  energyBandUIs.forEach(band => {
    let name = band.name;
    let title = name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1');
    const section = createDiv(title).parent(uiPanel).addClass('ui-section-title');

    const createSliderWithLabel = (label, min, max, initial, step) => {
      let container = createDiv(label + ': ').parent(section);
      let slider = createSlider(min, max, initial, step).parent(container).addClass('ui-slider');
      let valueSpan = createSpan(initial).parent(container).style('margin-left', '5px');
      slider.input(() => valueSpan.html(slider.value()));
      return slider;
    };

    eval(`${name}EnabledCheckbox = createCheckbox('Enabled', true).parent(section)`);
    eval(`${name}ColorPicker = createColorPicker(band.color).parent(section)`);
    eval(`${name}DrawSelector = createSelect().parent(section)`);
    for (let key in drawFunctionMap) eval(`${name}DrawSelector.option(key)`);
    eval(`${name}DrawSelector.selected(band.defFunc)`);

    const defaultWeight = drawFunctionMap[band.defFunc].defaultWeight;
    eval(`${name}StrokeSlider = createSliderWithLabel('Stroke', 0.1, 5, defaultWeight, 0.1)`);
    eval(`${name}AlphaSlider = createSliderWithLabel('Alpha', 0, 255, 20, 1)`);
    eval(`${name}GainSlider = createSliderWithLabel('Gain', 0.1, 5.0, energySettings[name].gain, 0.01)`);
    eval(`${name}ThresholdSlider = createSliderWithLabel('Threshold', 0, 255, energySettings[name].threshold, 1)`);
    eval(`${name}IntensityGainSlider = createSliderWithLabel('IntensityGain', 0.0, 5.0, 1.0, 0.01)`);
    eval(`${name}AngleSpeedSlider = createSliderWithLabel('AngleSpeed', 0.0, 5.0, 1.0, 0.01)`);

    eval(`${name}DrawSelector`).changed(() => {
      const selectedKey = eval(`${name}DrawSelector.value()`);
      const newWeight = drawFunctionMap[selectedKey].defaultWeight;
      eval(`${name}StrokeSlider.value(newWeight)`);
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

// --- Drawing Functions ---
function drawSpectrumRingByBands(pg, spectrum, frameCount) {
  pg.noFill();
  let totalBands = spectrum.length;
  const bands = [
    { name: "subBass", fromHz: 20, toHz: 60, color: subBassColorPicker.color() }, { name: "low", fromHz: 60, toHz: 140, color: lowColorPicker.color() }, { name: "lowMid", fromHz: 140, toHz: 400, color: lowMidColorPicker.color() }, { name: "mid", fromHz: 400, toHz: 1000, color: midColorPicker.color() }, { name: "upperMid", fromHz: 1000, toHz: 3000, color: upperMidColorPicker.color() }, { name: "presence", fromHz: 3000, toHz: 6000, color: presenceColorPicker.color() }, { name: "brilliance", fromHz: 6000, toHz: 16000, color: brillianceColorPicker.color() }, { name: "high", fromHz: 16000, toHz: 22050, color: highColorPicker.color() }
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
function drawSmoothEllipse(energy, frameCount, time, style, params) {
  let pg = this; let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
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
function drawRotatingWaves(energy, frameCount, time, style, params) {
  let pg = this; let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight);
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
function drawRadialLines(energy, frameCount, time, style, params) {
  let pg = this; let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
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
function drawExpandingDots(energy, frameCount, time, style, params) {
  let pg = this; let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
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
function drawRadiantBeams(energy, frameCount, time, style, params) {
  let pg = this; let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
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
function drawSparks(energy, frameCount, time, style, params) {
  let pg = this; let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let rot = pg.map(energy, 0, 255, 0, pg.PI / 2) + frameCount * 0.1 * (params.angleSpeed || 1.0); pg.rotate(rot);
  let sparkCount = pg.floor(pg.map(energy, 0, 255, 3, 20));
  let maxLength = pg.map(energy, 0, 255, 20, 120) * (params.intensityGain || 1.0);
  let detail = pg.floor(pg.map(energy, 0, 255, 1, 4));
  let minRadius = 20;
  for (let d = 0; d < detail; d++) {
    for (let i = 0; i < sparkCount; i++) {
      let angle = (pg.TWO_PI / sparkCount) * i + frameCount * 0.1 + d * 0.13;
      let x1 = pg.cos(angle) * pg.random(minRadius, minRadius + 30); let y1 = pg.sin(angle) * pg.random(minRadius, minRadius + 30);
      let x2 = x1 + pg.cos(angle) * pg.random(maxLength * 0.5, maxLength); let y2 = y1 + pg.sin(angle) * pg.random(maxLength * 0.5, maxLength);
      pg.line(x1, y1, x2, y2);
    }
  }
}
function drawNoisyContours(energy, frameCount, time, style, params) {
  let pg = this; let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
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
function drawFloatingDots(energy, frameCount, time, style, params) {
  let pg = this; let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight);
  let count = pg.floor(pg.map(energy, 0, 255, 10, 100));
  let detail = pg.floor(pg.map(energy, 0, 255, 1, 4));
  let rot = pg.map(energy, 0, 255, 0, pg.PI * 2) * 0.3; pg.rotate(rot);
  for (let d = 0; d < detail; d++) {
    for (let i = 0; i < count; i++) {
      let angle = pg.random(pg.TWO_PI);
      let radius = pg.random(200, 350) + pg.random(-30, 30) * (params.intensityGain || 1.0);
      let x = radius * pg.cos(angle); let y = pg.sin(angle) * sin(angle); // Typo corrected: sin(angle)
      pg.point(x, y);
    }
  }
}