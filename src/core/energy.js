/**
 * Spectrum energy helpers (pure, p5-independent).
 *
 * The FFT input is assumed to be sampled at 44.1 kHz, so the spectrum covers
 * frequencies up to the 22.05 kHz Nyquist limit. These helpers reproduce the
 * original inline frequency-to-bin mapping exactly so drawing output is
 * unchanged.
 */

/** Nyquist frequency (Hz) for 44.1 kHz audio. */
export const NYQUIST_HZ = 22050;

/**
 * Map a frequency (Hz) to a (fractional) FFT bin index.
 * @param {number} freq
 * @param {number} binCount   Number of bins in the spectrum.
 * @param {number} [nyquist]
 * @returns {number}
 */
export function freqToBin(freq, binCount, nyquist = NYQUIST_HZ) {
  return (freq / nyquist) * binCount;
}

/**
 * Average energy of the FFT bins covering the band [freqLow, freqHigh].
 *
 * Matches the original computation: floor the start bin, ceil the end bin, sum
 * inclusively, and divide by the bin span (including any out-of-range slots).
 * @param {ArrayLike<number>} spectrum
 * @param {number} freqLow
 * @param {number} freqHigh
 * @param {number} [nyquist]
 * @returns {number}
 */
export function bandEnergy(spectrum, freqLow, freqHigh, nyquist = NYQUIST_HZ) {
  const startIndex = Math.floor(freqToBin(freqLow, spectrum.length, nyquist));
  const endIndex = Math.ceil(freqToBin(freqHigh, spectrum.length, nyquist));
  let sum = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    if (spectrum[i] !== undefined) {
      sum += spectrum[i];
    }
  }
  return sum / (endIndex - startIndex + 1);
}

/**
 * Spectral centroid — the magnitude-weighted mean bin, normalized to [0,1]
 * (0 = lowest bin, 1 = highest). A measure of timbral "brightness" that is
 * independent of overall loudness, giving a sound dimension distinct from band
 * energy. Pure and deterministic: a frame's centroid is recomputed identically
 * from the same spectrum in the atelier, the viewer, and SVG export, so it
 * needs no extra transport and preserves the regression anchor.
 *
 * Returns 0 for silence (no magnitude) and for a degenerate (< 2 bin) spectrum.
 * A single non-zero bin 0 also yields 0, so silence and an all-lowest-band
 * frame are indistinguishable through this source. Non-finite or negative bins
 * are ignored, and the result is clamped to [0,1] to honor the contract for any
 * caller outside the usual 0-255 FFT input.
 * @param {ArrayLike<number>} spectrum  FFT magnitudes (typically 0-255).
 * @returns {number} Normalized centroid in [0,1].
 */
export function spectralCentroid(spectrum) {
  const n = spectrum.length;
  if (n < 2) return 0;
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const m = spectrum[i];
    // Ignore holey / non-finite / negative bins (mirrors bandEnergy's undefined
    // guard); only positive finite magnitudes contribute.
    if (!(Number.isFinite(m) && m > 0)) continue;
    weighted += i * m;
    total += m;
  }
  if (total === 0) return 0;
  const c = weighted / total / (n - 1);
  return c < 0 ? 0 : c > 1 ? 1 : c;
}
