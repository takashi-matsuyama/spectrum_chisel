// Control-panel UI construction (the drawing controls inside the sidebar) and
// the language toggle wiring. Appearance lives in assets/css/style.css; only
// structure and behavior are set here.

import { state, uiComponents } from './state.js';
import { BAND_CONFIG } from './core/bands.js';
import { defaultBandColor } from './core/colors.js';
import { drawFunctionMap } from './drawing/styles.js';
import { downloadSVG, downloadSVGPlates, savePreset, loadPreset, saveRecipe, loadRecipe, generateTimestampedFilename } from './export.js';
import { openViewer } from './broadcast.js';
import { supportedVideoFormat, hasViewerSupport, micUnavailableReason } from './capabilities.js';
import { loadPatternLibrary, attachBandPatternControl, initComposerUI } from './composer.js';
import { t, switchLocale, getLocale, supportedLocales } from './i18n/index.js';

/** Section heading tagged so it re-localizes when the locale changes. */
function sectionTitle(key, parent) {
  return createDiv(t(key)).parent(parent).addClass('ui-section-title').attribute('data-i18n', key);
}

/** Button with a localized, re-translatable label. */
function labeledButton(key, handler, parent) {
  const btn = createButton(t(key)).parent(parent).attribute('data-i18n', key);
  btn.mousePressed(handler);
  return btn;
}

/** Tag a p5 checkbox's label span so it re-localizes on locale switch. */
function tagCheckbox(checkbox, key) {
  const span = checkbox.elt.querySelector('span');
  if (span) span.setAttribute('data-i18n', key);
  return checkbox;
}

/** i18n key for a draw-style's display label, e.g. drawSpiral -> effectSpiral. */
function effectLabelKey(funcKey) {
  return 'effect' + funcKey.replace(/^draw/, '');
}

/** Wire the JA/EN segmented toggle in the sidebar header. */
export function initLanguageToggle() {
  const buttons = Array.from(document.querySelectorAll('.lang-btn'));
  const sync = () => {
    const active = getLocale();
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.lang === active));
  };
  buttons.forEach((b) => {
    if (!supportedLocales().includes(b.dataset.lang)) return;
    b.addEventListener('click', () => {
      switchLocale(b.dataset.lang);
      sync();
    });
  });
  sync();
}

