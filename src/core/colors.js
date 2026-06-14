// Default per-band colors: the canonical rainbow, ordered low frequency = red
// to high frequency = violet. This matches both the light spectrum (red is low
// frequency, violet is high) and the project's "audible rainbow" concept. Hues
// follow the v1.0.0 spec; the values are vivid (full saturation and brightness).
// The colors are only the defaults: each band keeps an editable color picker.

/** @type {Record<string, string>} Band name to default color (hex). */
export const BAND_COLORS = {
  red: '#ff0000', // H ~= 0
  orange: '#ff8000', // H ~= 30
  yellow: '#ffea00', // H ~= 55
  green: '#2aff00', // H ~= 110
  blue: '#0080ff', // H ~= 210
  indigo: '#2a00ff', // H ~= 250
  violet: '#d500ff', // H ~= 290
};

/**
 * Default color for a band, falling back to white when a band has no mapping.
 * @param {string} name
 * @returns {string}
 */
export function defaultBandColor(name) {
  return BAND_COLORS[name] ?? '#ffffff';
}
