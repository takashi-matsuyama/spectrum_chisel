// Browser-capability detection (shell layer). Wraps the pure negotiation in
// ./core/video-format.js with the real browser APIs so the app can degrade
// gracefully on engines that lack a feature: Safari has no WebM MediaRecorder
// (it records MP4 instead), very old browsers lack BroadcastChannel, and an
// insecure context has no microphone access.

import { pickVideoFormat } from './core/video-format.js';

/** @returns {boolean} Whether the canvas can be captured into a MediaStream. */
function canCaptureCanvas() {
  return (
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  );
}

/**
 * The video format this browser can record the canvas in, or null when it
 * cannot record at all (no MediaRecorder, no canvas capture, or no supported
 * codec).
 * @returns {import('./core/video-format.js').VideoFormat|null}
 */
export function supportedVideoFormat() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null;
  }
  if (!canCaptureCanvas()) return null;
  return pickVideoFormat((type) => MediaRecorder.isTypeSupported(type));
}

/** @returns {boolean} Whether the viewing-window link (BroadcastChannel) works. */
export function hasViewerSupport() {
  return typeof BroadcastChannel !== 'undefined';
}

/**
 * Why microphone capture is unavailable, or null when it should work. A secure
 * context (https or localhost) and navigator.mediaDevices.getUserMedia are both
 * required.
 * @returns {'insecureContext'|'noGetUserMedia'|null}
 */
export function micUnavailableReason() {
  if (typeof window !== 'undefined' && window.isSecureContext === false) return 'insecureContext';
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    return 'noGetUserMedia';
  }
  return null;
}
