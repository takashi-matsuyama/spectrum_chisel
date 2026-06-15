// Preset helpers (pure, p5-independent).
//
// Presets created before the seven-color rainbow redesign keyed their per-band
// settings by the old eight-band names (subBass, low, ... high). Those keys no
// longer match the current band names, so such presets are detected on load and
// surfaced to the user; the matching global settings still apply.

export const PRESET_VERSION = '1.0.0';

/**
 * @typedef {Object} BandIncompatibility
 * @property {boolean} compatible  True when the preset's band keys exactly match
 *                                 the current bands.
 * @property {string[]} missing    Current bands absent from the preset.
 * @property {string[]} unknown    Preset bands not present in the current config.
 */

/**
 * Compare a loaded preset's band keys against the current band layout.
 * @param {{ bands?: Record<string, unknown> }} preset
 * @param {string[]} currentBandNames
 * @returns {BandIncompatibility}
 */
export function detectBandIncompatibility(preset, currentBandNames) {
  const presetBands = preset && preset.bands ? Object.keys(preset.bands) : [];
  const currentSet = new Set(currentBandNames);
  const presetSet = new Set(presetBands);
  const missing = currentBandNames.filter((name) => !presetSet.has(name));
  const unknown = presetBands.filter((name) => !currentSet.has(name));
  return { compatible: missing.length === 0 && unknown.length === 0, missing, unknown };
}

/**
 * Check that a loaded preset has the structural shape loadPreset() relies on, so
 * a malformed or unrelated JSON file is rejected gracefully instead of throwing
 * when its global layers or bands map are accessed. Band-name compatibility is a
 * separate concern (see detectBandIncompatibility).
 * @param {any} preset
 * @returns {boolean}
 */
export function isValidPreset(preset) {
  if (!preset || typeof preset !== 'object') return false;
  if (typeof preset.frameRate !== 'number') return false;
  return ['spectrumRing', 'spectrumDiff', 'bands'].every(
    (key) => preset[key] !== null && typeof preset[key] === 'object'
  );
}
