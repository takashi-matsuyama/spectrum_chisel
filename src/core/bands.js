/**
 * Frequency-band configuration (pure data, p5-independent).
 *
 * Each band maps a frequency range to a default drawing style. The band `name`
 * is a machine-readable key (ASCII) used for preset serialization and UI state;
 * `defFunc` references a key in the drawing-style map of the p5 shell.
 *
 * @typedef {Object} BandConfig
 * @property {string} name              Machine-readable band key (ASCII).
 * @property {[number, number]} freq    Frequency range as [lowHz, highHz].
 * @property {string} defFunc           Default drawing-style key for the band.
 */

/** @type {BandConfig[]} */
export const BAND_CONFIG = [
  { name: 'subBass', freq: [20, 60], defFunc: 'drawExpandingDots' },
  { name: 'low', freq: [60, 250], defFunc: 'drawSmoothEllipse' },
  { name: 'lowMid', freq: [250, 500], defFunc: 'drawNoisyContours' },
  { name: 'mid', freq: [500, 2000], defFunc: 'drawRotatingWaves' },
  { name: 'upperMid', freq: [2000, 4000], defFunc: 'drawFloatingDots' },
  { name: 'presence', freq: [4000, 6000], defFunc: 'drawSparks' },
  { name: 'brilliance', freq: [6000, 16000], defFunc: 'drawRadiantBeams' },
  { name: 'high', freq: [16000, 20000], defFunc: 'drawRadialLines' },
];

/** @returns {string[]} The ordered band names. */
export function bandNames() {
  return BAND_CONFIG.map((band) => band.name);
}
