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
// Run:
//   WORKERS_DEV_SUBDOMAIN=<account-subdomain> pnpm verify:exposure
//
// The account's workers.dev subdomain is not committed here (this repo is
// public), so pass it in the environment. Exits non-zero on any failed check.

const WORKER = 'studio-spectrum-chisel';
const CUSTOM_DOMAIN = 'https://studio.spectrum-chisel.tak3.jp/';
const SUBDOMAIN = process.env.WORKERS_DEV_SUBDOMAIN;
const TIMEOUT_MS = 15000;

if (!SUBDOMAIN) {
  console.error(
    'WORKERS_DEV_SUBDOMAIN is not set. Pass the account workers.dev subdomain, e.g.\n' +
      '  WORKERS_DEV_SUBDOMAIN=example-1234 pnpm verify:exposure'
  );
  process.exit(2);
}

// A version prefix that was never deployed: Access answers before Worker
// routing does, so a gated preview hostname still redirects to the login.
const PREVIEW_PROBE = `https://exposure-probe-${WORKER}.${SUBDOMAIN}.workers.dev/`;
const PRODUCTION_DEV = `https://${WORKER}.${SUBDOMAIN}.workers.dev/`;

async function probe(url) {
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { status: res.status, location: res.headers.get('location') ?? '' };
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
    name: 'custom domain serves the Worker',
    url: CUSTOM_DOMAIN,
    verdict: (r) =>
      r.status === 200
        ? { ok: true, detail: '200' }
        : {
            ok: false,
            detail: `expected 200, got ${r.status} — is the custom domain still attached to ${WORKER}?`,
          },
  },
  {
    name: 'production workers.dev URL is not public',
    url: PRODUCTION_DEV,
    verdict: (r) => {
      if (r.status === 200) {
        return {
          ok: false,
          detail:
            '200 — the public workers.dev URL is serving. Check `workers_dev: false` in wrangler.jsonc.',
        };
      }
      return {
        ok: true,
        detail: isAccessLogin(r)
          ? `${r.status} to Cloudflare Access (gated; the disabled/enabled state is masked by Access)`
          : `${r.status} (workers.dev disabled)`,
      };
    },
  },
  {
    name: 'preview URLs are gated by Cloudflare Access',
    url: PREVIEW_PROBE,
    verdict: (r) => {
      if (isAccessLogin(r)) return { ok: true, detail: `${r.status} to Cloudflare Access` };
      if (r.status === 200) {
        return {
          ok: false,
          detail:
            '200 — preview hostnames are publicly reachable. The Access policy is gone or no longer covers them.',
        };
      }
      return {
        ok: false,
        detail:
          `${r.status} without an Access redirect — either Preview URLs are disabled ` +
          `(check \`preview_urls\` in wrangler.jsonc) or the Access application no longer covers *-${WORKER}.`,
      };
    },
  },
];

let failed = 0;
for (const check of checks) {
  const result = await probe(check.url);
  const { ok, detail } = result.error
    ? { ok: false, detail: `request failed: ${result.error}` }
    : check.verdict(result);
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${check.name}\n      ${check.url}\n      ${detail}`);
}

console.log(
  failed === 0
    ? `\nExposure is as intended (${checks.length}/${checks.length} checks passed).`
    : `\n${failed} of ${checks.length} checks failed.`
);
process.exit(failed === 0 ? 0 : 1);
