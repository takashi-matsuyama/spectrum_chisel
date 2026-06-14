/**
 * Output filename construction (pure, p5-independent).
 *
 * Encodes provenance into the filename: input mode, session id, drawing mode
 * (sculpture = "eternity" vs. afterimage = "moment"), total time, frame count,
 * and an optional trim range for file playback.
 */

/**
 * @typedef {Object} TrimRange
 * @property {number} start      Trim start time (seconds).
 * @property {number} end        Trim end time (seconds).
 * @property {number} duration   Full source duration (seconds).
 */

/**
 * Build a signed, timestamped filename. All inputs are passed in so the result
 * is deterministic and testable (no globals, no clock access).
 *
 * @param {Object} params
 * @param {string} params.extension          File extension without the dot.
 * @param {number} params.totalFrames        Number of recorded frames.
 * @param {number} params.frameRate          Frames per second.
 * @param {'mic'|'file'} params.inputMode    Active input mode.
 * @param {number} params.id                 Session id (caller resolves sessionId || now).
 * @param {boolean} params.sculptureMode     Whether sculpture (accumulate) mode is on.
 * @param {TrimRange|null} [params.trim]      Trim range, or null when not applicable.
 * @returns {string}
 */
export function buildTimestampedFilename({
  extension,
  totalFrames,
  frameRate,
  inputMode,
  id,
  sculptureMode,
  trim = null,
}) {
  const totalSeconds = (totalFrames / frameRate).toFixed(1);
  let prefix = inputMode === 'mic' ? 'sc-mic' : 'sc-file';

  // Only annotate the trim range when it is an actual sub-section of the source.
  if (inputMode === 'file' && trim) {
    if (trim.start !== 0 || trim.end < trim.duration - 0.1) {
      prefix += `-trim[${trim.start.toFixed(1)}-${trim.end.toFixed(1)}]s`;
    }
  }

  const modeSuffix = sculptureMode ? 'eternity' : 'moment';
  return `${prefix}-${id}-${modeSuffix}-t${totalSeconds}s-f${totalFrames}.${extension}`;
}
