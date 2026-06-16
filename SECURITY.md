# Security Policy

Spectrum Chisel is a client-side browser instrument (p5.js, PWA). It runs
entirely in the browser, has no backend, and is deployed as static assets via
Cloudflare. This policy covers the instrument and this repository.

## Reporting a Vulnerability

Please **do not open a public GitHub issue** for security vulnerabilities.

Report it through GitHub Private Vulnerability Reporting (PVR):

> https://github.com/takashi-matsuyama/spectrum_chisel/security/advisories/new

Include:

- A clear description of the issue and its impact
- Steps to reproduce (proof-of-concept if possible)
- The affected file(s) / commit(s)
- Your suggested remediation (optional)

### Response timeline

We aim for:

- **Acknowledgement**: within 7 days of report
- **Initial assessment**: within 14 days
- **Fix or mitigation**: depends on severity

We follow coordinated disclosure and will credit reporters unless they prefer to
remain anonymous.

## Scope

In scope:

- The instrument running in the browser (e.g. content injection or XSS via a
  loaded audio file or an imported preset, unsafe handling of imported preset
  JSON)
- The service worker / PWA caching behaviour
- This repository's build and deploy configuration
- Dependency vulnerabilities that affect the built app

Out of scope:

- The audio path does not transmit data off the device, and there is no server
  component to attack
- The documentation site — report via
  [the site's security policy](https://github.com/takashi-matsuyama/spectrum_chisel-site/security/advisories/new)
- Browser, Cloudflare, GitHub, or npm platform security (please report to those
  vendors directly)
