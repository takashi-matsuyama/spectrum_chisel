// Export smoke test: drives a running build of the instrument in a headless
// Chrome, saves every export the app offers — video, SVG, colour-plate SVG,
// PNG, preset and recipe — and checks what lands on disk.
//
// The Node-only checks (vitest, tsc, eslint, vite build) never execute the
// p5 / DOM / download paths, so a broken export can pass all of them. This
// script is the check that does execute those paths. It is black-box: it
// clicks the same buttons a person would and draws from Chrome's fake
// microphone, so it runs unchanged against the dev server, a local
// `vite preview`, or a Workers preview URL (a production build, where the
// dev-only window.__sc seam does not exist).
//
// Each export must start exactly one download, and the file must decode as
// what it claims to be: the SVGs parse as XML and hold drawn marks, the PNG
// and the video decode in the browser, the preset carries every band, and the
// recipe validates, holds real spectrum frames and matches its contentHash.
//
// Run:
//   pnpm dev                                         # in another terminal
//   pnpm verify:export                               # drives http://localhost:5173/
//   BASE_URL=https://<preview-host>/ pnpm verify:export
//
// Env:
//   BASE_URL                 App to drive (default http://localhost:5173/).
//   CHROME_PATH              Chrome binary (default: macOS Google Chrome).
//   CF_ACCESS_CLIENT_ID      Cloudflare Access service token, for a preview
//   CF_ACCESS_CLIENT_SECRET  URL behind Access. Set both or neither.
//   RECORD_MS                How long to draw from the fake mic (default 3000).
//   KEEP_DOWNLOADS=1         Keep the saved files and print where they are.
//
// Every request to an origin other than BASE_URL's is aborted, so the Access
// token is never sent anywhere else and the Web Analytics beacon never counts
// a smoke run as a visit. The service worker is bypassed: it would fetch the
// app without the token.
//
// Requires puppeteer-core (devDependency). Exits 1 when an export is missing
// or malformed, 2 on a usage error.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { bandNames } from '../src/core/bands.js';
import { isValidPreset } from '../src/core/preset.js';
import { computeContentHash, deserializeRecipe, isValidRecipe } from '../src/core/recipe.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/';
const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const RECORD_MS = parseInt(process.env.RECORD_MS || '3000', 10);
const CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID || '';
const CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET || '';
const KEEP_DOWNLOADS = process.env.KEEP_DOWNLOADS === '1';
const DOWNLOAD_TIMEOUT_MS = 30000;
// After an export's download starts, how long to watch for a second, stray one.
const SETTLE_MS = 1500;
// Bins per recorded spectrum frame (p5.FFT(0.9, 512) in src/main.js).
const SPECTRUM_BINS = 512;

let appOrigin;
try {
  appOrigin = new URL(BASE_URL).origin;
} catch {
  console.error(`BASE_URL is not a URL: ${BASE_URL}`);
  process.exit(2);
}
if (Boolean(CLIENT_ID) !== Boolean(CLIENT_SECRET)) {
  console.error('Set both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET, or neither.');
  process.exit(2);
}
const accessHeaders = CLIENT_ID
  ? { 'cf-access-client-id': CLIENT_ID, 'cf-access-client-secret': CLIENT_SECRET }
  : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll until predicate() is true, or fail after timeoutMs with `what`. */
async function waitFor(predicate, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`${what} within ${timeoutMs} ms`);
    await sleep(100);
  }
}

// --- What each export must look like ----------------------------------------
// The checks that need a real decoder run in the page (DOMParser, image and
// video decoding); `page` is the app's page, set once it has loaded.

let page;

/**
 * Parse an SVG in the browser and count what it draws. Marks are drawn shapes
 * other than a rectangle covering the whole canvas (the background).
 */
function inspectSvg(text) {
  return page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return { parseError: true };
    const root = doc.documentElement;
    if (root.localName !== 'svg') return { rootName: root.localName };
    const width = parseFloat(root.getAttribute('width'));
    const height = parseFloat(root.getAttribute('height'));
    const shapeSelector = 'path, rect, circle, ellipse, line, polyline, polygon';
    const isMark = (el) =>
      !(
        el.localName === 'rect' &&
        parseFloat(el.getAttribute('width')) >= width &&
        parseFloat(el.getAttribute('height')) >= height
      );
    const marks = [...root.querySelectorAll(shapeSelector)].filter(isMark).length;
    const layers = [...root.querySelectorAll('g')].filter(
      (g) => g.getAttribute('inkscape:groupmode') === 'layer'
    );
    const marksInLayers = layers.reduce(
      (sum, g) => sum + [...g.querySelectorAll(shapeSelector)].filter(isMark).length,
      0
    );
    return { rootName: 'svg', width, height, marks, layers: layers.length, marksInLayers };
  }, text);
}

