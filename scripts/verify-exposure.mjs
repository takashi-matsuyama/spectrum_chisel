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
// What it cannot prove, by construction: Cloudflare Access answers before Worker
// routing does, so on a hostname that Access fronts, the `workers_dev` /
// `preview_urls` booleans themselves are invisible from outside. Those checks
// report UNVERIFIED rather than PASS — read the dashboard or the control-plane
// API for the actual state. A check only passes when the response proves the
// intended state; anything unexpected fails rather than being waved through.
//
// Run:
//   WORKERS_DEV_SUBDOMAIN=<account-subdomain> pnpm verify:exposure
//
// The account's workers.dev subdomain is not committed here (this repo is
// public), so pass it in the environment. Exits non-zero on any failed check.
//
// Env: WORKERS_DEV_SUBDOMAIN (required), CUSTOM_DOMAIN (override the expected
// origin — for exercising this probe's own failure paths).

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

// A version prefix that was never deployed: Access answers before Worker routing
// does, so a gated preview hostname still redirects to the login.
const PREVIEW_PROBE = `https://exposure-probe-${WORKER}.${SUBDOMAIN}.workers.dev/`;
const PRODUCTION_DEV = `https://${WORKER}.${SUBDOMAIN}.workers.dev/`;

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

function isAccessLogin({ status, location }) {
  if (status < 300 || status >= 400) return false;
  try {
    return new URL(location).hostname.endsWith('.cloudflareaccess.com');
  } catch {
    return false;
  }
}

const checks = [
  {
    name: 'custom domain serves this Worker',
    url: CUSTOM_DOMAIN,
    readBody: true,
    verdict: (r) => {
      if (r.status !== 200) {
        return {
          state: 'fail',
          detail: `expected 200, got ${r.status} — is the custom domain still attached to ${WORKER}?`,
        };
      }
      if (!r.body.includes(APP_MARKER)) {
        return {
          state: 'fail',
          detail: `200 but the response does not contain ${APP_MARKER} — the domain may be attached to a different Worker, or serving a stale page.`,
        };
      }
      return { state: 'pass', detail: `200, and the response carries ${APP_MARKER}` };
    },
  },
  {
    name: 'production workers.dev URL is not publicly reachable',
    url: PRODUCTION_DEV,
    readBody: true,
    verdict: (r) => {
      if (r.status === 200) {
        return {
          state: 'fail',
          detail:
            '200 — the public workers.dev URL is serving. Check `workers_dev: false` in wrangler.jsonc.',
        };
      }
      // A disabled workers.dev hostname is answered by Cloudflare's routing
      // layer instead of the Worker: 404, and never this app's markup. (The
      // plain-text form of that error is `error code: 1042`, but whether you get
      // it or the HTML error page depends on the HTTP version negotiated, so
      // only the status and the absence of the marker are asserted. This Worker
      // serves index.html at `/`, so a live one cannot answer 404 here.)
      if (r.status === 404 && !r.body.includes(APP_MARKER)) {
        return {
          state: 'pass',
          detail: '404 from Cloudflare, not from this Worker — workers.dev is not serving',
        };
      }
      if (isAccessLogin(r)) {
        return {
          state: 'unverified',
          detail: `${r.status} to Cloudflare Access — not public, but Access fronts this hostname, so \`workers_dev\` itself is invisible from outside. Confirm the toggle in the dashboard or via the control-plane API.`,
        };
      }
      return {
        state: 'fail',
        detail: `unexpected ${r.status} — this does not prove the public URL is off (a Worker that is up but erroring looks like this too).`,
      };
    },
  },
  {
    name: 'preview hostnames are gated by Cloudflare Access',
    url: PREVIEW_PROBE,
    verdict: (r) => {
      if (isAccessLogin(r)) {
        return {
          state: 'pass',
          detail: `${r.status} to Cloudflare Access — the gate is in place (this says nothing about whether \`preview_urls\` is on: Access answers first)`,
        };
      }
      if (r.status === 200) {
        return {
          state: 'fail',
          detail:
            '200 — preview hostnames are publicly reachable. The Access policy is gone or no longer covers them.',
        };
      }
      return {
        state: 'fail',
        detail:
          `${r.status} without an Access redirect — either Preview URLs are disabled ` +
          `(check \`preview_urls\` in wrangler.jsonc) or the Access application no longer covers *-${WORKER}.`,
      };
    },
  },
];

const LABEL = { pass: 'PASS', unverified: 'UNVERIFIED', fail: 'FAIL' };
const tally = { pass: 0, unverified: 0, fail: 0 };

for (const check of checks) {
  const result = await probe(check.url, { readBody: check.readBody });
  const { state, detail } = result.error
    ? { state: 'fail', detail: `request failed: ${result.error}` }
    : check.verdict(result);
  tally[state] += 1;
  console.log(`${LABEL[state]}  ${check.name}\n      ${check.url}\n      ${detail}`);
}

if (tally.fail > 0) {
  console.log(`\n${tally.fail} of ${checks.length} checks FAILED.`);
  process.exit(1);
}
console.log(
  tally.unverified > 0
    ? `\nNothing is publicly exposed, but ${tally.unverified} of ${checks.length} checks could not be verified from outside (see UNVERIFIED above).`
    : `\nExposure is as intended (${checks.length}/${checks.length} verified).`
);
