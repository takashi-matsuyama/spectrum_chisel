// Atelier -> viewer link. Broadcasts each rendered frame and control state to
// the UI-less viewing window (view.html) over a same-origin BroadcastChannel,
// and opens that window. The viewer reuses the same renderer, so only data
// (spectrum + params) crosses the channel, not pixels.
//
// The atelier also listens on the same channel so a viewer opened mid-session
// can announce itself ('hello') and receive the current params plus, in
// sculpture mode, the accumulated history to replay (late-join backfill).

export const VIEW_CHANNEL = 'spectrum-chisel-view';

let channel = null;
/** @type {((viewerId: string) => void)|null} */
let helloHandler = null;
// Last params serialized onto the channel. Params ride with frames only when
// they change, so the viewer caches the most recent snapshot and reuses it for
// frames that omit it. Reset to force the next frame to carry full params.
let lastSentParams = null;

function getChannel() {
  if (!channel) {
    channel = new BroadcastChannel(VIEW_CHANNEL);
    channel.onmessage = (event) => {
      // A BroadcastChannel never receives its own posts, so this only fires for
      // messages from viewer windows.
      if (event.data?.type === 'hello' && helloHandler) helloHandler(event.data.viewerId);
    };
  }
  return channel;
}

/**
 * Register the callback invoked when a viewer announces itself, so the atelier
 * can reply with the current state (late-join backfill). Installing it also
 * opens the channel, so the listener is live from app start even before the
 * first frame is broadcast.
 * @param {(viewerId: string) => void} handler
 */
export function onViewerHello(handler) {
  helloHandler = handler;
  getChannel();
}

/**
 * Broadcast one drawn frame: the spectrum, the input boost, and the params
 * snapshot (only when it changed since the last send). Called only when the
 * atelier actually rendered a frame.
 * @param {number} frameIndex
 * @param {number[]} spectrum
 * @param {object} params  Params snapshot drawVisuals() drew this frame with.
 * @param {number} boost
 */
export function broadcastFrame(frameIndex, spectrum, params, boost) {
  const serialized = JSON.stringify(params);
  /** @type {Record<string, any>} */
  const message = { type: 'frame', frameIndex, spectrum: Array.from(spectrum), boost };
  if (serialized !== lastSentParams) {
    message.params = params;
    lastSentParams = serialized;
  }
  getChannel().postMessage(message);
}

/**
 * Reply to a late-joining viewer with the full current state. Carries the
 * accumulated history only in sculpture mode, so the viewer can replay it and
 * match the atelier. Resets the dedup baseline since this send is authoritative.
 * @param {{viewerId: string, params: object, boost: number, history: number[][]|null}} payload
 */
export function broadcastSync({ viewerId, params, boost, history }) {
  lastSentParams = JSON.stringify(params);
  /** @type {Record<string, any>} */
  const message = { type: 'sync', viewerId, params, boost };
  if (history) message.history = history;
  getChannel().postMessage(message);
}

/** Tell the viewer to clear its canvas and history (atelier reset). */
export function broadcastClear() {
  lastSentParams = null; // The next frame must re-send full params.
  getChannel().postMessage({ type: 'clear' });
}

/** Open the UI-less viewing window. */
export function openViewer() {
  window.open('view.html', 'spectrum-chisel-viewer');
}
