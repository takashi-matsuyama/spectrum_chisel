// UI-less viewing window. Runs p5 in global mode with no controls and no audio;
// it renders frames received from the atelier over a BroadcastChannel, reusing
// the exact same renderer so the displayed artwork matches the atelier. Only
// data crosses the channel (spectrum + params), so the viewer stays vector and
// can be resized independently.

import './p5-global.js';
import { renderFrame } from './drawing/render.js';
import { VIEW_CHANNEL } from './broadcast.js';
import { t } from './i18n/index.js';

// Messages are queued and drained in draw() so no frame is dropped: a single p5
// tick renders every frame received since the last one (important for sculpture
// mode, where each frame accumulates).
const queue = [];
let prevSpectrum = [];

// Most recent params snapshot. Frames carry params only when they change, so we
// reuse the cached one for frames that omit it. Null until the first frame or
// sync arrives; frames received before then are skipped.
let currentParams = null;

// Frames drawn in sculpture mode, kept so an independent resize can replay them
// onto the cleared canvas (the atelier does the same in windowResized). Matches
// the atelier's unbounded spectrumHistory; afterimage mode keeps nothing.
/** @type {{frameIndex: number, spectrum: number[], boost: number}[]} */
let history = [];

// Unique id so the atelier can address its sync reply to this window. Other open
// viewers ignore a sync meant for someone else, so a new joiner never disturbs
// them. (Browser globals; not the sandboxed workflow runtime.)
const viewerId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100); // Match the atelier's color environment.
  background(0);

  // Reached only by opening view.html directly on a browser without
  // BroadcastChannel (the atelier blocks Open Viewer there). Show a note on the
  // canvas instead of throwing on the constructor below.
  if (typeof BroadcastChannel === 'undefined') {
    fill(0, 0, 100);
    textAlign(CENTER, CENTER);
    text(t('alertViewerUnsupported'), width / 2, height / 2);
    noLoop();
    return;
  }

  const channel = new BroadcastChannel(VIEW_CHANNEL);
  channel.onmessage = (event) => queue.push(event.data);
  // Announce ourselves so a mid-session atelier backfills our state.
  channel.postMessage({ type: 'hello', viewerId });
}

/** Render one frame from a params snapshot, accumulating sculpture history. */
function drawMessageFrame(pg, frameIndex, spectrum, params, boost) {
  // Afterimage mode fades; sculpture mode accumulates (matches the atelier).
  if (!params.sculptureMode) pg.background(0, 20);
  renderFrame(pg, frameIndex, spectrum, prevSpectrum, params, boost);
  prevSpectrum = spectrum;
  if (params.sculptureMode) history.push({ frameIndex, spectrum, boost });
}

/** Repaint accumulated sculpture frames (after a resize or a sync backfill). */
function replayHistory(pg) {
  prevSpectrum = [];
  for (const f of history) {
    renderFrame(pg, f.frameIndex, f.spectrum, prevSpectrum, currentParams, f.boost);
    prevSpectrum = f.spectrum;
  }
}

function draw() {
  if (queue.length === 0) return; // Persist the current image until new frames arrive.
  const pg = this;
  const messages = queue.splice(0, queue.length);
  for (const msg of messages) {
    if (msg.type === 'clear') {
      pg.background(0);
      prevSpectrum = [];
      history = [];
      continue;
    }
    if (msg.type === 'sync') {
      if (msg.viewerId !== viewerId) continue; // Reply meant for a different viewer.
      currentParams = msg.params;
      pg.background(0);
      prevSpectrum = [];
      history = [];
      if (msg.history && currentParams.sculptureMode) {
        for (let i = 0; i < msg.history.length; i++) {
          history.push({ frameIndex: i + 1, spectrum: msg.history[i], boost: msg.boost });
        }
        replayHistory(pg);
      }
      continue;
    }
    if (msg.type !== 'frame') continue;
    const { frameIndex, spectrum, params, boost } = msg;
    const resolved = params || currentParams;
    if (!resolved) continue; // Joined mid-stream before any params arrived; wait.
    if (params) currentParams = params;
    drawMessageFrame(pg, frameIndex, spectrum, resolved, boost);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);

  // resizeCanvas() clears the pixel buffer. In sculpture mode replay the
  // recorded frames onto the resized canvas so the accumulated artwork survives;
  // in afterimage mode the next received frame repaints it.
  if (currentParams && currentParams.sculptureMode && history.length > 0) {
    replayHistory(this);
  }
}

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