async function checkSvg(buf) {
  const svg = await inspectSvg(buf.toString('utf8'));
  if (svg.parseError) throw new Error('not well-formed XML');
  if (svg.rootName !== 'svg') throw new Error(`root element is <${svg.rootName}>, not <svg>`);
  if (svg.marks === 0) throw new Error('nothing drawn besides the background');
  return `${svg.width}x${svg.height}, ${svg.marks} marks`;
}

/** The colour-plate document: its marks must sit inside the plate layers. */
async function checkPlates(buf) {
  const svg = await inspectSvg(buf.toString('utf8'));
  if (svg.parseError) throw new Error('not well-formed XML');
  if (svg.rootName !== 'svg') throw new Error(`root element is <${svg.rootName}>, not <svg>`);
  if (svg.layers === 0) throw new Error('no plate layers');
  if (svg.marksInLayers === 0) throw new Error('the plate layers hold no marks');
  return `${svg.layers} plates, ${svg.marksInLayers} marks`;
}

/** Decode the image in the browser; it must have a size and non-black pixels. */
async function checkPng(buf) {
  const image = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    try {
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let lit = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] || data[i + 1] || data[i + 2]) lit++;
      return { width: bitmap.width, height: bitmap.height, lit };
    } catch (err) {
      return { error: String(err) };
    }
  }, buf.toString('base64'));
  if (image.error) throw new Error(`does not decode as PNG: ${image.error}`);
  if (image.lit === 0) throw new Error(`${image.width}x${image.height} and entirely black`);
  return `${image.width}x${image.height}, ${image.lit} lit pixels`;
}

/** The preset must validate and carry the settings of every band. */
function checkPresetBody(preset, what) {
  if (!isValidPreset(preset)) throw new Error(`isValidPreset rejects the ${what}`);
  const missing = bandNames().filter((name) => {
    const band = preset.bands[name];
    return !band || typeof band.enabled !== 'boolean' || typeof band.drawFunc !== 'string';
  });
  if (missing.length > 0) throw new Error(`the ${what} lacks bands: ${missing.join(', ')}`);
}

function checkPreset(buf) {
  const preset = JSON.parse(buf.toString('utf8'));
  checkPresetBody(preset, 'preset');
  return `version ${preset.version}, ${bandNames().length} bands`;
}

/**
 * The recipe must validate, hold the recorded spectrum (full frames of 0..255
 * bins, not all silent) and carry a contentHash that matches its content.
 */
async function checkRecipe(buf) {
  const recipe = await deserializeRecipe(new Uint8Array(buf));
  if (!isValidRecipe(recipe)) throw new Error('isValidRecipe rejects it');
  checkPresetBody(recipe.params, 'recipe params');
  const frames = recipe.spectrumHistory;
  const badFrame = frames.findIndex(
    (frame) =>
      frame.length !== SPECTRUM_BINS ||
      !frame.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
  );
  if (badFrame >= 0) throw new Error(`frame ${badFrame} is not ${SPECTRUM_BINS} bins of 0..255`);
  if (!frames.some((frame) => frame.some((v) => v > 0))) {
    throw new Error('every spectrum frame is silent');
  }
  const stamped = recipe.metadata && recipe.metadata.contentHash;
  if (!stamped) throw new Error('no contentHash');
  const recomputed = await computeContentHash(recipe);
  if (recomputed !== stamped) throw new Error(`contentHash ${stamped} != ${recomputed}`);
  return `${frames.length} frames, ${stamped.slice(0, 19)}…`;
}