export function createUI() {
  state.uiPanel = createDiv();
  state.uiPanel.parent('ui-container');
  state.uiPanel.addClass('ui-panel');

  // Load the custom-pattern library before the band controls, so each band's
  // pattern picker can list it.
  loadPatternLibrary();

  const createSliderWithLabel = (label, min, max, initial, step, parentEl) => {
    let container = createDiv(label + ': ').parent(parentEl);
    let slider = createSlider(min, max, initial, step).parent(container).addClass('ui-slider');
    let valueSpan = createSpan(initial).parent(container).addClass('ui-value');
    slider.input(() => valueSpan.html(slider.value()));
    return slider;
  };

  // Canvas output + presets.
  sectionTitle('canvasSection', state.uiPanel);
  const canvasRow = createDiv().parent(state.uiPanel);
  labeledButton('saveSvg', downloadSVG, canvasRow);
  labeledButton('savePlates', downloadSVGPlates, canvasRow);
  labeledButton('savePng', () => saveCanvas(generateTimestampedFilename('png')), canvasRow);
  uiComponents.openViewerBtn = labeledButton('openViewer', openViewer, canvasRow);

  sectionTitle('presets', state.uiPanel);
  const presetRow = createDiv().parent(state.uiPanel);
  labeledButton('savePreset', savePreset, presetRow);
  labeledButton('loadPreset', loadPreset, presetRow);
  labeledButton('saveRecipe', saveRecipe, presetRow);
  labeledButton('loadRecipe', loadRecipe, presetRow);

  // Drawing mode + frame rate.
  sectionTitle('drawingMode', state.uiPanel);
  uiComponents.sculptureModeCheckbox = tagCheckbox(
    createCheckbox(t('sculptureMode'), false).parent(state.uiPanel),
    'sculptureMode'
  );

  const frameRateRow = createDiv('Frame Rate: ').parent(state.uiPanel);
  state.frameRateSlider = createSlider(1, 60, 15, 1).parent(frameRateRow).addClass('ui-slider');
  const frameRateValueSpan = createSpan(state.frameRateSlider.value()).parent(frameRateRow).addClass('ui-value');
  state.frameRateSlider.input(() => frameRateValueSpan.html(state.frameRateSlider.value()));

  // Global spectrum layers.
  sectionTitle('spectrumLayers', state.uiPanel);
  state.spectrumRingCheckbox = tagCheckbox(
    createCheckbox(t('drawSpectrumRing'), true).parent(state.uiPanel),
    'drawSpectrumRing'
  );
  const ringControls = createDiv().parent(state.uiPanel).addClass('ui-subcontrols');
  uiComponents.ring = {
    gainSlider: createSliderWithLabel('Gain', 0.1, 10.0, 1.0, 0.1, ringControls),
    thresholdSlider: createSliderWithLabel('Threshold', 0, 255, 30, 1, ringControls),
  };

  state.spectrumDiffCheckbox = tagCheckbox(
    createCheckbox(t('drawSpectrumDiff'), true).parent(state.uiPanel),
    'drawSpectrumDiff'
  );
  const diffControls = createDiv().parent(state.uiPanel).addClass('ui-subcontrols');
  state.spectrumDiffColorPicker = createColorPicker('#ffffff').parent(diffControls);
  uiComponents.diff = {
    gainSlider: createSliderWithLabel('Gain', 0.1, 10.0, 1.0, 0.1, diffControls),
    thresholdSlider: createSliderWithLabel('Threshold', 0, 255, 15, 1, diffControls),
    colorPicker: state.spectrumDiffColorPicker,
  };

  // Per-band controls.
  const DEFAULT_BAND_ENERGY = { gain: 1.0, threshold: 100 };

  sectionTitle('bands', state.uiPanel);
  BAND_CONFIG.forEach((band) => {
    let name = band.name;
    let title = `${name.charAt(0).toUpperCase() + name.slice(1)} (${band.freq[0]} - ${band.freq[1]} Hz)`;
    const section = createDiv(title).parent(state.uiPanel).addClass('ui-section-title');

    uiComponents[name] = {};

    uiComponents[name].enabledCheckbox = tagCheckbox(
      createCheckbox(t('enabled'), true).parent(section),
      'enabled'
    );
    uiComponents[name].colorPicker = createColorPicker(defaultBandColor(name)).parent(section);
    const drawSelector = createSelect().parent(section);
    for (let key in drawFunctionMap) {
      // Show a localized label but keep the function key as the option value
      // (presets serialize the key).
      drawSelector.option(t(effectLabelKey(key)), key);
    }
    // Tag each option so its label re-localizes on a locale switch.
    drawSelector.elt.querySelectorAll('option').forEach((opt) => {
      opt.setAttribute('data-i18n', effectLabelKey(opt.value));
    });
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

    // Optional custom-pattern override for this band (composer-managed).
    attachBandPatternControl(name, section);
  });

  // Custom-pattern composer section (library + editor), after the bands.
  initComposerUI();
}

/**
 * Dim a control whose feature this browser cannot run and explain why via its
 * tooltip / accessible name. The `data-i18n-label` tag re-localizes it on a
 * locale switch. The control's own handler surfaces the same message, so a
 * click is never a silent no-op.
 * @param {Element|null} el
 * @param {string} messageKey
 */
function markUnsupported(el, messageKey) {
  if (!el) return;
  el.classList.add('is-unsupported');
  el.setAttribute('aria-disabled', 'true');
  el.setAttribute('data-i18n-label', messageKey);
  const message = t(messageKey);
  el.setAttribute('title', message);
  el.setAttribute('aria-label', message);
}

/**
 * Flag the controls for features this browser cannot run, so the gaps are
 * explained rather than failing silently: video recording with no supported
 * codec, the viewing window without BroadcastChannel, and the microphone
 * outside a secure context. Call once after createUI().
 */
export function applyCapabilityNotices() {
  if (!supportedVideoFormat()) {
    markUnsupported(document.getElementById('video-record-btn'), 'alertVideoUnsupported');
  }
  if (!hasViewerSupport()) {
    markUnsupported(uiComponents.openViewerBtn?.elt, 'alertViewerUnsupported');
  }
  if (micUnavailableReason()) {
    markUnsupported(document.getElementById('mic-mode-btn'), 'alertMicUnsupported');
    markUnsupported(document.getElementById('mic-record-btn'), 'alertMicUnsupported');
  }
}
