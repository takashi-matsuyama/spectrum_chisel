// Determinism smoke test for the seeded renderer (Slice 0).
//
// p5 / SVG export / DOM cannot run under the Node-only vitest suite, so this is
// a browser smoke test: it drives the running dev app with a headless system
// Chrome (no browser download), injects a fixed spectrumHistory + renderSeed,
// exports the SVG several times, and asserts the outputs are byte-identical
// (SHA-256, hashed in the browser to avoid transferring MBs over CDP).
//
// Prerequisites:
//   1. npm run dev            (in another terminal; serves http://localhost:5173)
//   2. Google Chrome installed (macOS default path, override with CHROME_PATH)
//
// Run:
//   node scripts/verify-determinism.mjs              # afterimage, latest frame
//   SCULPT=1 FRAMES=8 node scripts/verify-determinism.mjs   # sculpture accumulate
//
// Env: CHROME_PATH, PORT (default 5173), SEED (default 12345), FRAMES, SCULPT, RUNS
//
// Requires puppeteer-core (devDependency). Exits non-zero on any mismatch.
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP = `http://localhost:${process.env.PORT || 5173}/`;
const SEED = parseInt(process.env.SEED || '12345', 10);
const FRAMES = parseInt(process.env.FRAMES || '1', 10);
const SCULPT = process.env.SCULPT === '1';
const RUNS = parseInt(process.env.RUNS || '3', 10);
const BINS = 512;

// Deterministic synthetic spectrum so the INPUT is fixed across runs.
const history = Array.from({ length: FRAMES }, (_, f) =>
  Array.from({ length: BINS }, (_, b) => {
    const v = 128 + 90 * Math.sin(b * 0.05 + f * 0.7) * Math.cos(b * 0.013 + f * 0.31);
    return Math.max(0, Math.min(255, Math.round(v)));
  }),
);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 120000,
  args: ['--no-sandbox', '--disable-gpu'],
});

let failed = false;
try {
  const page = await browser.newPage();
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(
    () =>
      window.__sc &&
      window.__sc.state &&
      typeof window.keyPressed === 'function' &&
      typeof window.save === 'function',
    { timeout: 20000 },
  );

  const enabled = await page.evaluate(() => {
    const p = window.__sc.collectRenderParams();
    const b = {};
    for (const k of Object.keys(p.bands || {})) if (p.bands[k].enabled) b[k] = p.bands[k].drawFunc;
    return { bands: b, ring: p.spectrumRing.enabled, diff: p.spectrumDiff.enabled };
  });
  console.log('Enabled styles:', JSON.stringify(enabled.bands), '| ring', enabled.ring, 'diff', enabled.diff);

  await page.evaluate(
    ({ h, seed, sculpt }) => {
      window.__sc.state.spectrumHistory = h;
      window.__sc.state.prevSpectrum = h[h.length - 1];
      window.__sc.state.currentInputMode = 'file';
      window.__sc.state.renderSeed = seed;
      if (sculpt) {
        for (const cb of document.querySelectorAll('input[type=checkbox]')) {
          const label = cb.closest('label') || cb.parentElement;
          if (/sculpt|彫刻|スカルプ/i.test((label && label.textContent) || '') && !cb.checked) cb.click();
        }
      }
    },
    { h: history, seed: SEED, sculpt: SCULPT },
  );

  const hashes = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await page.evaluate(async () => {
      const orig = window.save;
      let cap = null;
      window.save = function (pg) {
        const root = pg && pg.elt && pg.elt.svg;
        cap = root ? root.outerHTML : null;
      };
      window.key = 's';
      window.keyPressed();
      window.save = orig;
      if (cap == null) return { error: 'no svg captured' };
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cap));
      const hash = Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join('');
      return { len: cap.length, hash };
    });
    if (r.error) {
      console.log(`Run ${i + 1}: ERROR ${r.error}`);
      hashes.push(null);
      continue;
    }
    hashes.push(r.hash);
    console.log(`Run ${i + 1}: ${r.len} bytes  sha=${r.hash.slice(0, 16)}`);
  }

  const valid = hashes.filter(Boolean);
  const allSame = valid.length >= 2 && valid.every((h) => h === valid[0]);
  console.log(`\n[determinism] FRAMES=${FRAMES} SCULPT=${SCULPT} SEED=${SEED}: ${allSame ? '✓ byte-identical' : '✗ MISMATCH'}`);
  if (!allSame) failed = true;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
