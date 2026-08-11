# Contributing to SYNTHESIS

Thanks for wanting to improve SYNTHESIS. This is a small, focused project, so a few
ground rules keep it maintainable.

## Code of conduct

Read and follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Everyone is expected to be
civil, constructive and inclusive.

## Getting started

```bash
git clone https://github.com/Nortaq-PlayNexus/synthesis-dj.git
cd synthesis-dj
npm ci
npm start          # run the app
npm run verify     # lint + format + test + smoke
```

## Before you open a PR

1. **File an issue first** (or pick one already labeled `good first issue` /
   `help wanted`) and describe what you intend to change. This avoids duplicate work
   and lets maintainers steer scope.
2. **Keep changes focused.** One logical change per PR. Large refactors should be
   discussed before being drafted.
3. **Run `npm run verify` locally** and ensure it is green. The same suite runs in CI
   on every PR.
4. **Add tests** for new behavior:
   - Pure DSP/analysis logic → `test/unit/analyzer.test.js`
   - AI scoring/decision logic → `test/unit/ai.test.js`
   - Cross-module flows → `test/integration/pipeline.test.js`
   - Use `test/helpers/synth.js` to synthesize controlled inputs; analysis is
     deterministic, so assertions are stable.
5. **Update docs** if you change public APIs, the UI, or the CLI scripts
   (`docs/`, `README.md`).
6. **Regenerate screenshots** (`npm run screenshots`) if the UI layout changes, and
   commit the new PNGs.

## Code conventions

- Renderer code is ES modules; main/preload are CommonJS. Don't mix.
- No production dependencies; if a feature needs one, discuss it first.
- Follow existing naming and formatting — Prettier and ESLint are enforced, so
  `npm run format` before committing keeps the diff clean.
- Don't add comments unless they earn their place; prefer clear code.
- Keep the CSP tight. The only wildcard is `connect-src *` (needed for the optional
  LLM advisor). Never add `unsafe-eval` or inline scripts.

## Commit conventions

- Write a concise summary line describing _what and why_ (50–72 chars), optionally
  followed by a blank line and details.
- Prefix when it helps: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Reference the issue number in the body when applicable, e.g. `Closes #12`.

## Review process

- A maintainer reviews the PR; expect questions, not resistance.
- CI must pass (lint, format, tests, Electron smoke).
- PRs that change behavior should include or reference tests + docs updates.

## Release flow

Maintainers cut releases by tagging `v*`; see [docs/deployment.md](docs/deployment.md).
Contributors generally don't need to worry about this.

## Questions?

Open a discussion or ask in the issue thread. Be specific: include your OS, Node
version, and the output of `npm run verify` when reporting problems.
