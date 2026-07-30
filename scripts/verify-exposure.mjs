// Deployment exposure probe.
//
// Who can reach this Worker is decided by two switches that live in different
// places:
//
//   * `workers_dev` / `preview_urls` in wrangler.jsonc. Wrangler POSTs this
//     state on EVERY deploy, so dashboard toggles never win. Both keys are
//     declared explicitly so a deploy cannot silently re-open the public
//     *.workers.dev URL (with no `routes` in the config — custom domains are
//     managed in the dashboard — Wrangler would otherwise default them to on).
//   * The Cloudflare Access policy in front of the preview hostnames. There is
//     no Wrangler key for it, so `wrangler deploy` never touches it — which
//     also means it never repairs it. If that policy is deleted or narrowed,
//     nothing in this repo notices.
//
// This probe is the missing half: it asserts the intended exposure from the
// outside. Run it after a deploy, or whenever the dashboard was touched.
//
// What it cannot prove, by construction: neither switch is observable from
// outside. Cloudflare Access answers before Worker routing does, so on a
// hostname Access fronts, nothing behind it is visible at all; and a 404 only
// says that `/` did not serve this app, which an enabled Worker with a broken
// `/` also produces. Those checks report UNVERIFIED rather than PASS — the
// dashboard or the control-plane API has the actual state. A check passes only
// when the response proves the intended state, and anything unexpected fails
// rather than being waved through, so UNVERIFIED means "no unintended exposure
// seen, not proven off".
//
// The decision table lives in scripts/exposure-verdicts.mjs and is locked by
// test/exposure-verdicts.test.js; this file is the network and reporting half.
//
// Run:
//   WORKERS_DEV_SUBDOMAIN=<account-subdomain> pnpm verify:exposure
//
// The account's workers.dev subdomain is not committed here (this repo is
// public), so pass it in the environment. Exits non-zero on any failed check.
//
// Env: WORKERS_DEV_SUBDOMAIN (required), CUSTOM_DOMAIN (override the expected
// origin — for exercising this probe's own failure paths).
import { LABEL, createChecks, resolveVerdict, summarize } from './exposure-verdicts.mjs';

const WORKER = 'studio-spectrum-chisel';
const CUSTOM_DOMAIN = process.env.CUSTOM_DOMAIN || 'https://studio.spectrum-chisel.tak3.jp/';
// Identity marker: the instrument's own page title. The site (Starlight) renders
// `<title>Spectrum Chisel | Spectrum Chisel</title>`, so an exact match here also
// catches "the custom domain is serving the other Worker". Update it if the
// title changes — a stale marker fails loudly instead of passing silently.
const APP_MARKER = '<title>Spectrum Chisel</title>';
const SUBDOMAIN = process.env.WORKERS_DEV_SUBDOMAIN;
const TIMEOUT_MS = 15000;

if (!SUBDOMAIN) {
  console.error(
    'WORKERS_DEV_SUBDOMAIN is not set. Pass the account workers.dev subdomain, e.g.\n' +
      '  WORKERS_DEV_SUBDOMAIN=example-1234 pnpm verify:exposure'
  );
  process.exit(2);
}

const checks = createChecks({
  worker: WORKER,
  marker: APP_MARKER,
  customDomainUrl: CUSTOM_DOMAIN,
  productionDevUrl: `https://${WORKER}.${SUBDOMAIN}.workers.dev/`,
  // A version prefix that was never deployed: Access answers before Worker
  // routing does, so a gated preview hostname still redirects to the login.
  previewProbeUrl: `https://exposure-probe-${WORKER}.${SUBDOMAIN}.workers.dev/`,
});

/**
 * @param {string} url
 * @param {{ readBody?: boolean }} [options]
 */
async function probe(url, { readBody = false } = {}) {
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      // The signal covers the body read below too, so a stalled response cannot
      // hang the probe.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = readBody ? await res.text() : '';
    if (!readBody) await res.body?.cancel();
    return { status: res.status, location: res.headers.get('location') ?? '', body };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

const tally = { pass: 0, unverified: 0, fail: 0 };

for (const check of checks) {
  const result = await probe(check.url, { readBody: check.readBody });
  const { state, detail } = resolveVerdict(check, result);
  tally[state] += 1;
  console.log(`${LABEL[state]}  ${check.name}\n      ${check.url}\n      ${detail}`);
}

const { exitCode, line } = summarize(tally, checks.length);
console.log(`\n${line}`);
process.exit(exitCode);
