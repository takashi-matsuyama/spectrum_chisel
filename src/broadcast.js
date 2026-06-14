// Atelier -> viewer link. Broadcasts each rendered frame and control events to
// the UI-less viewing window (view.html) over a same-origin BroadcastChannel,
// and opens that window. The viewer reuses the same renderer, so only data
// (spectrum + params) crosses the channel, not pixels.

import { collectRenderParams } from './params.js';

export const VIEW_CHANNEL = 'spectrum-chisel-view';

let channel = null;

function getChannel() {
  if (!channel) channel = new BroadcastChannel(VIEW_CHANNEL);
  return channel;
}

/**
 * Broadcast one drawn frame: the spectrum, the current params snapshot, and the
 * input boost. Called only when the atelier actually rendered a frame.
 * @param {number} frameIndex
 * @param {number[]} spectrum
 * @param {number} boost
 */
export function broadcastFrame(frameIndex, spectrum, boost) {
  getChannel().postMessage({
    type: 'frame',
    frameIndex,
    spectrum: Array.from(spectrum),
    params: collectRenderParams(),
    boost,
  });
}

/** Tell the viewer to clear its canvas and history (atelier reset). */
export function broadcastClear() {
  getChannel().postMessage({ type: 'clear' });
}

/** Open the UI-less viewing window. */
export function openViewer() {
  window.open('view.html', 'spectrum-chisel-viewer');
}
