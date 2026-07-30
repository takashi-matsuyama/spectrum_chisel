import { describe, it, expect } from 'vitest';
import {
  LABEL,
  createChecks,
  isAccessLogin,
  resolveVerdict,
  summarize,
} from '../scripts/exposure-verdicts.mjs';

// The exposure probe's decision table decides whether a live deployment looks
// safe, and a branch that drifts the wrong way reads as "safe" while something is
// public. The table is duplicated in the site repo, so these cases also document
// what both copies are supposed to agree on.

const MARKER = '<title>Spectrum Chisel</title>';
const ACCESS_LOGIN = 'https://acct.cloudflareaccess.com/cdn-cgi/access/login/host?kid=x';

const [customDomain, productionDev, preview] = createChecks({
  worker: 'studio-spectrum-chisel',
  marker: MARKER,
  customDomainUrl: 'https://studio.example.test/',
  productionDevUrl: 'https://worker.subdomain.workers.dev/',
  previewProbeUrl: 'https://exposure-probe-worker.subdomain.workers.dev/',
});

/**
 * @param {number} status
 * @param {string} [body]
 * @param {string} [location]
 */
const seen = (status, body = '', location = '') => ({ status, location, body });

describe('isAccessLogin', () => {
  it('accepts a redirect to the account Access login', () => {
    expect(isAccessLogin(seen(302, '', ACCESS_LOGIN))).toBe(true);
  });

  it('rejects a 200 that merely mentions the Access host', () => {
    expect(isAccessLogin(seen(200, '', ACCESS_LOGIN))).toBe(false);
  });

  it('rejects lookalike hosts and a suffix used as a prefix', () => {
    expect(isAccessLogin(seen(302, '', 'https://evil-cloudflareaccess.com/'))).toBe(false);
    expect(isAccessLogin(seen(302, '', 'https://x.cloudflareaccess.com.evil.test/'))).toBe(false);
  });

  it('rejects a missing or malformed Location', () => {
    expect(isAccessLogin(seen(302))).toBe(false);
    expect(isAccessLogin(seen(302, '', 'not a url'))).toBe(false);
  });
});

describe('custom domain check', () => {
  /** @type {[string, ReturnType<typeof seen>, string][]} */
  const cases = [
    ['200 carrying the marker', seen(200, `<html>${MARKER}</html>`), 'pass'],
    ['200 serving something else', seen(200, '<title>Spectrum Chisel | Docs</title>'), 'fail'],
    ['200 with an empty body', seen(200), 'fail'],
    ['404', seen(404, 'nope'), 'fail'],
    ['redirect to Access', seen(302, '', ACCESS_LOGIN), 'fail'],
    ['500', seen(500, 'oops'), 'fail'],
  ];

  for (const [name, observation, expected] of cases) {
    it(`${name} -> ${expected}`, () => {
      expect(resolveVerdict(customDomain, observation).state).toBe(expected);
    });
  }
});

describe('production workers.dev check', () => {
  /** @type {[string, ReturnType<typeof seen>, string][]} */
  const cases = [
    ['200 serving this app', seen(200, `<html>${MARKER}</html>`), 'fail'],
    ['200 serving anything at all', seen(200, 'hello'), 'fail'],
    ['404 without the marker', seen(404, 'error code: 1042'), 'unverified'],
    ['404 while still serving this app', seen(404, `<html>${MARKER}</html>`), 'fail'],
    ['redirect to Access', seen(302, '', ACCESS_LOGIN), 'unverified'],
    ['redirect somewhere else', seen(302, '', 'https://example.test/'), 'fail'],
    ['204', seen(204), 'fail'],
    ['500', seen(500, 'oops'), 'fail'],
  ];

  for (const [name, observation, expected] of cases) {
    it(`${name} -> ${expected}`, () => {
      expect(resolveVerdict(productionDev, observation).state).toBe(expected);
    });
  }

  it('never claims an unverified state is proof', () => {
    for (const observation of [seen(404, 'error code: 1042'), seen(302, '', ACCESS_LOGIN)]) {
      const { state, detail } = resolveVerdict(productionDev, observation);
      expect(state).toBe('unverified');
      expect(detail).toContain('does not prove');
      expect(detail).toContain('dashboard');
    }
  });
});

describe('preview check', () => {
  /** @type {[string, ReturnType<typeof seen>, string][]} */
  const cases = [
    ['redirect to Access', seen(302, '', ACCESS_LOGIN), 'pass'],
    ['200', seen(200, 'hello'), 'fail'],
    ['404', seen(404, 'nope'), 'fail'],
    ['redirect somewhere else', seen(302, '', 'https://example.test/'), 'fail'],
  ];

  for (const [name, observation, expected] of cases) {
    it(`${name} -> ${expected}`, () => {
      expect(resolveVerdict(preview, observation).state).toBe(expected);
    });
  }

  it('passing the gate does not claim preview_urls is on', () => {
    const { detail } = resolveVerdict(preview, seen(302, '', ACCESS_LOGIN));
    expect(detail).toContain('says nothing about whether `preview_urls` is on');
  });
});

describe('resolveVerdict', () => {
  it('fails a request that never completed, on every check', () => {
    for (const check of [customDomain, productionDev, preview]) {
      const { state, detail } = resolveVerdict(check, { error: 'fetch failed' });
      expect(state).toBe('fail');
      expect(detail).toContain('request failed');
    }
  });
});

describe('summarize', () => {
  it('passes only when every check proved its state', () => {
    expect(summarize({ pass: 3, unverified: 0, fail: 0 }, 3)).toEqual({
      exitCode: 0,
      line: 'Exposure is as intended (3/3 verified).',
    });
  });

  it('stays green on unverified, without claiming the switch is off', () => {
    const { exitCode, line } = summarize({ pass: 2, unverified: 1, fail: 0 }, 3);
    expect(exitCode).toBe(0);
    expect(line).toContain('No unintended public exposure was observed');
    expect(line).toContain('could not be proven from outside');
  });

  it('exits non-zero as soon as one check fails, even alongside unverified ones', () => {
    expect(summarize({ pass: 1, unverified: 1, fail: 1 }, 3)).toEqual({
      exitCode: 1,
      line: '1 of 3 checks FAILED.',
    });
  });
});

describe('LABEL', () => {
  it('labels every state the verdicts can produce', () => {
    expect(LABEL).toEqual({ pass: 'PASS', unverified: 'UNVERIFIED', fail: 'FAIL' });
  });
});
