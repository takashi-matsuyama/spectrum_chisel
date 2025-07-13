let fft,
  mic;

// --- UI要素のグローバル変数宣言 ---

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
  let myCanvas = createCanvas(800, 800, SVG);
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
  uiElements.push(subBassAlphaSlider);
  // SubBass描画関数切り替えセレクタ
  subBassDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) subBassDrawSelector.option(key);
  subBassDrawSelector.selected("drawExpandingDots");
  uiElements.push(subBassDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  subBassStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawExpandingDots"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(subBassStrokeSlider);
  // --- SubBass用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  subBassGainSlider = createSlider(0.1, 5.0, energySettings["subBass"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(subBassGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  subBassThresholdSlider = createSlider(0, 255, energySettings["subBass"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(subBassThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  subBassIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(subBassIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  subBassAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(subBassAngleSpeedSlider);

  // 2. Low
  createDiv('Low Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  lowColorPicker = createColorPicker(randomColors[0]).parent(uiPanel);
  uiElements.push(lowColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  lowAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowAlphaSlider);
  // lowEnergy 描画関数切り替えセレクタ
  lowDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) lowDrawSelector.option(key);
  lowDrawSelector.selected("drawSmoothEllipse");
  uiElements.push(lowDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  lowStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawSmoothEllipse"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowStrokeSlider);
  // --- Low用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowGainSlider = createSlider(0.1, 5.0, energySettings["low"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowThresholdSlider = createSlider(0, 255, energySettings["low"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowThresholdSlider);
  // intensityGain
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowIntensityGainSlider);
  // angleSpeed
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowAngleSpeedSlider);

  // 3. LowMid
  createDiv('LowMid Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  lowMidColorPicker = createColorPicker(randomColors[6]).parent(uiPanel);
  uiElements.push(lowMidColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  lowMidAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowMidAlphaSlider);
  // LowMid描画関数切り替えセレクタ
  lowMidDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) lowMidDrawSelector.option(key);
  lowMidDrawSelector.selected("drawNoisyContours");
  uiElements.push(lowMidDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  lowMidStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawNoisyContours"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowMidStrokeSlider);
  // --- LowMid用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowMidGainSlider = createSlider(0.1, 5.0, energySettings["lowMid"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowMidGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowMidThresholdSlider = createSlider(0, 255, energySettings["lowMid"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowMidThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowMidIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowMidIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  lowMidAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(lowMidAngleSpeedSlider);

  // 4. Mid
  createDiv('Mid Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  midColorPicker = createColorPicker(randomColors[1]).parent(uiPanel);
  uiElements.push(midColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  midAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(midAlphaSlider);
  // Mid描画関数切り替えセレクタ
  midDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) midDrawSelector.option(key);
  midDrawSelector.selected("drawRotatingWaves");
  uiElements.push(midDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  midStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawRotatingWaves"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(midStrokeSlider);
  // --- Mid用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  midGainSlider = createSlider(0.1, 5.0, energySettings["mid"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(midGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  midThresholdSlider = createSlider(0, 255, energySettings["mid"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(midThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  midIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(midIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  midAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(midAngleSpeedSlider);

  // 5. UpperMid
  createDiv('UpperMid Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  upperMidColorPicker = createColorPicker(randomColors[7]).parent(uiPanel);
  uiElements.push(upperMidColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  upperMidAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(upperMidAlphaSlider);
  // UpperMid描画関数切り替えセレクタ
  upperMidDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) upperMidDrawSelector.option(key);
  upperMidDrawSelector.selected("drawFloatingDots");
  uiElements.push(upperMidDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  upperMidStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawFloatingDots"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(upperMidStrokeSlider);
  // --- UpperMid用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  upperMidGainSlider = createSlider(0.1, 5.0, energySettings["upperMid"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(upperMidGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  upperMidThresholdSlider = createSlider(0, 255, energySettings["upperMid"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(upperMidThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  upperMidIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(upperMidIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  upperMidAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(upperMidAngleSpeedSlider);

  // 6. Presence
  createDiv('Presence Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  presenceColorPicker = createColorPicker(randomColors[5]).parent(uiPanel);
  uiElements.push(presenceColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  presenceAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(presenceAlphaSlider);
  // Presence描画関数切り替えセレクタ
  presenceDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) presenceDrawSelector.option(key);
  presenceDrawSelector.selected("drawSparks");
  uiElements.push(presenceDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  presenceStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawSparks"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(presenceStrokeSlider);
  // --- Presence用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  presenceGainSlider = createSlider(0.1, 5.0, energySettings["presence"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(presenceGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  presenceThresholdSlider = createSlider(0, 255, energySettings["presence"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(presenceThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  presenceIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(presenceIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  presenceAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(presenceAngleSpeedSlider);

  // 7. Brilliance
  createDiv('Brilliance Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  brillianceColorPicker = createColorPicker(randomColors[4]).parent(uiPanel);
  uiElements.push(brillianceColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  brillianceAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(brillianceAlphaSlider);
  // Brilliance描画関数切り替えセレクタ
  brillianceDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) brillianceDrawSelector.option(key);
  brillianceDrawSelector.selected("drawRadiantBeams");
  uiElements.push(brillianceDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  brillianceStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawRadiantBeams"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(brillianceStrokeSlider);
  // --- Brilliance用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  brillianceGainSlider = createSlider(0.1, 5.0, energySettings["brilliance"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(brillianceGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  brillianceThresholdSlider = createSlider(0, 255, energySettings["brilliance"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(brillianceThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  brillianceIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(brillianceIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  brillianceAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(brillianceAngleSpeedSlider);

  // 8. High
  createDiv('High Energy').parent(uiPanel).addClass('ui-section-title').style('color', 'white');
  highColorPicker = createColorPicker(randomColors[2]).parent(uiPanel);
  uiElements.push(highColorPicker);
  createSpan('Alpha').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  highAlphaSlider = createSlider(0, 255, 20, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(highAlphaSlider);
  // High描画関数切り替えセレクタ
  highDrawSelector = createSelect().parent(uiPanel);
  for (let key in drawFunctionMap) highDrawSelector.option(key);
  highDrawSelector.selected("drawRadialLines");
  uiElements.push(highDrawSelector);
  createSpan('Stroke').parent(uiPanel).addClass('ui-section-title').style('font-weight', 'normal').style('color', 'white');
  highStrokeSlider = createSlider(0.1, 5, drawFunctionMap["drawRadialLines"].defaultWeight, 0.1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(highStrokeSlider);
  // --- High用追加スライダー ---
  // gain
  createSpan('Gain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  highGainSlider = createSlider(0.1, 5.0, energySettings["high"].gain, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(highGainSlider);
  // threshold
  createSpan('Threshold').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  highThresholdSlider = createSlider(0, 255, energySettings["high"].threshold, 1).parent(uiPanel).addClass('ui-slider');
  uiElements.push(highThresholdSlider);
  createSpan('IntensityGain').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  highIntensityGainSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(highIntensityGainSlider);
  createSpan('AngleSpeed').parent(uiPanel).style('color', 'white').style('margin-left', '10px');
  highAngleSpeedSlider = createSlider(0.0, 5.0, 1.0, 0.01).parent(uiPanel).addClass('ui-slider');
  uiElements.push(highAngleSpeedSlider);

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

  frameRate(10); // フレームレートを10fpsに設定。描画負荷軽減や視覚的なスムーズさの調整に影響
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

  // 変更点3: 入力ソースに応じた準備完了チェック
  if (useMic) {
    if (!mic || !mic.enabled) return; // マイクが準備できていなければ処理を中断
    console.log("Using microphone input.");
  }

  else {
    // 将来的な拡張のために音声ファイル入力の条件を残している
    // 現状はマイク入力のみなのでこの分岐は実質使われない
    console.log("Using sound input.");
  }

  if (!fft) return; // FFTが準備できていなければ処理を中断

  // fft.analyze()は現在の音声信号の周波数スペクトルを配列で返す
  // 配列の各要素は特定の周波数帯のエネルギー量（音の強さ）を表す
  let spectrum = fft.analyze();

  // 全周波数帯のエネルギーの合計を計算し、音の総エネルギーの指標とする
  let totalEnergy = spectrum.reduce((a, b) => a + b, 0);

  // 音の総エネルギーが閾値未満なら描画しない（ノイズ除去や無音時の無駄な描画防止）
  // マイク入力は感度が高いため閾値を低く設定
  // 将来的な拡張のために条件を残している
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

  // frameCountは描画フレーム数の累積。時間経過に応じた変化を作るために使用
  // 0.005の係数は変化速度を調整。小さいほどゆっくり動く
  let time = frameCount * 0.005;

  translate(width / 2, height / 2);

  // --- 関数化した音域描画 ---
  // SubBass
  if (subBassEnabledCheckbox && subBassEnabledCheckbox.checked()) {
    push();

    {
      let energyValue = subBassEnergy;
      let OFFSET = 4;
      let baseAmount = 14;
      let intensity = map(energyValue, 0, 255, 0, 1);
      let dx = (noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      console.log("OFFSET subBassEnergy:", dx, dy);
      translate(dx, dy);

      const style = {
        color: subBassColorPicker.color(),
        weight: subBassStrokeSlider.value(),
        alpha: subBassAlphaSlider.value()
      }

        ;
      const selectedFuncName = subBassDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      // gain/threshold UI値を取得
      let gain = subBassGainSlider.value();
      let threshold = subBassThresholdSlider.value();
      let scaledEnergy = constrain(subBassEnergy * gain, 0, 255);

      // --- paramsオブジェクトでintensityGain, angleSpeedを渡す ---
      const params = {
        intensityGain: subBassIntensityGainSlider.value(),
        angleSpeed: subBassAngleSpeedSlider.value()
      }

        ;

      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func(scaledEnergy, frameCount, time, style, params);
      }
    }

    pop();
  }

  // Low
  if (lowEnabledCheckbox && lowEnabledCheckbox.checked()) {
    push();

    {
      let energyValue = lowEnergy;
      // --- 新UIスライダーで値取得 ---
      let gain = lowGainSlider.value();
      let threshold = lowThresholdSlider.value();
      let intensityGain = lowIntensityGainSlider.value();
      let angleSpeed = lowAngleSpeedSlider.value();
      let baseAmount = 12;
      let intensity = map(energyValue, 0, 255, 0, 1);
      let angle = frameCount * 0.02;
      let dx = sin(angle + time) * baseAmount * intensity;
      let dy = cos(angle + time * 1.5) * baseAmount * intensity;
      console.log("OFFSET lowEnergy:", dx, dy);
      translate(dx, dy);

      const style = {
        color: lowColorPicker.color(),
        weight: lowStrokeSlider.value(),
        alpha: lowAlphaSlider.value()
      }

        ;
      const selectedFuncName = lowDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      // energy 計算に gain/threshold を反映
      let scaledEnergy = constrain(lowEnergy * gain, 0, 255);

      // --- paramsオブジェクトでintensityGain, angleSpeedを渡す ---
      const params = {
        intensityGain: intensityGain,
        angleSpeed: angleSpeed
      }

        ;

      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func(scaledEnergy, frameCount, time, style, params);
      }
    }

    pop();
  }

  // LowMid
  if (lowMidEnabledCheckbox && lowMidEnabledCheckbox.checked()) {
    push();

    {
      let energyValue = lowMidEnergy;
      let OFFSET = 7;
      let baseAmount = 11;
      let intensity = map(energyValue, 0, 255, 0, 1);
      let dx = (noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      console.log("OFFSET lowMidEnergy:", dx, dy);
      translate(dx, dy);

      const style = {
        color: lowMidColorPicker.color(),
        weight: lowMidStrokeSlider.value(),
        alpha: lowMidAlphaSlider.value()
      }

        ;
      const selectedFuncName = lowMidDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      // gain/threshold UI値を取得
      let gain = lowMidGainSlider.value();
      let threshold = lowMidThresholdSlider.value();
      let scaledEnergy = constrain(lowMidEnergy * gain, 0, 255);

      // --- paramsオブジェクトでintensityGain, angleSpeedを渡す ---
      const params = {
        intensityGain: lowMidIntensityGainSlider.value(),
        angleSpeed: lowMidAngleSpeedSlider.value()
      }

        ;

      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func(scaledEnergy, frameCount, time, style, params);
      }
    }

    pop();
  }

  // Mid
  if (midEnabledCheckbox && midEnabledCheckbox.checked()) {
    push();

    {
      let energyValue = midEnergy;
      let OFFSET = 2;
      let baseAmount = 10;
      let intensity = map(energyValue, 0, 255, 0, 1);
      let dx = (noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      console.log("OFFSET midEnergy:", dx, dy);
      translate(dx, dy);

      const style = {
        color: midColorPicker.color(),
        weight: midStrokeSlider.value(),
        alpha: midAlphaSlider.value()
      }

        ;
      const selectedFuncName = midDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      // gain/threshold UI値を取得
      let gain = midGainSlider.value();
      let threshold = midThresholdSlider.value();
      let scaledEnergy = constrain(midEnergy * gain, 0, 255);

      // --- paramsオブジェクトでintensityGain, angleSpeedを渡す ---
      const params = {
        intensityGain: midIntensityGainSlider.value(),
        angleSpeed: midAngleSpeedSlider.value()
      }

        ;

      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func(scaledEnergy, frameCount, time, style, params);
      }
    }

    pop();
  }

  // UpperMid
  if (upperMidEnabledCheckbox && upperMidEnabledCheckbox.checked()) {
    push();

    {
      let energyValue = upperMidEnergy;
      let OFFSET = 8;
      let baseAmount = 13;
      let intensity = map(energyValue, 0, 255, 0, 1);
      let dx = (noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      console.log("OFFSET upperMidEnergy:", dx, dy);
      translate(dx, dy);

      const style = {
        color: upperMidColorPicker.color(),
        weight: upperMidStrokeSlider.value(),
        alpha: upperMidAlphaSlider.value()
      }

        ;
      const selectedFuncName = upperMidDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      // gain/threshold UI値を取得
      let gain = upperMidGainSlider.value();
      let threshold = upperMidThresholdSlider.value();
      let scaledEnergy = constrain(upperMidEnergy * gain, 0, 255);

      // --- paramsオブジェクトでintensityGain, angleSpeedを渡す ---
      const params = {
        intensityGain: upperMidIntensityGainSlider.value(),
        angleSpeed: upperMidAngleSpeedSlider.value()
      }

        ;

      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func(scaledEnergy, frameCount, time, style, params);
      }
    }

    pop();
  }

  // Presence
  if (presenceEnabledCheckbox && presenceEnabledCheckbox.checked()) {
    push();

    {
      let energyValue = presenceEnergy;
      let OFFSET = 6;
      let baseAmount = 18;
      let intensity = map(energyValue, 0, 255, 0, 1);
      let dx = (noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      console.log("OFFSET presenceEnergy:", dx, dy);
      translate(dx, dy);

      const style = {
        color: presenceColorPicker.color(),
        weight: presenceStrokeSlider.value(),
        alpha: presenceAlphaSlider.value()
      }

        ;
      const selectedFuncName = presenceDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      // gain/threshold UI値を取得
      let gain = presenceGainSlider.value();
      let threshold = presenceThresholdSlider.value();
      let scaledEnergy = constrain(presenceEnergy * gain, 0, 255);

      // --- paramsオブジェクトでintensityGain, angleSpeedを渡す ---
      const params = {
        intensityGain: presenceIntensityGainSlider.value(),
        angleSpeed: presenceAngleSpeedSlider.value()
      }

        ;

      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func(scaledEnergy, frameCount, time, style, params);
      }
    }

    pop();
  }

  // Brilliance
  if (brillianceEnabledCheckbox && brillianceEnabledCheckbox.checked()) {
    push();

    {
      let energyValue = brillianceEnergy;
      let OFFSET = 5;
      let baseAmount = 20;
      let intensity = map(energyValue, 0, 255, 0, 1);
      let dx = (noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      console.log("OFFSET brillianceEnergy:", dx, dy);
      translate(dx, dy);

      const style = {
        color: brillianceColorPicker.color(),
        weight: brillianceStrokeSlider.value(),
        alpha: brillianceAlphaSlider.value()
      }

        ;
      const selectedFuncName = brillianceDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      // gain/threshold UI値を取得
      let gain = brillianceGainSlider.value();
      let threshold = brillianceThresholdSlider.value();
      let scaledEnergy = constrain(brillianceEnergy * gain, 0, 255);

      // --- paramsオブジェクトでintensityGain, angleSpeedを渡す ---
      const params = {
        intensityGain: brillianceIntensityGainSlider.value(),
        angleSpeed: brillianceAngleSpeedSlider.value()
      }

        ;

      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func(scaledEnergy, frameCount, time, style, params);
      }
    }

    pop();
  }

  // High
  if (highEnabledCheckbox && highEnabledCheckbox.checked()) {
    push();

    {
      let energyValue = highEnergy;
      let OFFSET = 3;
      let baseAmount = 16;
      let intensity = map(energyValue, 0, 255, 0, 1);
      let dx = (noise(time + OFFSET) - 0.5) * baseAmount * intensity;
      let dy = (noise(time + OFFSET + 100) - 0.5) * baseAmount * intensity;
      console.log("OFFSET highEnergy:", dx, dy);
      translate(dx, dy);

      const style = {
        color: highColorPicker.color(),
        weight: highStrokeSlider.value(),
        alpha: highAlphaSlider.value()
      }

        ;
      const selectedFuncName = highDrawSelector.value();
      const selectedEntry = drawFunctionMap[selectedFuncName];
      // gain/threshold UI値を取得
      let gain = highGainSlider.value();
      let threshold = highThresholdSlider.value();
      let scaledEnergy = constrain(highEnergy * gain, 0, 255);

      // --- paramsオブジェクトでintensityGain, angleSpeedを渡す ---
      const params = {
        intensityGain: highIntensityGainSlider.value(),
        angleSpeed: highAngleSpeedSlider.value()
      }

        ;

      if (selectedEntry && selectedEntry.func && scaledEnergy > threshold) {
        selectedEntry.func(scaledEnergy, frameCount, time, style, params);
      }
    }

    pop();
  }
}

function keyPressed() {

  // 's'キーが押されたらSVG保存
  if (key === 's' || key === 'S') {
    save("sound_spatial_composition.svg");
    // PNG保存もしたい場合は下記コメントアウト解除
    // save("sound_spatial_composition.png");
    // noLoop();
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

// --- 各セレクタにchangedイベントを追加し、選択時にストローク値をdefaultWeightに更新 ---
subBassDrawSelector.changed(() => {
  const selected = drawFunctionMap[subBassDrawSelector.value()];
  if (selected && typeof selected.defaultWeight === "number") {
    subBassStrokeSlider.value(selected.defaultWeight);
  }
});
subBassDrawSelector.selected("drawExpandingDots").changed();

lowDrawSelector.changed(() => {
  const selected = drawFunctionMap[lowDrawSelector.value()];
  if (selected && typeof selected.defaultWeight === "number") {
    lowStrokeSlider.value(selected.defaultWeight);
  }
});
lowDrawSelector.selected("drawSmoothEllipse").changed();

lowMidDrawSelector.changed(() => {
  const selected = drawFunctionMap[lowMidDrawSelector.value()];
  if (selected && typeof selected.defaultWeight === "number") {
    lowMidStrokeSlider.value(selected.defaultWeight);
  }
});
lowMidDrawSelector.selected("drawNoisyContours").changed();

midDrawSelector.changed(() => {
  const selected = drawFunctionMap[midDrawSelector.value()];
  if (selected && typeof selected.defaultWeight === "number") {
    midStrokeSlider.value(selected.defaultWeight);
  }
});
midDrawSelector.selected("drawRotatingWaves").changed();

upperMidDrawSelector.changed(() => {
  const selected = drawFunctionMap[upperMidDrawSelector.value()];
  if (selected && typeof selected.defaultWeight === "number") {
    upperMidStrokeSlider.value(selected.defaultWeight);
  }
});
upperMidDrawSelector.selected("drawFloatingDots").changed();

presenceDrawSelector.changed(() => {
  const selected = drawFunctionMap[presenceDrawSelector.value()];
  if (selected && typeof selected.defaultWeight === "number") {
    presenceStrokeSlider.value(selected.defaultWeight);
  }
});
presenceDrawSelector.selected("drawSparks").changed();

brillianceDrawSelector.changed(() => {
  const selected = drawFunctionMap[brillianceDrawSelector.value()];
  if (selected && typeof selected.defaultWeight === "number") {
    brillianceStrokeSlider.value(selected.defaultWeight);
  }
});
brillianceDrawSelector.selected("drawRadiantBeams").changed();

highDrawSelector.changed(() => {
  const selected = drawFunctionMap[highDrawSelector.value()];
  if (selected && typeof selected.defaultWeight === "number") {
    highStrokeSlider.value(selected.defaultWeight);
  }
});
highDrawSelector.selected("drawRadialLines").changed();
