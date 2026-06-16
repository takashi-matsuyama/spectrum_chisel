// Pure video-format negotiation for MediaRecorder. No browser globals are used
// here: the shell injects the real `MediaRecorder.isTypeSupported` predicate, so
// this module stays unit-testable. WebM (VP9/VP8) is preferred where supported
// (Chromium, Firefox); MP4/H.264 is the fallback for browsers that cannot record
// WebM (Safari).

/** @typedef {{ mimeType: string, extension: string }} VideoFormat */

/** @type {VideoFormat[]} Candidate recording formats, most preferred first. */
export const VIDEO_FORMAT_CANDIDATES = [
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
];

/**
 * Pick the first candidate format the predicate accepts.
 * @param {(mimeType: string) => boolean} isSupported
 * @param {VideoFormat[]} [candidates]
 * @returns {VideoFormat|null} null when none are supported.
 */
export function pickVideoFormat(isSupported, candidates = VIDEO_FORMAT_CANDIDATES) {
  for (const candidate of candidates) {
    let ok = false;
    try {
      ok = isSupported(candidate.mimeType);
    } catch {
      ok = false; // A predicate that throws on an odd type means "not supported".
    }
    if (ok) return candidate;
  }
  return null;
}

/**
 * The base MIME type (without the codecs parameter), suitable for a Blob type.
 * @param {string} mimeType
 * @returns {string}
 */
export function baseMimeType(mimeType) {
  return mimeType.split(';')[0].trim();
}