/** Decode the recording in the browser; its first frame must render. */
async function checkVideo(buf, name) {
  const type = name.endsWith('.webm') ? 'video/webm' : name.endsWith('.mp4') ? 'video/mp4' : null;
  if (!type) throw new Error('neither .webm nor .mp4');
  const video = await page.evaluate(
    async (base64, mime) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const el = document.createElement('video');
      el.muted = true;
      try {
        return await new Promise((resolve) => {
          const timer = setTimeout(() => resolve({ error: 'no frame decoded within 10 s' }), 10000);
          el.addEventListener('loadeddata', () => {
            clearTimeout(timer);
            resolve({ width: el.videoWidth, height: el.videoHeight });
          });
          el.addEventListener('error', () => {
            clearTimeout(timer);
            resolve({ error: el.error ? `media error ${el.error.code}` : 'media error' });
          });
          el.src = url;
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    buf.toString('base64'),
    type
  );
  if (video.error) throw new Error(`does not decode: ${video.error}`);
  if (!video.width || !video.height) throw new Error('decodes without a picture');
  return `${video.width}x${video.height}, first frame decoded`;
}

// --- Browser ----------------------------------------------------------------

const downloadDir = await mkdtemp(join(tmpdir(), 'sc-export-'));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 120000,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

// Downloads are saved under their GUID; downloadWillBegin carries the name the
// app gave the file. Every download is tracked from its start, so each one is
// attributed to the export whose click started it.
const cdp = await browser.target().createCDPSession();
await cdp.send('Browser.setDownloadBehavior', {
  behavior: 'allowAndName',
  downloadPath: downloadDir,
  eventsEnabled: true,
});
const started = []; // { guid, name } in the order downloads began
const ended = new Map(); // guid -> 'completed' | 'canceled'
cdp.on('Browser.downloadWillBegin', (e) =>
  started.push({ guid: e.guid, name: e.suggestedFilename })
);
cdp.on('Browser.downloadProgress', (e) => {
  if (e.state === 'completed' || e.state === 'canceled') ended.set(e.guid, e.state);
});

const failures = [];
const dialogs = [];
const pageErrors = [];
const blockedOrigins = new Set();

/**
 * Run one export: trigger() must start exactly one download, with one of the
 * expected extensions, whose file passes check(). A failure is recorded, not
 * thrown, so every export is tried.
 */
async function expectExport(label, trigger, extensions, check) {
  try {
    const mark = started.length;
    await trigger();
    await waitFor(() => started.length > mark, DOWNLOAD_TIMEOUT_MS, 'no download started');
    await sleep(SETTLE_MS);
    const mine = started.slice(mark);
    if (mine.length !== 1) {
      throw new Error(
        `${mine.length} downloads started, expected 1: ${mine.map((d) => d.name).join(', ')}`
      );
    }
    const { guid, name } = mine[0];
    await waitFor(() => ended.has(guid), DOWNLOAD_TIMEOUT_MS, `${name} did not finish`);
    if (ended.get(guid) !== 'completed') throw new Error(`${name} was ${ended.get(guid)}`);
    if (!extensions.some((ext) => name.endsWith(ext))) {
      throw new Error(`unexpected file ${name} (wanted ${extensions.join(' or ')})`);
    }
    const buf = await readFile(join(downloadDir, guid));
    const detail = await check(buf, name);
    console.log(`  ✓ ${label.padEnd(8)} ${name}  ${buf.length} bytes  ${detail}`);
  } catch (err) {
    failures.push(`${label}: ${err.message}`);
    console.log(`  ✗ ${label.padEnd(8)} ${err.message}`);
  }
}

const click = (selector) => () => page.click(selector);

try {
  page = await browser.newPage();
  await page.setBypassServiceWorker(true);
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return req.continue();
    if (new URL(url).origin !== appOrigin) {
      blockedOrigins.add(new URL(url).origin);
      return req.abort('blockedbyclient');
    }
    if (accessHeaders) return req.continue({ headers: { ...req.headers(), ...accessHeaders } });
    return req.continue();
  });
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('button[data-i18n="saveSvg"]', { timeout: 30000 });
  } catch (err) {
    const away = [...blockedOrigins].join(', ');
    throw new Error(
      `the app did not load from ${appOrigin}: ${err.message}` +
        (away
          ? ` (requests to ${away} were blocked — a redirect to Cloudflare Access means the service token was not accepted)`
          : '')
    );
  }
  console.log(`Driving ${appOrigin}${accessHeaders ? ' with an Access service token' : ''}`);

  // Draw from the fake microphone, recording video over the second half.
  await page.click('#mic-record-btn');
  await sleep(RECORD_MS / 2);
  await page.click('#video-record-btn');
  await sleep(RECORD_MS / 2);
  await expectExport('video', click('#video-record-btn'), ['.webm', '.mp4'], checkVideo);
  await page.click('#mic-record-btn');

  const elapsed = await page.$eval('#time-display', (el) => el.textContent.trim());
  if (elapsed === '0.0s') {
    failures.push('drawing: the timer never moved — the fake microphone did not start');
  }

  const exports = [
    ['SVG', 'saveSvg', ['.svg'], checkSvg],
    ['plates', 'savePlates', ['.svg'], checkPlates],
    ['PNG', 'savePng', ['.png'], checkPng],
    ['preset', 'savePreset', ['.json'], checkPreset],
    ['recipe', 'saveRecipe', ['.json.gz', '.json'], checkRecipe],
  ];
  for (const [label, key, extensions, check] of exports) {
    await expectExport(label, click(`button[data-i18n="${key}"]`), extensions, check);
  }
  console.log(`  drew for ${elapsed}`);
} catch (err) {
  failures.push(err.message);
} finally {
  await browser.close();
  if (KEEP_DOWNLOADS) console.log(`Downloads kept in ${downloadDir}`);
  else await rm(downloadDir, { recursive: true, force: true });
}

for (const message of dialogs) failures.push(`unexpected dialog: ${message}`);
for (const message of pageErrors) failures.push(`uncaught page error: ${message}`);

if (failures.length > 0) {
  console.log(`\n[export] ✗ ${failures.length} problem(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\n[export] ✓ every export saved and well-formed');
