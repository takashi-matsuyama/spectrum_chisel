// UI-less viewing window. Runs p5 in global mode with no controls and no audio;
// it renders frames received from the atelier over a BroadcastChannel, reusing
// the exact same renderer so the displayed artwork matches the atelier. Only
// data crosses the channel (spectrum + params), so the viewer stays vector and
// can be resized independently.

import './p5-global.js';
import { renderFrame } from './drawing/render.js';
import { VIEW_CHANNEL } from './broadcast.js';

// Messages are queued and drained in draw() so no frame is dropped: a single p5
// tick renders every frame received since the last one (important for sculpture
// mode, where each frame accumulates).
const queue = [];
let prevSpectrum = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100); // Match the atelier's color environment.
  background(0);

  const channel = new BroadcastChannel(VIEW_CHANNEL);
  channel.onmessage = (event) => queue.push(event.data);
}

function draw() {
  if (queue.length === 0) return; // Persist the current image until new frames arrive.
  const messages = queue.splice(0, queue.length);
  for (const msg of messages) {
    if (msg.type === 'clear') {
      background(0);
      prevSpectrum = [];
      continue;
    }
    if (msg.type !== 'frame') continue;
    const { frameIndex, spectrum, params, boost } = msg;
    // Afterimage mode fades; sculpture mode accumulates (matches the atelier).
    if (!params.sculptureMode) background(0, 20);
    renderFrame(this, frameIndex, spectrum, prevSpectrum, params, boost);
    prevSpectrum = spectrum;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
}

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
