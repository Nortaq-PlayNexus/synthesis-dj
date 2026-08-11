# Architecture

SYNTHESIS is an Electron application with three isolated layers:

```
┌───────────────────────────────────────────────────────────────┐
│  MAIN PROCESS  (src/main/main.js)                              │
│  - Window lifecycle, app menu, dialog, secure IPC handlers    │
│  - Smoke test / screenshot capture / logo render modes         │
└───────────────▲───────────────────────────────────────────────┘
                │ contextBridge (window.synthesis)
┌───────────────▼───────────────────────────────────────────────┐
│  PRELOAD      (src/preload/preload.js)                         │
│  - Minimal, sandboxed, contextIsolated bridge                  │
└───────────────▲───────────────────────────────────────────────┘
                │
┌───────────────▼───────────────────────────────────────────────┐
│  RENDERER     (src/renderer/)  — ES modules                   │
│                                                               │
│  index.html  —  layout + strict CSP                           │
│  css/styles.css  —  dark sci-fi theme                         │
│  js/analyzer.js  —  DSP analysis  → analysis result + DNA     │
│  js/engine.js    —  AudioEngine + Deck (Web Audio graph)      │
│  js/ai.js        —  AIAdvisor (scoring, director, LLM)        │
│  js/app.js       —  UI wiring, canvas rendering, main loop     │
└───────────────────────────────────────────────────────────────┘
```

## Process boundaries & security

| Concern                 | Choice                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node access in renderer | Disabled (`nodeIntegration: false`)                                                                                                                                       |
| Isolated context        | Enabled (`contextIsolation: true`)                                                                                                                                        |
| Preload                 | A single thin `contextBridge` file (`src/preload/preload.js`)                                                                                                             |
| Renderer sandbox        | `sandbox: false` in the main window only because the file dialog IPC reads files; the logo-render window uses `sandbox: true`                                             |
| CSP                     | `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src *` — `connect-src *` is required for the optional LLM advisor |
| External windows        | All `window.open` is denied and routed to `shell.openExternal`                                                                                                            |

The renderer never touches the filesystem directly. The only privileged surface is
the `dialog:openAudio` IPC channel, which returns decoded file bytes to the renderer.

## Data flow

1. **Load** — the renderer calls `window.synthesis.openAudio(true)`; main opens the
   dialog, reads the files and returns `{ name, path, size, data: Uint8Array }[]`.
2. **Decode & analyze** — `app.js` decodes each buffer with `AudioContext.decodeAudioData`
   and passes it to `analyzeAudioBuffer` in `analyzer.js`.
3. **Compile DNA** — the analysis result is summarized into a compact `Music DNA`
   signature (see [analysis-engine.md](analysis-engine.md)).
4. **Dispatch** — tracks are assigned to `Deck` objects in `engine.js`, which build a
   Web Audio graph per deck (gain → EQ filters → FX bus → crossfader → master).
5. **Direct** — `app.js` runs the animation `loop()` every frame; `AIAdvisor` evaluates
   phrase position, predicted drops and energy to schedule crossfades and actions.
6. **Render** — canvas layers draw the battlefield, deck waveforms, jogs and meters.

## The analysis pipeline

`analyzeAudioBuffer(buffer, onProgress)` is the single entry point. Internally:

```
decode → downmix → resample (to 11025 Hz)        Harmonic Intelligence
              │                                        │
              ▼                                        ▼
      onset envelope                      Krumhansl key profiles
              │                                        │
              ▼                                        ▼
   autocorrelation + comb BPM           key + Camelot code
              │
              ▼
   phase alignment → beat grid
              │
              ▼
        energy profile (per-beat)
              │
              ▼
     Music DNA  +  predicted drops
```

See [analysis-engine.md](analysis-engine.md) for the DSP details.

## The audio graph

Each `Deck` owns an isolated chain so any deck can be EQ'd, effected and
volume-controlled without touching its neighbors:

```
AudioBufferSourceNode ── gain ── low ── mid ── high  (BiquadFilters)
                                    │
                                    ▼
                            FX send (echo / beatEcho / reverb / filter / riser)
                                    │
                                    ▼
                     crossfader gain (deck A / deck B)
                                    │
                                    ▼
                        master gain ── master filter ── destination
```

- **Pitch** is implemented as `playbackRate` on the source node (range ±8%).
- **Looping** uses the source's loop points (`loopStart` / `loopEnd`).
- **Sync** uses the measured BPM of the reference deck to set the follower's
  playback rate so both beat grids lock.

## Module map

| File                          | Responsibility                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/main/main.js`            | Window, menu, IPC, file dialog, capture & smoke modes                                            |
| `src/preload/preload.js`      | `window.synthesis` bridge (`openAudio`, `openExternal`, `onMenuLoad`, `captureMode`, `platform`) |
| `src/renderer/js/analyzer.js` | All DSP analysis; exports `analyzeAudioBuffer`                                                   |
| `src/renderer/js/engine.js`   | `AudioEngine`, `Deck` — playback graph and beat sync                                             |
| `src/renderer/js/ai.js`       | `AIAdvisor`, `harmonicCompatibility`, `transitionCompatibility`, `CAMELOT_ADJACENCY`             |
| `src/renderer/js/app.js`      | Boot, event wiring, canvas rendering, director loop, capture helpers                             |
| `test/helpers/synth.js`       | Offline `AudioContext` + synthetic track generator for tests                                     |

## Configuration surface

There is no config file; behavior is controlled by:

- **Environment variables** (main process): `SYNTH_SMOKE=1` runs the smoke test,
  `SYNTH_CAPTURE=1` regenerates screenshots + logo.
- **UI controls** (renderer): mode selector (ASSIST/HYBRID/AUTONOMOUS), AI levels,
  transition style, crowd mode, and the LLM advisor settings.
