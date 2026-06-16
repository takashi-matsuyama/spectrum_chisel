# Contributing to Spectrum Chisel

Thanks for your interest! Spectrum Chisel is a browser instrument that turns
sound into accumulating, exportable vector art. Contributions are welcome.

## Where to file what

- **Bug, feature idea, or question about the instrument** → open an issue:
  [takashi-matsuyama/spectrum_chisel/issues](https://github.com/takashi-matsuyama/spectrum_chisel/issues)
- **Documentation / landing-site content** → file on the site repository:
  [spectrum_chisel-site/issues](https://github.com/takashi-matsuyama/spectrum_chisel-site/issues)
- **Security-sensitive issue** → see the [Security policy](SECURITY.md); do not
  open a public issue.

## Development setup

```bash
git clone https://github.com/takashi-matsuyama/spectrum_chisel.git
cd spectrum_chisel
pnpm install
pnpm dev       # → http://localhost:5173
```

Prerequisites:

- Node.js **>= 20.19.0**
- pnpm (pinned via the `packageManager` field / lockfile)
- Git

## Checks

Run these before opening a pull request:

```bash
pnpm test        # Vitest (pure core)
pnpm typecheck   # tsc --checkJs
pnpm lint        # ESLint
pnpm build       # Vite production build
```

## Code conventions

- **JavaScript (ES modules) with JSDoc types**, checked by `tsc --checkJs`. There
  is no TypeScript migration.
- **p5.js runs in global mode.** Keep the drawing core (`src/core`, `src/drawing`)
  free of DOM and app-state coupling so it stays testable and reusable by the
  viewing window.
- **User-facing copy goes through i18n** (`src/i18n/locales/*.json`); developer
  strings (console, errors, comments) are English.
- **English only** for code, comments, commit messages, PR titles and
  descriptions, and issues.

## Commits and pull requests

- **Commit prefixes**: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- **One commit, one topic.** Avoid bundling unrelated edits.
- Branch from `main` using `<type>/<short-slug>` (e.g. `fix/mic-stop`).
- Pull request titles are a single declarative sentence.
