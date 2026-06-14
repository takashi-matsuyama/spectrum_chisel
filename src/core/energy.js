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
