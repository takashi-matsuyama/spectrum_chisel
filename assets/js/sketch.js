// --- Canvas Size Constant ---
const CANVAS_SIZE = 800;
let fft,
  mic;

// --- Spectrum Diff Color Picker ---
let spectrumDiffColorPicker;

// --- Spectrum Ring/Diffグローバル変数 ---
let prevSpectrum = [];
let spectrumHistory = [];
let spectrumRingCheckbox;
let spectrumDiffCheckbox;

// --- UI要素のグローバル変数宣言 ---

let frameRateSlider;

// 各音域ごとのエネルギー補正設定
const energySettings = {
  low: {
    gain: 2.5,
    threshold: 20
  }

  ,
  mid: {
    gain: 1.5,
    threshold: 25
  }

  ,
  high: {
    gain: 2.2,
    threshold: 30
  }

  ,
  subBass: {
    gain: 2.8,
    threshold: 20
  }

  ,
  lowMid: {
    gain: 1.8,
    threshold: 25
  }

  ,
  upperMid: {
    gain: 2.0,
    threshold: 30
  }

  ,
  presence: {
    gain: 2.3,
    threshold: 25
  }

  ,
  brilliance: {
    gain: 2.4,
    threshold: 30
  }
};

let lowDrawSelector;
// --- Low用追加スライダー ---
let lowGainSlider,
  lowThresholdSlider,
  lowIntensityGainSlider,
  lowAngleSpeedSlider;
// --- 各音域Intensity/Angleスライダー ---
let subBassIntensityGainSlider,
  subBassAngleSpeedSlider;
let lowMidIntensityGainSlider,
  lowMidAngleSpeedSlider;
let midIntensityGainSlider,
  midAngleSpeedSlider;
let upperMidIntensityGainSlider,
  upperMidAngleSpeedSlider;
let presenceIntensityGainSlider,
  presenceAngleSpeedSlider;
let brillianceIntensityGainSlider,
  brillianceAngleSpeedSlider;
let highIntensityGainSlider,
  highAngleSpeedSlider;
let subBassDrawSelector;
let lowMidDrawSelector;
let midDrawSelector;
let upperMidDrawSelector;
let presenceDrawSelector;
let brillianceDrawSelector;
let highDrawSelector;
let lowColorPicker,
  lowStrokeSlider,
  lowAlphaSlider;
let midColorPicker,
  midStrokeSlider,
  midAlphaSlider;
let highColorPicker,
  highStrokeSlider,
  highAlphaSlider;
let subBassColorPicker,
  subBassStrokeSlider,
  subBassAlphaSlider;
let brillianceColorPicker,
  brillianceStrokeSlider,
  brillianceAlphaSlider;
let presenceColorPicker,
  presenceStrokeSlider,
  presenceAlphaSlider;
let lowMidColorPicker,
  lowMidStrokeSlider,
  lowMidAlphaSlider;
let upperMidColorPicker,
  upperMidStrokeSlider,
  upperMidAlphaSlider;
let uiPanel;

// チェックボックスとUI管理
let lowEnabledCheckbox,
  midEnabledCheckbox,
  highEnabledCheckbox;
let subBassEnabledCheckbox,
  brillianceEnabledCheckbox,
  presenceEnabledCheckbox;
let lowMidEnabledCheckbox,
  upperMidEnabledCheckbox;
let uiElements = [];
let uiVisible = true;

// 変更点1: マイクを使用するかどうかの状態を管理する変数
let useMic = false;

function preload() {
  // preloadからloadSoundを外すため空にする
}

function generateDistinctColors(count) {
  colorMode(HSB, 360, 100, 100);
  const colors = [];
  let whiteLikeCount = 0;
  let attempts = 0;
  let baseHue = random(0, 360); // 毎回ランダムな開始色

  while (colors.length < count && attempts < 100) {
    let hue = (baseHue + colors.length * (360 / count) + random(-20, 20)) % 360;
    let sat = random(60, 100);
    let bri = random(70, 100);

    if (sat > 95 && bri > 95) {
      if (whiteLikeCount >= 1) {
        attempts++;
        continue;
      }

      whiteLikeCount++;
    }

    colors.push(color(hue, sat, bri));
    attempts++;
  }

  return colors;
}

