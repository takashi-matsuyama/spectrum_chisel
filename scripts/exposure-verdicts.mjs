// Pure verdict logic for the deployment exposure probe (scripts/verify-exposure.mjs).
//
// The probe decides whether the live deployment is exposed the way this repo says
// it should be, so its decision table is the part worth locking down: each branch
// either clears a state or raises one, and a wrong branch reads as "safe". Keeping
// the table here, free of network I/O and printing, lets
// test/exposure-verdicts.test.js drive all of it offline; the runner is then only
// fetch, print, exit.
//
// Three states, because two would overclaim: `pass` means the response proves the
// intended state, `fail` raises anything unexpected, and `unverified` marks what
// cannot be seen from outside at all — Cloudflare Access answers before Worker
// routing, and a 404 only shows that `/` did not serve this app.

/**
 * @typedef {'pass' | 'unverified' | 'fail'} VerdictState
 * @typedef {{ state: VerdictState, detail: string }} Verdict
 * @typedef {{ status: number, location: string, body: string }} Observation
 * @typedef {{ error: string }} RequestFailure
 * @typedef {{ name: string, url: string, readBody?: boolean, verdict: (observation: Observation) => Verdict }} Check
 */

export const LABEL = { pass: 'PASS', unverified: 'UNVERIFIED', fail: 'FAIL' };

/**
 * True when the response is Cloudflare Access sending the visitor to its login.
 * Only the hostname suffix is trusted, so a lookalike host does not qualify.
 * @param {Observation} observation
 * @returns {boolean}
 */
export function isAccessLogin({ status, location }) {
  if (status < 300 || status >= 400) return false;
  try {
    return new URL(location).hostname.endsWith('.cloudflareaccess.com');
  } catch {
    return false;
  }
}

/**
 * The three checks the probe runs, in output order.
 * @param {object} config
 * @param {string} config.worker           Worker name, for the failure messages.
 * @param {string} config.marker           Identity marker expected in this app's HTML.
 * @param {string} config.customDomainUrl  The origin visitors are meant to use.
 * @param {string} config.productionDevUrl `<worker>.<subdomain>.workers.dev`.
 * @param {string} config.previewProbeUrl  A preview hostname that was never deployed.
 * @returns {Check[]}
 */
export function createChecks({
  worker,
  marker,
  customDomainUrl,
  productionDevUrl,
  previewProbeUrl,
}) {
  return [
    {
      name: 'custom domain serves this Worker',
      url: customDomainUrl,
      readBody: true,
      verdict: (r) => {
        if (r.status !== 200) {
          return {
            state: 'fail',
            detail: `expected 200, got ${r.status} — is the custom domain still attached to ${worker}?`,
          };
        }
        if (!r.body.includes(marker)) {
          return {
            state: 'fail',
            detail: `200 but the response does not contain ${marker} — the domain may be attached to a different Worker, or serving a stale page.`,
          };
        }
        return { state: 'pass', detail: `200, and the response carries ${marker}` };
      },
    },
    {
      name: 'production workers.dev URL is not publicly reachable',
      url: productionDevUrl,
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
        // plain-text form of that error is `error code: 1042`, but whether you
        // get it or the HTML error page depends on the HTTP version negotiated,
        // so only the status and the absence of the marker are asserted.) That
        // is not proof of `workers_dev: false` — an enabled Worker whose `/`
        // 404s answers the same way while its other paths keep serving — so
        // this is as far as the outside can see.
        if (r.status === 404 && !r.body.includes(marker)) {
          return {
            state: 'unverified',
            detail:
              '404, and not this app — `/` did not serve this app, which is all the response shows: it does not prove `workers_dev` is off, because an enabled Worker whose `/` 404s answers the same way. Confirm the toggle in the dashboard or via the control-plane API.',
          };
        }
        if (isAccessLogin(r)) {
          return {
            state: 'unverified',
            detail: `${r.status} to Cloudflare Access — not public, but Access fronts this hostname, so \`workers_dev\` is invisible from outside: the response does not prove it is off. Confirm the toggle in the dashboard or via the control-plane API.`,
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
      url: previewProbeUrl,
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
            `(check \`preview_urls\` in wrangler.jsonc) or the Access application no longer covers *-${worker}.`,
        };
      },
    },
  ];
}

/**
 * Apply a check to what the request returned. A request that never completed is
 * a failure, not an absence of evidence.
 * @param {Check} check
 * @param {Observation | RequestFailure} result
 * @returns {Verdict}
 */
export function resolveVerdict(check, result) {
  if ('error' in result) {
    return { state: 'fail', detail: `request failed: ${result.error}` };
  }
  return check.verdict(result);
}

/**
 * Collapse the run into an exit code and a closing line. UNVERIFIED keeps the
 * exit code at 0 — nothing was seen to be exposed — but the line must not claim
 * the switches are off.
 * @param {{ pass: number, unverified: number, fail: number }} tally
 * @param {number} total
 * @returns {{ exitCode: number, line: string }}
 */
export function summarize(tally, total) {
  if (tally.fail > 0) {
    return { exitCode: 1, line: `${tally.fail} of ${total} checks FAILED.` };
  }
  if (tally.unverified > 0) {
    return {
      exitCode: 0,
      line: `No unintended public exposure was observed, but ${tally.unverified} of ${total} checks could not be proven from outside (see UNVERIFIED above) — the dashboard or the control-plane API has the actual state.`,
    };
  }
  // Counted from the tally, not from `total`, so a run that somehow produced
  // fewer verdicts than checks cannot report a full house.
  return { exitCode: 0, line: `Exposure is as intended (${tally.pass}/${total} verified).` };
}
