/**
 * Frequency-band configuration (pure data, p5-independent).
 *
 * The seven bands form an audible "rainbow": low frequency = red ... high
 * frequency = violet, mirroring how a prism orders light by frequency. The
 * default drawing styles progress from area-like shapes in the low bands to
 * dot/line shapes in the high bands. The band `name` is a machine-readable key
 * (ASCII) used for preset serialization and UI state; `defFunc` references a
 * key in the drawing-style map of the p5 shell.
 *
 * @typedef {Object} BandConfig
 * @property {string} name              Machine-readable band key (ASCII).
 * @property {[number, number]} freq    Frequency range as [lowHz, highHz].
 * @property {string} defFunc           Default drawing-style key for the band.
 */

/** @type {BandConfig[]} */
export const BAND_CONFIG = [
  { name: 'red', freq: [20, 80], defFunc: 'drawSmoothEllipse' },
  { name: 'orange', freq: [80, 250], defFunc: 'drawNoisyContours' },
  { name: 'yellow', freq: [250, 600], defFunc: 'drawRotatingWaves' },
  { name: 'green', freq: [600, 1500], defFunc: 'drawExpandingDots' },
  { name: 'blue', freq: [1500, 4000], defFunc: 'drawFloatingDots' },
  { name: 'indigo', freq: [4000, 9000], defFunc: 'drawRadiantBeams' },
  { name: 'violet', freq: [9000, 20000], defFunc: 'drawRadialLines' },
];

/** @returns {string[]} The ordered band names. */
export function bandNames() {
  return BAND_CONFIG.map((band) => band.name);
}
