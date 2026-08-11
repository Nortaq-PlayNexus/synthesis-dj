# Development guide

## Tooling

| Tool                   | Config              | What it checks                                                                         |
| ---------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| ESLint 9 (flat config) | `eslint.config.mjs` | `js.configs.recommended`; per-directory globals (browser vs node vs test).             |
| Prettier 3             | `.prettierrc.json`  | Formatting (2-space, single quotes, semicolons, width 100).                            |
| Vitest                 | `vitest.config.mjs` | Node environment; tests in `test/**/*.test.js`; v8 coverage over `src/renderer/js/**`. |
| electron-builder       | in `package.json`   | Installer targets.                                                                     |

## Quick verification

```bash
npm run verify   # lint → format:check → test → smoke, in order
```

Any failure aborts the chain. The individual commands are:

```bash
npm run lint
npm run format:check
npm test
npm run smoke
```

## Test conventions

- **Unit** (`test/unit/*.test.js`) — pure function/class behavior, no DOM:
  - `analyzer.test.js` — tempo/key/Camelot/energy/DNA behavior over synthesized
    buffers (e.g. a 128 BPM kick pattern must resolve to 128.00 BPM; a C-major
    chord set must resolve to the right key).
  - `ai.test.js` — Camelot adjacency, transition scoring weights, ranking, set
    building, crowd analysis, LLM fallback.
- **Integration** (`test/integration/pipeline.test.js`) — full chain:
  `synth helper → decodeAudioData → analyzeAudioBuffer → build DNA → recommend`,
  asserting end-to-end invariants (monotonic rank, valid Camelot codes, etc.).
- **Helper** (`test/helpers/synth.js`) — creates an offline `AudioContext` and
  synthesizes controllable tracks (kick on the beat, drone root, melody scale).
  Because analysis is deterministic, assertions are stable across platforms.

To add coverage for a new analyzer stage, synthesize a minimal buffer that isolates
the signal you want (a pure sine for key, a click train for BPM) and assert the
result — see existing tests for the pattern.

## The smoke test

`npm run smoke` launches the real Electron app with `SYNTH_SMOKE=1`. The main
process injects a script that synthesizes a 20-second 128 BPM buffer, runs
`analyzeAudioBuffer` in the real renderer, and prints:

```
[SMOKE-ANALYSIS] BPM=128.00 KEY=C MAJ CAMELOT=8B BEATS=42 DROPS=0
[SMOKE-ANALYSIS] OK
SMOKE_COMPLETE
```

Exit code is non-zero if the app failed to load or the analysis threw. **On Windows
the smoke failure path prints no detail** — exit code only. For full error text run
`npm test` or a direct `node`/JS invocation of the analyzer.

## Regenerating assets

Screenshots and the logo are rendered from the real UI, not drawn by hand:

```bash
npm run screenshots   # SYNTH_CAPTURE=1 → command-center.png, autonomous-mix.png, command-bar.png
npm run assets        # screenshots + logo.png render (spawns the capture mode)
```

The capture flow lives in `src/main/main.js` (`runCapture`). The renderer exposes
`window.__captureReady` / `__captureStage2` / `__captureStage2Done` (set in
`app.js`) so the main process knows when the demo state is fully rendered before
grabbing each frame. If you change the layout, regenerate the screenshots.

> Keep committed screenshots reasonably current; the README embeds them.

## Project layout

```
src/
  main/main.js          # Electron main process
  preload/preload.js    # contextBridge
  renderer/
    index.html          # layout + CSP
    css/styles.css      # theme
    js/analyzer.js      # DSP analysis
    js/engine.js        # audio engine + decks
    js/ai.js            # AI advisor / director
    js/app.js           # UI wiring + render loop
test/
  unit/                 # analyzer + ai tests
  integration/          # end-to-end pipeline
  helpers/synth.js      # synthetic track builder
assets/
  logo.svg / logo.png
  screenshots/
docs/                   # this documentation set
.github/workflows/      # CI + release
```

## Code conventions

- **No comments unless asked** — keep the code self-documenting; the module headers
  describe intent at the top of each file.
- **ES modules** in the renderer (`<script type="module">`); **CommonJS** in main
  and preload. Don't mix.
- All config lives in the repo root; there is no hidden toolchain state.
- Vertical ranges (EQ/volume) must keep the `writing-mode: vertical-lr;
direction: rtl` CSS (Chromium deprecated `slider-vertical`).
- On Windows, editors write CRLF; Prettier normalizes to LF, so `format:check` is
  authoritative. Re-run `npm run format` after manual edits if needed.

## Workflows

The GitHub Actions suite runs three jobs on push/PR to `main`:

1. **Lint & Format** — `npm run lint` + `npm run format:check`.
2. **Unit & Integration Tests** — `npm test`.
3. **Electron Smoke** — real Electron under `xvfb-run` with `SYNTH_SMOKE=1`
   (sandbox disabled for the Linux CI runner).

Releases are triggered by `v*` tags; see [deployment.md](deployment.md).
