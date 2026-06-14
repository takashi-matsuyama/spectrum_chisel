// Control-panel UI construction and visibility toggling.

import { state, uiComponents } from './state.js';
import { BAND_CONFIG } from './core/bands.js';
import { defaultBandColor } from './core/colors.js';
import { drawFunctionMap } from './drawing/styles.js';
import { downloadSVG, savePreset, loadPreset, generateTimestampedFilename } from './export.js';
import { stopAndReset } from './audio.js';
import { openViewer } from './broadcast.js';
import { t } from './i18n/index.js';

export function toggleUIVisibility() {
  state.uiVisible = !state.uiVisible;
  const soundControls = select('#sound-controls');
  if (state.uiVisible) {
    state.uiPanel.removeClass('hidden');
    soundControls.removeClass('hidden');
  } else {
    state.uiPanel.addClass('hidden');
    soundControls.addClass('hidden');
  }
}

export function createUI() {
  // Appearance lives in .ui-panel (assets/css/style.css); only structure and
  // behavior are set here.
  state.uiPanel = createDiv();
  state.uiPanel.parent('ui-container');
  state.uiPanel.addClass('ui-panel');

  const createSliderWithLabel = (label, min, max, initial, step, parentEl) => {
    let container = createDiv(label + ': ').parent(parentEl);
    let slider = createSlider(min, max, initial, step).parent(container).addClass('ui-slider');
    let valueSpan = createSpan(initial).parent(container).addClass('ui-value');
    slider.input(() => valueSpan.html(slider.value()));
    return slider;
  };

  createDiv(t('controls')).parent(state.uiPanel).addClass('ui-section-title');
  const saveButton = createButton(t('saveSvg')).parent(state.uiPanel);
  saveButton.mousePressed(downloadSVG);
  const pngButton = createButton(t('savePng')).parent(state.uiPanel);
  pngButton.mousePressed(() => {
    const fileName = generateTimestampedFilename('png');
    saveCanvas(fileName);
  });
  const clearButton = createButton(t('clearCanvas')).parent(state.uiPanel);
  clearButton.mousePressed(stopAndReset);
  const toggleUiButton = createButton(t('toggleUi')).parent(state.uiPanel);
  toggleUiButton.mousePressed(toggleUIVisibility);
  const viewerButton = createButton(t('openViewer')).parent(state.uiPanel);
  viewerButton.mousePressed(openViewer);

  const presetDiv = createDiv().parent(state.uiPanel);
  const savePresetButton = createButton(t('savePreset')).parent(presetDiv);
  savePresetButton.mousePressed(savePreset);
  const loadPresetButton = createButton(t('loadPreset')).parent(presetDiv);
  loadPresetButton.mousePressed(loadPreset);

  createDiv(t('drawingMode')).parent(state.uiPanel).addClass('ui-section-title');
  uiComponents.sculptureModeCheckbox = createCheckbox(t('sculptureMode'), false).parent(state.uiPanel);

  createDiv('Frame Rate').parent(state.uiPanel).addClass('ui-section-title');
  state.frameRateSlider = createSlider(1, 60, 15, 1).parent(state.uiPanel);
  const frameRateValueSpan = createSpan(state.frameRateSlider.value())
    .parent(state.frameRateSlider.parent())
    .addClass('ui-value');
  state.frameRateSlider.input(() => frameRateValueSpan.html(state.frameRateSlider.value()));

  const spectrumDiv = createDiv(t('spectrumLayers')).parent(state.uiPanel).addClass('ui-section-title');

  state.spectrumRingCheckbox = createCheckbox(t('drawSpectrumRing'), true).parent(spectrumDiv);
  const ringControls = createDiv().parent(spectrumDiv).addClass('ui-subcontrols');
  uiComponents.ring = {
    gainSlider: createSliderWithLabel('Gain', 0.1, 10.0, 1.0, 0.1, ringControls),
    thresholdSlider: createSliderWithLabel('Threshold', 0, 255, 30, 1, ringControls),
  };

  state.spectrumDiffCheckbox = createCheckbox(t('drawSpectrumDiff'), true).parent(spectrumDiv);
  const diffControls = createDiv().parent(spectrumDiv).addClass('ui-subcontrols');
  state.spectrumDiffColorPicker = createColorPicker('#ffffff').parent(diffControls);
  uiComponents.diff = {
    gainSlider: createSliderWithLabel('Gain', 0.1, 10.0, 1.0, 0.1, diffControls),
    thresholdSlider: createSliderWithLabel('Threshold', 0, 255, 15, 1, diffControls),
    colorPicker: state.spectrumDiffColorPicker,
  };

  // Default per-band energy mapping (identical across bands; kept as a single
  // constant so it does not need to track the band list).
  const DEFAULT_BAND_ENERGY = { gain: 1.0, threshold: 100 };

  BAND_CONFIG.forEach((band) => {
    let name = band.name;
    let title = `${name.charAt(0).toUpperCase() + name.slice(1)} (${band.freq[0]} - ${band.freq[1]} Hz)`;
    const section = createDiv(title).parent(state.uiPanel).addClass('ui-section-title');

    uiComponents[name] = {};

    uiComponents[name].enabledCheckbox = createCheckbox(t('enabled'), true).parent(section);
    uiComponents[name].colorPicker = createColorPicker(defaultBandColor(name)).parent(section);
    const drawSelector = createSelect().parent(section);
    for (let key in drawFunctionMap) {
      drawSelector.option(key);
    }
    drawSelector.selected(band.defFunc);
    uiComponents[name].drawSelector = drawSelector;
    const defaultWeight = drawFunctionMap[band.defFunc].defaultWeight;
    uiComponents[name].strokeSlider = createSliderWithLabel('Stroke', 0.1, 5, defaultWeight, 0.1, section);
    uiComponents[name].alphaSlider = createSliderWithLabel('Alpha', 0, 255, 20, 1, section);
    uiComponents[name].gainSlider = createSliderWithLabel('Gain', 0.1, 5.0, DEFAULT_BAND_ENERGY.gain, 0.01, section);
    uiComponents[name].thresholdSlider = createSliderWithLabel('Threshold', 0, 255, DEFAULT_BAND_ENERGY.threshold, 1, section);
    uiComponents[name].intensityGainSlider = createSliderWithLabel('IntensityGain', 0.0, 5.0, 1.0, 0.01, section);
    uiComponents[name].angleSpeedSlider = createSliderWithLabel('AngleSpeed', 0.0, 5.0, 1.0, 0.01, section);

    drawSelector.changed(() => {
      const selectedKey = drawSelector.value();
      const newWeight = drawFunctionMap[selectedKey].defaultWeight;
      uiComponents[name].strokeSlider.value(newWeight);
    });
  });
}