function setup() {
  colorMode(HSB, 360, 100, 100); // HSBカラーモードを一度だけ設定
  let myCanvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  myCanvas.parent('canvas-container');

  background(0);

  fft = new p5.FFT(0.9, 512); // FFTオブジェクトを作成。0.9はスムージング係数、512はFFTのバンド数（解析精度）

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
  // フォントはCSSクラスで指定
  uiElements.push(uiPanel);

  // ランダム色を取得
  let randomColors = generateDistinctColors(8);

  // --- UI要素の初期化 (低い音域から高い音域へ順番変更) ---
  // ストローク（線の太さ）設定スライダー
  // 引数: createSlider(最小値, 最大値, 初期値, ステップ値)
  // → ユーザーが0.1〜5の範囲で0.1刻みで調整可能
  // 1. SubBass
  createDiv('SubBass Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  subBassColorPicker = createColorPicker(randomColors[3]).parent(uiPanel);
  uiElements.push(subBassColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  subBassAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  const subBassAlphaValueSpan = createSpan(subBassAlphaSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  subBassAlphaSlider.input(() => subBassAlphaValueSpan.html(subBassAlphaSlider.value()));
  uiElements.push(subBassAlphaSlider);
  // SubBass描画関数切り替えセレクタ
  subBassDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) subBassDrawSelector.option(key);
  subBassDrawSelector.selected("drawExpandingDots");
  uiElements.push(subBassDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  subBassStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawExpandingDots"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  const subBassStrokeValueSpan = createSpan(subBassStrokeSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  subBassStrokeSlider.input(() => subBassStrokeValueSpan.html(subBassStrokeSlider.value()));
  uiElements.push(subBassStrokeSlider);
  // --- SubBass用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  subBassGainSlider = createSlider(0.1, 5.0, energySettings["subBass"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  const subBassGainValueSpan = createSpan(subBassGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  subBassGainSlider.input(() => subBassGainValueSpan.html(subBassGainSlider.value()));
  uiElements.push(subBassGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  subBassThresholdSlider = createSlider(0, 255, energySettings["subBass"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  const subBassThresholdValueSpan = createSpan(subBassThresholdSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  subBassThresholdSlider.input(() => subBassThresholdValueSpan.html(subBassThresholdSlider.value()));
  uiElements.push(subBassThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  subBassIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const subBassIntensityGainValueSpan = createSpan(subBassIntensityGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  subBassIntensityGainSlider.input(() => subBassIntensityGainValueSpan.html(subBassIntensityGainSlider.value()));
  uiElements.push(subBassIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  subBassAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const subBassAngleSpeedValueSpan = createSpan(subBassAngleSpeedSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  subBassAngleSpeedSlider.input(() => subBassAngleSpeedValueSpan.html(subBassAngleSpeedSlider.value()));
  uiElements.push(subBassAngleSpeedSlider);

  // 2. Low
  createDiv('Low Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  lowColorPicker = createColorPicker(randomColors[0]).parent(uiPanel);
  uiElements.push(lowColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  lowAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  const lowAlphaValueSpan = createSpan(lowAlphaSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowAlphaSlider.input(() => lowAlphaValueSpan.html(lowAlphaSlider.value()));
  uiElements.push(lowAlphaSlider);
  // lowEnergy 描画関数切り替えセレクタ
  lowDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) lowDrawSelector.option(key);
  lowDrawSelector.selected("drawSmoothEllipse");
  uiElements.push(lowDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  lowStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawSmoothEllipse"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  const lowStrokeValueSpan = createSpan(lowStrokeSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowStrokeSlider.input(() => lowStrokeValueSpan.html(lowStrokeSlider.value()));
  uiElements.push(lowStrokeSlider);
  // --- Low用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowGainSlider = createSlider(0.1, 5.0, energySettings["low"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  const lowGainValueSpan = createSpan(lowGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowGainSlider.input(() => lowGainValueSpan.html(lowGainSlider.value()));
  uiElements.push(lowGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowThresholdSlider = createSlider(0, 255, energySettings["low"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  const lowThresholdValueSpan = createSpan(lowThresholdSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowThresholdSlider.input(() => lowThresholdValueSpan.html(lowThresholdSlider.value()));
  uiElements.push(lowThresholdSlider);
  // intensityGain
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const lowIntensityGainValueSpan = createSpan(lowIntensityGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowIntensityGainSlider.input(() => lowIntensityGainValueSpan.html(lowIntensityGainSlider.value()));
  uiElements.push(lowIntensityGainSlider);
  // angleSpeed
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const lowAngleSpeedValueSpan = createSpan(lowAngleSpeedSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowAngleSpeedSlider.input(() => lowAngleSpeedValueSpan.html(lowAngleSpeedSlider.value()));
  uiElements.push(lowAngleSpeedSlider);

  // 3. LowMid
  createDiv('LowMid Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  lowMidColorPicker = createColorPicker(randomColors[6]).parent(uiPanel);
  uiElements.push(lowMidColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  lowMidAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  const lowMidAlphaValueSpan = createSpan(lowMidAlphaSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowMidAlphaSlider.input(() => lowMidAlphaValueSpan.html(lowMidAlphaSlider.value()));
  uiElements.push(lowMidAlphaSlider);
  // LowMid描画関数切り替えセレクタ
  lowMidDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) lowMidDrawSelector.option(key);
  lowMidDrawSelector.selected("drawNoisyContours");
  uiElements.push(lowMidDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  lowMidStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawNoisyContours"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  const lowMidStrokeValueSpan = createSpan(lowMidStrokeSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowMidStrokeSlider.input(() => lowMidStrokeValueSpan.html(lowMidStrokeSlider.value()));
  uiElements.push(lowMidStrokeSlider);
  // --- LowMid用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowMidGainSlider = createSlider(0.1, 5.0, energySettings["lowMid"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  const lowMidGainValueSpan = createSpan(lowMidGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowMidGainSlider.input(() => lowMidGainValueSpan.html(lowMidGainSlider.value()));
  uiElements.push(lowMidGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowMidThresholdSlider = createSlider(0, 255, energySettings["lowMid"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  const lowMidThresholdValueSpan = createSpan(lowMidThresholdSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowMidThresholdSlider.input(() => lowMidThresholdValueSpan.html(lowMidThresholdSlider.value()));
  uiElements.push(lowMidThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowMidIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const lowMidIntensityGainValueSpan = createSpan(lowMidIntensityGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowMidIntensityGainSlider.input(() => lowMidIntensityGainValueSpan.html(lowMidIntensityGainSlider.value()));
  uiElements.push(lowMidIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowMidAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const lowMidAngleSpeedValueSpan = createSpan(lowMidAngleSpeedSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  lowMidAngleSpeedSlider.input(() => lowMidAngleSpeedValueSpan.html(lowMidAngleSpeedSlider.value()));
  uiElements.push(lowMidAngleSpeedSlider);

  // 4. Mid
  createDiv('Mid Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  midColorPicker = createColorPicker(randomColors[1]).parent(uiPanel);
  uiElements.push(midColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  midAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  const midAlphaValueSpan = createSpan(midAlphaSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  midAlphaSlider.input(() => midAlphaValueSpan.html(midAlphaSlider.value()));
  uiElements.push(midAlphaSlider);
  // Mid描画関数切り替えセレクタ
  midDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) midDrawSelector.option(key);
  midDrawSelector.selected("drawRotatingWaves");
  uiElements.push(midDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  midStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawRotatingWaves"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  const midStrokeValueSpan = createSpan(midStrokeSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  midStrokeSlider.input(() => midStrokeValueSpan.html(midStrokeSlider.value()));
  uiElements.push(midStrokeSlider);
  // --- Mid用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  midGainSlider = createSlider(0.1, 5.0, energySettings["mid"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  const midGainValueSpan = createSpan(midGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  midGainSlider.input(() => midGainValueSpan.html(midGainSlider.value()));
  uiElements.push(midGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  midThresholdSlider = createSlider(0, 255, energySettings["mid"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  const midThresholdValueSpan = createSpan(midThresholdSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  midThresholdSlider.input(() => midThresholdValueSpan.html(midThresholdSlider.value()));
  uiElements.push(midThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  midIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const midIntensityGainValueSpan = createSpan(midIntensityGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  midIntensityGainSlider.input(() => midIntensityGainValueSpan.html(midIntensityGainSlider.value()));
  uiElements.push(midIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  midAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const midAngleSpeedValueSpan = createSpan(midAngleSpeedSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  midAngleSpeedSlider.input(() => midAngleSpeedValueSpan.html(midAngleSpeedSlider.value()));
  uiElements.push(midAngleSpeedSlider);

  // 5. UpperMid
  createDiv('UpperMid Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  upperMidColorPicker = createColorPicker(randomColors[7]).parent(uiPanel);
  uiElements.push(upperMidColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  upperMidAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  const upperMidAlphaValueSpan = createSpan(upperMidAlphaSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  upperMidAlphaSlider.input(() => upperMidAlphaValueSpan.html(upperMidAlphaSlider.value()));
  uiElements.push(upperMidAlphaSlider);
  // UpperMid描画関数切り替えセレクタ
  upperMidDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) upperMidDrawSelector.option(key);
  upperMidDrawSelector.selected("drawFloatingDots");
  uiElements.push(upperMidDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  upperMidStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawFloatingDots"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  const upperMidStrokeValueSpan = createSpan(upperMidStrokeSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  upperMidStrokeSlider.input(() => upperMidStrokeValueSpan.html(upperMidStrokeSlider.value()));
  uiElements.push(upperMidStrokeSlider);
  // --- UpperMid用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  upperMidGainSlider = createSlider(0.1, 5.0, energySettings["upperMid"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  const upperMidGainValueSpan = createSpan(upperMidGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  upperMidGainSlider.input(() => upperMidGainValueSpan.html(upperMidGainSlider.value()));
  uiElements.push(upperMidGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  upperMidThresholdSlider = createSlider(0, 255, energySettings["upperMid"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  const upperMidThresholdValueSpan = createSpan(upperMidThresholdSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  upperMidThresholdSlider.input(() => upperMidThresholdValueSpan.html(upperMidThresholdSlider.value()));
  uiElements.push(upperMidThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  upperMidIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const upperMidIntensityGainValueSpan = createSpan(upperMidIntensityGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  upperMidIntensityGainSlider.input(() => upperMidIntensityGainValueSpan.html(upperMidIntensityGainSlider.value()));
  uiElements.push(upperMidIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  upperMidAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const upperMidAngleSpeedValueSpan = createSpan(upperMidAngleSpeedSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  upperMidAngleSpeedSlider.input(() => upperMidAngleSpeedValueSpan.html(upperMidAngleSpeedSlider.value()));
  uiElements.push(upperMidAngleSpeedSlider);

  // 6. Presence
  createDiv('Presence Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  presenceColorPicker = createColorPicker(randomColors[5]).parent(uiPanel);
  uiElements.push(presenceColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  presenceAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  const presenceAlphaValueSpan = createSpan(presenceAlphaSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  presenceAlphaSlider.input(() => presenceAlphaValueSpan.html(presenceAlphaSlider.value()));
  uiElements.push(presenceAlphaSlider);
  // Presence描画関数切り替えセレクタ
  presenceDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) presenceDrawSelector.option(key);
  presenceDrawSelector.selected("drawSparks");
  uiElements.push(presenceDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  presenceStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawSparks"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  const presenceStrokeValueSpan = createSpan(presenceStrokeSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  presenceStrokeSlider.input(() => presenceStrokeValueSpan.html(presenceStrokeSlider.value()));
  uiElements.push(presenceStrokeSlider);
  // --- Presence用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  presenceGainSlider = createSlider(0.1, 5.0, energySettings["presence"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  const presenceGainValueSpan = createSpan(presenceGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  presenceGainSlider.input(() => presenceGainValueSpan.html(presenceGainSlider.value()));
  uiElements.push(presenceGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  presenceThresholdSlider = createSlider(0, 255, energySettings["presence"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  const presenceThresholdValueSpan = createSpan(presenceThresholdSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  presenceThresholdSlider.input(() => presenceThresholdValueSpan.html(presenceThresholdSlider.value()));
  uiElements.push(presenceThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  presenceIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const presenceIntensityGainValueSpan = createSpan(presenceIntensityGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  presenceIntensityGainSlider.input(() => presenceIntensityGainValueSpan.html(presenceIntensityGainSlider.value()));
  uiElements.push(presenceIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  presenceAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const presenceAngleSpeedValueSpan = createSpan(presenceAngleSpeedSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  presenceAngleSpeedSlider.input(() => presenceAngleSpeedValueSpan.html(presenceAngleSpeedSlider.value()));
  uiElements.push(presenceAngleSpeedSlider);

  // 7. Brilliance
  createDiv('Brilliance Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  brillianceColorPicker = createColorPicker(randomColors[4]).parent(uiPanel);
  uiElements.push(brillianceColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  brillianceAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  const brillianceAlphaValueSpan = createSpan(brillianceAlphaSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  brillianceAlphaSlider.input(() => brillianceAlphaValueSpan.html(brillianceAlphaSlider.value()));
  uiElements.push(brillianceAlphaSlider);
  // Brilliance描画関数切り替えセレクタ
  brillianceDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) brillianceDrawSelector.option(key);
  brillianceDrawSelector.selected("drawRadiantBeams");
  uiElements.push(brillianceDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  brillianceStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawRadiantBeams"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  const brillianceStrokeValueSpan = createSpan(brillianceStrokeSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  brillianceStrokeSlider.input(() => brillianceStrokeValueSpan.html(brillianceStrokeSlider.value()));
  uiElements.push(brillianceStrokeSlider);
  // --- Brilliance用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  brillianceGainSlider = createSlider(0.1, 5.0, energySettings["brilliance"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  const brillianceGainValueSpan = createSpan(brillianceGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  brillianceGainSlider.input(() => brillianceGainValueSpan.html(brillianceGainSlider.value()));
  uiElements.push(brillianceGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  brillianceThresholdSlider = createSlider(0, 255, energySettings["brilliance"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  const brillianceThresholdValueSpan = createSpan(brillianceThresholdSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  brillianceThresholdSlider.input(() => brillianceThresholdValueSpan.html(brillianceThresholdSlider.value()));
  uiElements.push(brillianceThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  brillianceIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const brillianceIntensityGainValueSpan = createSpan(brillianceIntensityGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  brillianceIntensityGainSlider.input(() => brillianceIntensityGainValueSpan.html(brillianceIntensityGainSlider.value()));
  uiElements.push(brillianceIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  brillianceAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const brillianceAngleSpeedValueSpan = createSpan(brillianceAngleSpeedSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  brillianceAngleSpeedSlider.input(() => brillianceAngleSpeedValueSpan.html(brillianceAngleSpeedSlider.value()));
  uiElements.push(brillianceAngleSpeedSlider);

  // 8. High
  createDiv('High Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  highColorPicker = createColorPicker(randomColors[2]).parent(uiPanel);
  uiElements.push(highColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  highAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  const highAlphaValueSpan = createSpan(highAlphaSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  highAlphaSlider.input(() => highAlphaValueSpan.html(highAlphaSlider.value()));
  uiElements.push(highAlphaSlider);
  // High描画関数切り替えセレクタ
  highDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) highDrawSelector.option(key);
  highDrawSelector.selected("drawRadialLines");
  uiElements.push(highDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  highStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawRadialLines"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  const highStrokeValueSpan = createSpan(highStrokeSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  highStrokeSlider.input(() => highStrokeValueSpan.html(highStrokeSlider.value()));
  uiElements.push(highStrokeSlider);
  // --- High用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  highGainSlider = createSlider(0.1, 5.0, energySettings["high"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  const highGainValueSpan = createSpan(highGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  highGainSlider.input(() => highGainValueSpan.html(highGainSlider.value()));
  uiElements.push(highGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  highThresholdSlider = createSlider(0, 255, energySettings["high"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  const highThresholdValueSpan = createSpan(highThresholdSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  highThresholdSlider.input(() => highThresholdValueSpan.html(highThresholdSlider.value()));
  uiElements.push(highThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  highIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const highIntensityGainValueSpan = createSpan(highIntensityGainSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  highIntensityGainSlider.input(() => highIntensityGainValueSpan.html(highIntensityGainSlider.value()));
  uiElements.push(highIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  highAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  const highAngleSpeedValueSpan = createSpan(highAngleSpeedSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  highAngleSpeedSlider.input(() => highAngleSpeedValueSpan.html(highAngleSpeedSlider.value()));
  uiElements.push(highAngleSpeedSlider);

  // --- Spectrum Ring/Diff チェックボックス追加 ---
  spectrumRingCheckbox = createCheckbox('Draw Spectrum Ring', true).parent(uiPanel).style('color', 'white');
  uiElements.push(spectrumRingCheckbox);

  spectrumDiffCheckbox = createCheckbox('Draw Spectrum Diff', true).parent(uiPanel).style('color', 'white');
  uiElements.push(spectrumDiffCheckbox);
  // Spectrum Diff Color Picker
  spectrumDiffColorPicker = createColorPicker('#ffffff').parent(uiPanel);
  uiElements.push(spectrumDiffColorPicker);

  // 音域ごとの描画ON/OFFチェックボックスとラベル（低音域から高音域へ）
  // 1. SubBass
  createDiv('SubBass').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  subBassEnabledCheckbox = createCheckbox('Draw', true).parent(uiPanel);
  uiElements.push(subBassEnabledCheckbox);
  // 2. Low
  createDiv('Low').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  lowEnabledCheckbox = createCheckbox('Draw', true).parent(uiPanel);
  uiElements.push(lowEnabledCheckbox);
  // 3. LowMid
  createDiv('LowMid').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  lowMidEnabledCheckbox = createCheckbox('Draw', true).parent(uiPanel);
  uiElements.push(lowMidEnabledCheckbox);
  // 4. Mid
  createDiv('Mid').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  midEnabledCheckbox = createCheckbox('Draw', true).parent(uiPanel);
  uiElements.push(midEnabledCheckbox);
  // 5. UpperMid
  createDiv('UpperMid').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  upperMidEnabledCheckbox = createCheckbox('Draw', true).parent(uiPanel);
  uiElements.push(upperMidEnabledCheckbox);
  // 6. Presence
  createDiv('Presence').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  presenceEnabledCheckbox = createCheckbox('Draw', true).parent(uiPanel);
  uiElements.push(presenceEnabledCheckbox);
  // 7. Brilliance
  createDiv('Brilliance').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  brillianceEnabledCheckbox = createCheckbox('Draw', true).parent(uiPanel);
  uiElements.push(brillianceEnabledCheckbox);
  // 8. High
  createDiv('High').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  highEnabledCheckbox = createCheckbox('Draw', true).parent(uiPanel);
  uiElements.push(highEnabledCheckbox);

  // 変更点: sound.mp3の読み込みロジックを削除し、マイク入力に切り替え
  useMic = true;
  initMic();

  // --- Frame Rate UI追加 ---
  createDiv('Frame Rate').parent(uiPanel).style('color', 'white');
  frameRateSlider = createSlider(1, 60, 10, 1).parent(uiPanel).addClass('ui-slider');
  const frameRateValueSpan = createSpan(frameRateSlider.value()).parent(uiPanel).style('color', 'white').style('margin-left', '5px');
  frameRateSlider.input(() => frameRateValueSpan.html(frameRateSlider.value()));
  uiElements.push(frameRateSlider);

  // --- Save SVG Button and Handler ---
  const saveButton = createButton('Save SVG');
  saveButton.parent(uiPanel);
  saveButton.mousePressed(downloadSVG);
}

// マイク初期化関数
function initMic() {
  useMic = true;
  mic = new p5.AudioIn();

  mic.start(() => {
    fft.setInput(mic);
    console.log("FFT input set to mic.");
  });
  fft.setInput(mic);
}

function draw() {
  // --- 音声解析と履歴蓄積 ---
  if (useMic && mic && mic.enabled && fft) {
    let spectrum = fft.analyze();
    let totalEnergy = spectrum.reduce((a, b) => a + b, 0);
    if (totalEnergy >= (useMic ? 100 : 500)) {
      spectrumHistory.push(spectrum.slice());
    }
  }

  // --- キャンバスをクリアして再描画 ---
  clear();
  background(0);

  // --- 履歴に基づいた一括描画 ---
  redrawCanvas(this);
}

// Extracted drawing logic; accepts a p5 graphics context
function drawVisuals(pg, frameOverride = null, overrideSpectrum = null) {
  const currentFrame = (frameOverride !== null) ? frameOverride : pg.frameCount;
  const time = currentFrame * 0.005;
  // --- フレームレートスライダーによるフレームレート制御 ---
  if (frameRateSlider) {
    pg.frameRate(frameRateSlider.value());
  }

  // 変更点3: 入力ソースに応じた準備完了チェック
  if (useMic) {
    if (!mic || !mic.enabled) return; // マイクが準備できていなければ処理を中断
    //console.log("Using microphone input.");
  }
  else {
    //console.log("Using sound input.");
  }

  if (!fft) return; // FFTが準備できていなければ処理を中断

  // fft.analyze()は現在の音声信号の周波数スペクトルを配列で返す
  // 配列の各要素は特定の周波数帯のエネルギー量（音の強さ）を表す
  let spectrum = (overrideSpectrum !== null) ? overrideSpectrum : fft.analyze();
  // record live-frame spectrum history
  if (overrideSpectrum === null) {
    spectrumHistory.push(spectrum.slice());
  }

  // 全周波数帯のエネルギーの合計を計算し、音の総エネルギーの指標とする
  let totalEnergy = spectrum.reduce((a, b) => a + b, 0);

  // 音の総エネルギーが閾値未満なら描画しない（ノイズ除去や無音時の無駄な描画防止）
  if (totalEnergy < (useMic ? 100 : 500)) return;

  // fft.getEnergy("bass"), "mid", "treble"はそれぞれ低音域、中音域、高音域のエネルギーを取得
  // これらの値を使って周波数帯ごとに異なるビジュアル表現を行う
  let subBassEnergy = fft.getEnergy(20, 60); // 低低音域（約20Hz～60Hz）
  let lowEnergy = fft.getEnergy("bass"); // 低音域（約20Hz～140Hz）
  let lowMidEnergy = fft.getEnergy(140, 400); // 低中音域（約140Hz～400Hz）
  let midEnergy = fft.getEnergy("mid"); // 中音域（約140Hz～4000Hz）
  let upperMidEnergy = fft.getEnergy(1000, 3000); // 高中音域（約1000Hz～3000Hz）
  let presenceEnergy = fft.getEnergy(3000, 6000); // 低高音域（約3000Hz～6000Hz）
  let brillianceEnergy = fft.getEnergy(6000, 16000); // 中高音域（約6000Hz～16000Hz）
  let highEnergy = fft.getEnergy("treble"); // 高音域（約4000Hz～20000Hz）

  pg.push();
  pg.translate(pg.width / 2, pg.height / 2);

  // SubBass
  if (subBassEnabledCheckbox && subBassEnabledCheckbox.checked()) {
    pg.push();
    {
      let energyValue = subBassEnergy;
      let OFFSET = 4;
      let baseAmount = 14;
      let intensity = pg.map(energyValue, 0, 255, 0, 1);
      let dx = (pg.noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (pg.noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      //console.log("OFFSET subBassEnergy:", dx, dy);
      pg.translate(dx, dy);
      const style = {
        color: subBassColorPicker.color(),
        weight: subBassStrokeSlider.value(),
        alpha: subBassAlphaSlider.value()
      };
      const selectedFuncName = subBassDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      let gain = subBassGainSlider.value();
      let threshold = subBassThresholdSlider.value();
      let scaledEnergy = pg.constrain(subBassEnergy * gain, 0, 255);
      const params = {
        intensityGain: subBassIntensityGainSlider.value(),
        angleSpeed: subBassAngleSpeedSlider.value()
      };
      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func.call(pg, scaledEnergy, currentFrame, time, style, params);
      }
    }
    pg.pop();
  }

  // Low
  if (lowEnabledCheckbox && lowEnabledCheckbox.checked()) {
    pg.push();
    {
      let energyValue = lowEnergy;
      let gain = lowGainSlider.value();
      let threshold = lowThresholdSlider.value();
      let intensityGain = lowIntensityGainSlider.value();
      let angleSpeed = lowAngleSpeedSlider.value();
      let baseAmount = 12;
      let intensity = pg.map(energyValue, 0, 255, 0, 1);
      let angle = pg.frameCount * 0.02;
      let dx = pg.sin(angle + time) * baseAmount * intensity;
      let dy = pg.cos(angle + time * 1.5) * baseAmount * intensity;
      //console.log("OFFSET lowEnergy:", dx, dy);
      pg.translate(dx, dy);
      const style = {
        color: lowColorPicker.color(),
        weight: lowStrokeSlider.value(),
        alpha: lowAlphaSlider.value()
      };
      const selectedFuncName = lowDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      let scaledEnergy = pg.constrain(lowEnergy * gain, 0, 255);
      const params = {
        intensityGain: intensityGain,
        angleSpeed: angleSpeed
      };
      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func.call(pg, scaledEnergy, currentFrame, time, style, params);
      }
    }
    pg.pop();
  }

  // LowMid
  if (lowMidEnabledCheckbox && lowMidEnabledCheckbox.checked()) {
    pg.push();
    {
      let energyValue = lowMidEnergy;
      let OFFSET = 7;
      let baseAmount = 11;
      let intensity = pg.map(energyValue, 0, 255, 0, 1);
      let dx = (pg.noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (pg.noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      //console.log("OFFSET lowMidEnergy:", dx, dy);
      pg.translate(dx, dy);
      const style = {
        color: lowMidColorPicker.color(),
        weight: lowMidStrokeSlider.value(),
        alpha: lowMidAlphaSlider.value()
      };
      const selectedFuncName = lowMidDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      let gain = lowMidGainSlider.value();
      let threshold = lowMidThresholdSlider.value();
      let scaledEnergy = pg.constrain(lowMidEnergy * gain, 0, 255);
      const params = {
        intensityGain: lowMidIntensityGainSlider.value(),
        angleSpeed: lowMidAngleSpeedSlider.value()
      };
      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func.call(pg, scaledEnergy, currentFrame, time, style, params);
      }
    }
    pg.pop();
  }

  // Mid
  if (midEnabledCheckbox && midEnabledCheckbox.checked()) {
    pg.push();
    {
      let energyValue = midEnergy;
      let OFFSET = 2;
      let baseAmount = 10;
      let intensity = pg.map(energyValue, 0, 255, 0, 1);
      let dx = (pg.noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (pg.noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      //console.log("OFFSET midEnergy:", dx, dy);
      pg.translate(dx, dy);
      const style = {
        color: midColorPicker.color(),
        weight: midStrokeSlider.value(),
        alpha: midAlphaSlider.value()
      };
      const selectedFuncName = midDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      let gain = midGainSlider.value();
      let threshold = midThresholdSlider.value();
      let scaledEnergy = pg.constrain(midEnergy * gain, 0, 255);
      const params = {
        intensityGain: midIntensityGainSlider.value(),
        angleSpeed: midAngleSpeedSlider.value()
      };
      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func.call(pg, scaledEnergy, currentFrame, time, style, params);
      }
    }
    pg.pop();
  }

  // UpperMid
  if (upperMidEnabledCheckbox && upperMidEnabledCheckbox.checked()) {
    pg.push();
    {
      let energyValue = upperMidEnergy;
      let OFFSET = 8;
      let baseAmount = 13;
      let intensity = pg.map(energyValue, 0, 255, 0, 1);
      let dx = (pg.noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (pg.noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      //console.log("OFFSET upperMidEnergy:", dx, dy);
      pg.translate(dx, dy);
      const style = {
        color: upperMidColorPicker.color(),
        weight: upperMidStrokeSlider.value(),
        alpha: upperMidAlphaSlider.value()
      };
      const selectedFuncName = upperMidDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      let gain = upperMidGainSlider.value();
      let threshold = upperMidThresholdSlider.value();
      let scaledEnergy = pg.constrain(upperMidEnergy * gain, 0, 255);
      const params = {
        intensityGain: upperMidIntensityGainSlider.value(),
        angleSpeed: upperMidAngleSpeedSlider.value()
      };
      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func.call(pg, scaledEnergy, currentFrame, time, style, params);
      }
    }
    pg.pop();
  }

  // Presence
  if (presenceEnabledCheckbox && presenceEnabledCheckbox.checked()) {
    pg.push();
    {
      let energyValue = presenceEnergy;
      let OFFSET = 6;
      let baseAmount = 18;
      let intensity = pg.map(energyValue, 0, 255, 0, 1);
      let dx = (pg.noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (pg.noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      //console.log("OFFSET presenceEnergy:", dx, dy);
      pg.translate(dx, dy);
      const style = {
        color: presenceColorPicker.color(),
        weight: presenceStrokeSlider.value(),
        alpha: presenceAlphaSlider.value()
      };
      const selectedFuncName = presenceDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      let gain = presenceGainSlider.value();
      let threshold = presenceThresholdSlider.value();
      let scaledEnergy = pg.constrain(presenceEnergy * gain, 0, 255);
      const params = {
        intensityGain: presenceIntensityGainSlider.value(),
        angleSpeed: presenceAngleSpeedSlider.value()
      };
      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func.call(pg, scaledEnergy, currentFrame, time, style, params);
      }
    }
    pg.pop();
  }

  // Brilliance
  if (brillianceEnabledCheckbox && brillianceEnabledCheckbox.checked()) {
    pg.push();
    {
      let energyValue = brillianceEnergy;
      let OFFSET = 5;
      let baseAmount = 20;
      let intensity = pg.map(energyValue, 0, 255, 0, 1);
      let dx = (pg.noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (pg.noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      //console.log("OFFSET brillianceEnergy:", dx, dy);
      pg.translate(dx, dy);
      const style = {
        color: brillianceColorPicker.color(),
        weight: brillianceStrokeSlider.value(),
        alpha: brillianceAlphaSlider.value()
      };
      const selectedFuncName = brillianceDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      let gain = brillianceGainSlider.value();
      let threshold = brillianceThresholdSlider.value();
      let scaledEnergy = pg.constrain(brillianceEnergy * gain, 0, 255);
      const params = {
        intensityGain: brillianceIntensityGainSlider.value(),
        angleSpeed: brillianceAngleSpeedSlider.value()
      };
      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func.call(pg, scaledEnergy, currentFrame, time, style, params);
      }
    }
    pg.pop();
  }

  // High
  if (highEnabledCheckbox && highEnabledCheckbox.checked()) {
    pg.push();
    {
      let energyValue = highEnergy;
      let OFFSET = 3;
      let baseAmount = 16;
      let intensity = pg.map(energyValue, 0, 255, 0, 1);
      let dx = (pg.noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (pg.noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      //console.log("OFFSET highEnergy:", dx, dy);
      pg.translate(dx, dy);
      const style = {
        color: highColorPicker.color(),
        weight: highStrokeSlider.value(),
        alpha: highAlphaSlider.value()
      };
      const selectedFuncName = highDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      let gain = highGainSlider.value();
      let threshold = highThresholdSlider.value();
      let scaledEnergy = pg.constrain(highEnergy * gain, 0, 255);
      const params = {
        intensityGain: highIntensityGainSlider.value(),
        angleSpeed: highAngleSpeedSlider.value()
      };
      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func.call(pg, scaledEnergy, currentFrame, time, style, params);
      }
    }
    pg.pop();
  }

  // --- Spectrum Ring Layer ---
  if (spectrumRingCheckbox && spectrumRingCheckbox.checked()) {
    pg.push();
    // Draw spectrum ring, but need to proxy p5 state
    drawSpectrumRingByBandsProxy(pg, spectrum, currentFrame);
    pg.pop();
  }

  // --- Spectrum Diff Layer ---
  if (spectrumDiffCheckbox && spectrumDiffCheckbox.checked()) {
    pg.push();
    drawSpectrumDiffProxy(pg, spectrum, prevSpectrum, currentFrame);
    pg.pop();
  }

  pg.pop();

  // スペクトラム履歴を更新
  prevSpectrum = spectrum.slice(); // 配列をコピー
}

/**
 * 履歴データに基づいてキャンバスまたはSVGバッファに一括描画する
 * @param {p5.Graphics} pg - 描画先コンテキスト
 */
function redrawCanvas(pg) {
  for (let i = 0; i < spectrumHistory.length; i++) {
    drawVisuals(pg, i + 1, spectrumHistory[i]);
  }
}

// Proxy for drawSpectrumRingByBands to allow drawing on arbitrary p5.Graphics context
function drawSpectrumRingByBandsProxy(pg, spectrum, currentFrame) {
  pg.noFill();
  let totalBands = spectrum.length;
  const bands = [
    { name: "subBass", fromHz: 20, toHz: 60, color: subBassColorPicker.color() },
    { name: "low", fromHz: 60, toHz: 140, color: lowColorPicker.color() },
    { name: "lowMid", fromHz: 140, toHz: 400, color: lowMidColorPicker.color() },
    { name: "mid", fromHz: 400, toHz: 1000, color: midColorPicker.color() },
    { name: "upperMid", fromHz: 1000, toHz: 3000, color: upperMidColorPicker.color() },
    { name: "presence", fromHz: 3000, toHz: 6000, color: presenceColorPicker.color() },
    { name: "brilliance", fromHz: 6000, toHz: 16000, color: brillianceColorPicker.color() },
    { name: "high", fromHz: 16000, toHz: 22050, color: highColorPicker.color() }
  ];
  for (let band of bands) {
    let startIndex = Math.floor(pg.map(band.fromHz, 0, 22050, 0, totalBands));
    let endIndex = Math.floor(pg.map(band.toHz, 0, 22050, 0, totalBands));
    pg.stroke(band.color);
    pg.strokeWeight(1);
    pg.beginShape();
    for (let i = startIndex; i < endIndex; i++) {
      let angle = pg.map(i, 0, totalBands, 0, pg.TWO_PI);
      let baseRadius = pg.map(spectrum[i], 0, 255, 60, 280);
      let breathing = pg.sin(currentFrame * 0.05 + angle) * 8;
      let jitter = pg.noise(angle + currentFrame * 0.01) * 10;
      let radius = baseRadius + breathing + jitter;
      let x = pg.cos(angle) * radius;
      let y = pg.sin(angle) * radius;
      pg.vertex(x, y);
    }
    pg.endShape();
  }
}

// Proxy for drawSpectrumDiff to allow drawing on arbitrary p5.Graphics context
function drawSpectrumDiffProxy(pg, current, previous, currentFrame) {
  if (previous.length === 0) return;
  let diffColor = spectrumDiffColorPicker ? spectrumDiffColorPicker.color() : pg.color(255);
  diffColor.setAlpha(180);
  pg.noFill();
  let totalEnergy = current.reduce((a, b) => a + b, 0) / current.length;
  let speed = pg.map(totalEnergy, 0, 255, 0.03, 0.25);
  for (let i = 0; i < current.length; i++) {
    let diff = Math.abs(current[i] - (previous[i] || 0));
    if (diff > 10) {
      let angle = pg.map(i, 0, current.length, 0, pg.TWO_PI);
      let baseRadius = pg.map(diff, 0, 255, 120, 370);
      let growth = diff * 0.3;
      let radius = baseRadius + growth;
      let x = pg.cos(angle) * radius;
      let y = pg.sin(angle) * radius;
      if (diff > 100) {
        pg.stroke(255);
        pg.strokeWeight(3);
      } else {
        pg.stroke(diffColor);
        pg.strokeWeight(2);
      }
      pg.point(x, y);
    }
  }
}

// --- Spectrum Ring 描画関数 (旧モードは未使用のため描画呼び出しなし。関数自体は残すがUIやdrawからは呼ばれない) ---
function drawSpectrumRing(spectrum) {
  stroke(200, 100, 100, 100);
  noFill();
  strokeWeight(1);
  beginShape();
  for (let i = 0; i < spectrum.length; i++) {
    let angle = map(i, 0, spectrum.length, 0, TWO_PI);
    let radius = map(spectrum[i], 0, 255, 100, 350);
    let x = cos(angle) * radius;
    let y = sin(angle) * radius;
    vertex(x, y);
  }
  endShape(CLOSE);
}

// --- Spectrum Diff 描画関数（ドットで可視化） ---
function drawSpectrumDiff(current, previous) {
  if (previous.length === 0) return;
  let diffColor = spectrumDiffColorPicker ? spectrumDiffColorPicker.color() : color(255);
  diffColor.setAlpha(180);
  noFill();
  // Calculate dynamic speed based on current energy
  let totalEnergy = current.reduce((a, b) => a + b, 0) / current.length;
  let speed = map(totalEnergy, 0, 255, 0.03, 0.25); // Higher energy = faster
  for (let i = 0; i < current.length; i++) {
    let diff = abs(current[i] - (previous[i] || 0));
    if (diff > 10) { // Draw only if diff is significant
      let angle = map(i, 0, current.length, 0, TWO_PI);
      let baseRadius = map(diff, 0, 255, 120, 370);
      let growth = diff * 0.3;
      let radius = baseRadius + growth;
      let x = cos(angle) * radius;
      let y = sin(angle) * radius;
      if (diff > 100) {
        stroke(255);
        strokeWeight(3);
      } else {
        stroke(diffColor);
        strokeWeight(2);
      }
      point(x, y);
    }
  }
}

function keyPressed() {

  // 's'キーが押されたらSVG保存
  if (key === 's' || key === 'S') {
    downloadSVG();
  }

  // 'c'キーでUI表示切り替え
  if (key === 'c' || key === 'C') {
    uiVisible = !uiVisible;
    uiPanel.style('display', uiVisible ? 'block' : 'none');
  }

  // 'e'キーでキャンバスをクリア（描画リセット）
  if (key === 'e' || key === 'E') {
    clear(); // 背景と描画をすべてリセット
    background(0); // 背景色を黒で再設定
  }
}

// Global SVG export routine: redraw accumulated frames offscreen and save
function downloadSVG() {
  noLoop();
  // 保存前の各バンド描画チェック状態を保持
  const subBassOn = subBassEnabledCheckbox.checked();
  const lowOn = lowEnabledCheckbox.checked();
  const lowMidOn = lowMidEnabledCheckbox.checked();
  const midOn = midEnabledCheckbox.checked();
  const upperMidOn = upperMidEnabledCheckbox.checked();
  const presenceOn = presenceEnabledCheckbox.checked();
  const brillianceOn = brillianceEnabledCheckbox.checked();
  const highOn = highEnabledCheckbox.checked();
  // 保存前のチェックボックス状態を保持
  const ringOn = spectrumRingCheckbox.checked();
  const diffOn = spectrumDiffCheckbox.checked();
  // 書き出し時は必ずスペクトルリング／ディフを有効化
  spectrumRingCheckbox.checked(true);
  spectrumDiffCheckbox.checked(true);
  // 書き出し時は全バンドも強制描画
  subBassEnabledCheckbox.checked(true);
  lowEnabledCheckbox.checked(true);
  lowMidEnabledCheckbox.checked(true);
  midEnabledCheckbox.checked(true);
  upperMidEnabledCheckbox.checked(true);
  presenceEnabledCheckbox.checked(true);
  brillianceEnabledCheckbox.checked(true);
  highEnabledCheckbox.checked(true);

  // オフスクリーンSVGバッファを作成
  const svgBuffer = createGraphics(CANVAS_SIZE, CANVAS_SIZE, SVG);
  svgBuffer.background(0);
  // reset diff history for SVG replay
  prevSpectrum = [];

  // フレームを再生描画してSVGに積み上げ
  for (let i = 0; i < spectrumHistory.length; i++) {
    // replay each recorded frame with its saved spectrum
    drawVisuals(svgBuffer, i + 1, spectrumHistory[i]);
  }

  // チェックボックス状態を復元（スペクトルリング／ディフ）
  spectrumRingCheckbox.checked(ringOn);
  spectrumDiffCheckbox.checked(diffOn);
  // チェックボックス状態を復元（各バンド描画）
  subBassEnabledCheckbox.checked(subBassOn);
  lowEnabledCheckbox.checked(lowOn);
  lowMidEnabledCheckbox.checked(lowMidOn);
  midEnabledCheckbox.checked(midOn);
  upperMidEnabledCheckbox.checked(upperMidOn);
  presenceEnabledCheckbox.checked(presenceOn);
  brillianceEnabledCheckbox.checked(brillianceOn);
  highEnabledCheckbox.checked(highOn);

  // p5 の save を使って SVG をダウンロード
  save(svgBuffer, 'sound_visualization', 'svg');

  loop();
}

// --- 各音域の描画処理 ---
function drawSmoothEllipse(energy, frameCount, time, style, params) {
  // 有機的な包み込むような低音: 滑らかな楕円波形構造 (curveVertex)
  let c = style.color;
  c.setAlpha(style.alpha);
  stroke(c);
  strokeWeight(style.weight);
  noFill();
  // --- intensityGain, angleSpeed パラメータ取得（デフォルト1.0） ---
  let intensityGain = (params && typeof params.intensityGain === "number") ? params.intensityGain : 1.0;
  let angleSpeed = (params && typeof params.angleSpeed === "number") ? params.angleSpeed : 1.0;
  // energyに応じて可変
  let baseA = map(energy, 0, 255, 80, 340) * intensityGain;
  let baseB = map(energy, 0, 255, 60, 240) * intensityGain;
  let waviness = map(energy, 0, 255, 5, 50) * intensityGain;
  let waveCount = 2 + floor(map(energy, 0, 255, 2, 8));
  let detail = 2 + floor(map(energy, 0, 255, 1, 4));

  for (let d = 0; d < detail; d++) {
    beginShape();

    for (let t = 0; t <= TWO_PI + 0.05; t += 0.05) {
      let a = baseA + sin(t * waveCount + time * 1.5 * angleSpeed + d) * waviness;
      let b = baseB + cos(t * waveCount + time * 1.4 * angleSpeed + d) * (waviness * 0.7);
      let x = (a + noise(t + d * 0.3 + time) * 10) * cos(t);
      let y = (b + noise(t + d * 0.5 + time + 100) * 10) * sin(t);
      curveVertex(x, y);
    }

    endShape(CLOSE);
  }
}

function drawRotatingWaves(energy, frameCount, time, style) {
  let c = style.color;
  c.setAlpha(style.alpha);
  stroke(c);
  strokeWeight(style.weight);
  let rot = map(energy, 0, 255, 0, PI / 2) + frameCount * 0.01;
  rotate(rot);
  let baseRadius = map(energy, 0, 255, 60, 320);
  let detail = floor(map(energy, 0, 255, 3, 14));
  let innerRadius = map(energy, 0, 255, 20, 100);
  noFill();
  beginShape();

  for (let i = 0; i < detail + 2; i++) {
    let angle = map(i, 0, detail + 1, 0, TWO_PI) + frameCount * 0.03;
    let radius = baseRadius + sin(frameCount * 0.1 + i) * 30;
    let x = (random(2, 20)) * cos(angle) + radius * cos(angle);
    let y = (random(2, 20)) * sin(angle) + radius * sin(angle);
    curveVertex(x, y);
  }

  endShape(CLOSE);
}

function drawRadialLines(energy, frameCount, time, style) {
  let c = style.color;
  c.setAlpha(style.alpha);
  stroke(c);
  strokeWeight(style.weight);
  noFill();
  let rot = map(energy, 0, 255, 0, PI) + frameCount * 0.05;
  rotate(rot);
  let detail = floor(map(energy, 0, 255, 2, 12));

  for (let i = 0; i < detail; i++) {
    let minRadius = 40;
    let angle = random(TWO_PI);
    let x1 = cos(angle) * random(minRadius, minRadius + 30);
    let y1 = sin(angle) * random(minRadius, minRadius + 30);
    let x2 = x1 + cos(angle) * random(20, 100);
    let y2 = y1 + sin(angle) * random(-20, 20);
    line(x1, y1, x2, y2);
  }
}

function drawExpandingDots(energy, frameCount, time, style) {
  let c = style.color;
  c.setAlpha(style.alpha);
  stroke(c);
  strokeWeight(style.weight);
  noFill();
  let rot = map(energy, 0, 255, 0, PI / 2) + time * 0.2;
  rotate(rot);
  let ringCount = 1 + floor(map(energy, 0, 255, 1, 6));

  for (let r = 0; r < ringCount; r++) {
    let radius = map(energy, 0, 255, 20, 180) + r * 10;
    let dotCount = floor(TWO_PI * radius / 14);

    for (let i = 0; i < dotCount; i++) {
      let angle = (TWO_PI / dotCount) * i;
      let x = cos(angle) * radius;
      let y = sin(angle) * radius;
      strokeWeight(random(0.5, 1.5));
      point(x, y);
    }
  }
}

function drawRadiantBeams(energy, frameCount, time, style) {
  let c = style.color;
  c.setAlpha(style.alpha);
  stroke(c);
  strokeWeight(style.weight);
  noFill();
  let rot = map(energy, 0, 255, 0, PI) + time * 1.2;
  rotate(rot);
  let rays = 6 + floor(map(energy, 0, 255, 2, 20));
  let baseLen = map(energy, 0, 255, 80, 340);
  let detail = floor(map(energy, 0, 255, 1, 4));
  let innerRadius = map(energy, 0, 255, 20, 100);

  for (let d = 0; d < detail; d++) {
    for (let i = 0; i < rays; i++) {
      let angle = (TWO_PI / rays) * i + time * 1.2 + d * 0.2;
      let len = baseLen + sin(time * 2 + i + d) * 30 + random(-10, 10);
      let x1 = cos(angle) * innerRadius;
      let y1 = sin(angle) * innerRadius;
      let x2 = cos(angle) * len;
      let y2 = sin(angle) * len;
      line(x1, y1, x2, y2);
    }
  }
}

function drawSparks(energy, frameCount, time, style) {
  let c = style.color;
  c.setAlpha(style.alpha);
  stroke(c);
  strokeWeight(style.weight);
  noFill();
  let rot = map(energy, 0, 255, 0, PI / 2) + frameCount * 0.1;
  rotate(rot);
  let sparkCount = floor(map(energy, 0, 255, 3, 20));
  let maxLength = map(energy, 0, 255, 20, 120);
  let detail = floor(map(energy, 0, 255, 1, 4));
  let minRadius = 20;

  for (let d = 0; d < detail; d++) {
    for (let i = 0; i < sparkCount; i++) {
      let angle = (TWO_PI / sparkCount) * i + frameCount * 0.1 + d * 0.13;
      let x1 = cos(angle) * random(minRadius, minRadius + 30);
      let y1 = sin(angle) * random(minRadius, minRadius + 30);
      let x2 = x1 + cos(angle) * random(maxLength * 0.5, maxLength);
      let y2 = y1 + sin(angle) * random(maxLength * 0.5, maxLength);
      line(x1, y1, x2, y2);
    }
  }
}

function drawNoisyContours(energy, frameCount, time, style) {
  let c = style.color;
  c.setAlpha(style.alpha);
  stroke(c);
  strokeWeight(style.weight);
  noFill();
  let rot = map(energy, 0, 255, 0, PI / 2) + time * 0.2;
  rotate(rot);
  let noiseFactor = map(energy, 0, 255, 10, 120);
  let baseRadius = map(energy, 0, 255, 40, 260);
  let layerCount = 2 + floor(map(energy, 0, 255, 1, 4));

  for (let j = 0; j < layerCount; j++) {
    beginShape();
    let angleOffset = time * 0.5 + j * 0.5;

    for (let i = 0; i < TWO_PI; i += random(0.08, 0.15)) {
      let r = baseRadius + (noise(i * 5 + angleOffset) - 0.5) * noiseFactor + j * 3;
      let x = r * cos(i);
      let y = r * sin(i);
      vertex(x, y);
    }

    endShape(CLOSE);
  }
}

function drawFloatingDots(energy, frameCount, time, style) {
  let c = style.color;
  c.setAlpha(style.alpha);
  stroke(c);
  strokeWeight(style.weight);
  let count = floor(map(energy, 0, 255, 10, 100));
  let detail = floor(map(energy, 0, 255, 1, 4));
  let rot = map(energy, 0, 255, 0, PI * 2) * 0.3;
  rotate(rot);

  for (let d = 0; d < detail; d++) {
    for (let i = 0; i < count; i++) {
      let angle = random(TWO_PI);
      let radius = random(200, 350) + random(-30, 30);
      let x = radius * cos(angle);
      let y = radius * sin(angle);
      point(x, y);
    }
  }
}

// --- 関数マッピングは関数定義の後に行う ---
let drawFunctionMap = {
  drawSmoothEllipse: { func: drawSmoothEllipse, defaultWeight: 0.4 },
  drawRotatingWaves: { func: drawRotatingWaves, defaultWeight: 1.5 },
  drawRadialLines: { func: drawRadialLines, defaultWeight: 1.2 },
  drawExpandingDots: { func: drawExpandingDots, defaultWeight: 0.8 },
  drawRadiantBeams: { func: drawRadiantBeams, defaultWeight: 2.0 },
  drawSparks: { func: drawSparks, defaultWeight: 1.8 },
  drawNoisyContours: { func: drawNoisyContours, defaultWeight: 0.6 },
  drawFloatingDots: { func: drawFloatingDots, defaultWeight: 1.0 }
}



// --- Spectrum Ring (8-band colored) 描画関数 ---
function drawSpectrumRingByBands(spectrum) {
  noFill();
  let totalBands = spectrum.length;

  const bands = [
    { name: "subBass", fromHz: 20, toHz: 60, color: subBassColorPicker.color() },
    { name: "low", fromHz: 60, toHz: 140, color: lowColorPicker.color() },
    { name: "lowMid", fromHz: 140, toHz: 400, color: lowMidColorPicker.color() },
    { name: "mid", fromHz: 400, toHz: 1000, color: midColorPicker.color() },
    { name: "upperMid", fromHz: 1000, toHz: 3000, color: upperMidColorPicker.color() },
    { name: "presence", fromHz: 3000, toHz: 6000, color: presenceColorPicker.color() },
    { name: "brilliance", fromHz: 6000, toHz: 16000, color: brillianceColorPicker.color() },
    { name: "high", fromHz: 16000, toHz: 22050, color: highColorPicker.color() }
  ];

  for (let band of bands) {
    let startIndex = floor(map(band.fromHz, 0, 22050, 0, totalBands));
    let endIndex = floor(map(band.toHz, 0, 22050, 0, totalBands));

    stroke(band.color);
    strokeWeight(1);
    beginShape();
    for (let i = startIndex; i < endIndex; i++) {
      let angle = map(i, 0, totalBands, 0, TWO_PI);
      // Breathing + Perlin noise deformation
      let baseRadius = map(spectrum[i], 0, 255, 60, 280);
      let breathing = sin(frameCount * 0.05 + angle) * 8;
      let jitter = noise(angle + frameCount * 0.01) * 10;
      let radius = baseRadius + breathing + jitter;
      let x = cos(angle) * radius;
      let y = sin(angle) * radius;
      vertex(x, y);
    }
    endShape();
  }
}


// --- 各音域の描画スタイルセレクタ changed イベント登録: setup()の末尾に移動 ---

// --- 各音域の描画スタイルセレクタ changed イベント登録 ---
if (subBassDrawSelector) {
  subBassDrawSelector.changed(() => {
    const selectedKey = subBassDrawSelector.value();
    const selected = drawFunctionMap[selectedKey];
    if (selected && typeof selected.defaultWeight === "number") {
      subBassStrokeSlider.value(selected.defaultWeight);
    }
  });
}
if (lowDrawSelector) {
  lowDrawSelector.changed(() => {
    const selectedKey = lowDrawSelector.value();
    const selected = drawFunctionMap[selectedKey];
    if (selected && typeof selected.defaultWeight === "number") {
      lowStrokeSlider.value(selected.defaultWeight);
    }
  });
}
if (lowMidDrawSelector) {
  lowMidDrawSelector.changed(() => {
    const selectedKey = lowMidDrawSelector.value();
    const selected = drawFunctionMap[selectedKey];
    if (selected && typeof selected.defaultWeight === "number") {
      lowMidStrokeSlider.value(selected.defaultWeight);
    }
  });
}
if (midDrawSelector) {
  midDrawSelector.changed(() => {
    const selectedKey = midDrawSelector.value();
    const selected = drawFunctionMap[selectedKey];
    if (selected && typeof selected.defaultWeight === "number") {
      midStrokeSlider.value(selected.defaultWeight);
    }
  });
}
if (upperMidDrawSelector) {
  upperMidDrawSelector.changed(() => {
    const selectedKey = upperMidDrawSelector.value();
    const selected = drawFunctionMap[selectedKey];
    if (selected && typeof selected.defaultWeight === "number") {
      upperMidStrokeSlider.value(selected.defaultWeight);
    }
  });
}
if (presenceDrawSelector) {
  presenceDrawSelector.changed(() => {
    const selectedKey = presenceDrawSelector.value();
    const selected = drawFunctionMap[selectedKey];
    if (selected && typeof selected.defaultWeight === "number") {
      presenceStrokeSlider.value(selected.defaultWeight);
    }
  });
}
if (brillianceDrawSelector) {
  brillianceDrawSelector.changed(() => {
    const selectedKey = brillianceDrawSelector.value();
    const selected = drawFunctionMap[selectedKey];
    if (selected && typeof selected.defaultWeight === "number") {
      brillianceStrokeSlider.value(selected.defaultWeight);
    }
  });
}
if (highDrawSelector) {
  highDrawSelector.changed(() => {
    const selectedKey = highDrawSelector.value();
    const selected = drawFunctionMap[selectedKey];
    if (selected && typeof selected.defaultWeight === "number") {
      highStrokeSlider.value(selected.defaultWeight);
    }
  });
}