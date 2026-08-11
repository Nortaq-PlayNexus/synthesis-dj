# Getting started

SYNTHESIS is a desktop application. It runs entirely on your machine and needs no
account, no network and no cloud service to do its core job.

## Requirements

- **Node.js 18+** and npm (the Electron binary is downloaded automatically during
  `npm ci`; a working internet connection is needed for the _first_ install only).
- A desktop OS: Windows 10+, macOS, or a Linux distribution with a graphical session
  and the Chromium sandbox available (see [Troubleshooting](#troubleshooting)).

## Install

```bash
git clone https://github.com/Nortaq-PlayNexus/synthesis-dj.git
cd synthesis-dj
npm ci
```

`npm ci` performs a clean, lockfile-pinned install. Use `npm install` instead only if
you intentionally want to update dependencies.

## Launch

```bash
npm start
```

You should see the boot overlay, then the command center UI with four status lights
(`SYSTEM ONLINE`, `NEURAL CORE ONLINE`, `ANALYSIS IDLE`, `AUDIO ARMED`).

## Load your first tracks

1. Click **LOAD TRACKS** or press `Ctrl/Cmd+O`.
2. Select one or more audio files. Supported extensions: `mp3`, `wav`, `ogg`, `flac`,
   `m4a`, `aac`, `mp4`, `aiff`, `wma`, `opus`.
3. Tracks are decoded, analyzed and assigned to decks automatically. The MUSIC
   INTELLIGENCE panel fills with BPM, key, Camelot code, energy, genre guess and the
   track's Music DNA signature.

## Play a set

- Press **PLAY** on a deck, or enable **AUTO MIX** to let the AI director drive the
  crossfader.
- **SYNC** aligns a deck's beat grid to the other deck.
- Use the EQ stem matrix (BASS / DRUM / VOX), FX bus (ECHO, BEAT ECHO, REVERB,
  FILTER, RISER), loops, pitch, and the master crossfader.

## Use the AI layer

- **AI RECOMMENDATIONS** ranks the library against the active deck by harmonic
  compatibility, BPM ratio and energy flow.
- Set **MIXING AI LEVEL**, **CREATIVITY LEVEL**, **TRANSITION STYLE** and
  **CROWD MODE** in the AUTONOMOUS CONTROL panel.
- The **NEURAL COMMAND FEED** prints every director decision with a confidence score.

### Optional: Neural Advisor (LLM)

The advisor is fully optional. To enable it:

1. Open the **NEURAL ADVISOR (OPTIONAL LLM)** section.
2. Provide a base URL, API key and model for any OpenAI-compatible endpoint, e.g.
   - OpenRouter: `https://openrouter.ai/api/v1`, model `openai/gpt-4o-mini`
   - Local Ollama: `http://localhost:11434/v1`, model `llama3.1`
3. Click **ENGAGE NEURAL ADVISOR**. Your key is kept in memory only (never persisted
   to disk) and all calls go directly from the renderer to the endpoint you choose.

## Keyboard shortcuts

| Key                  | Action                          |
| -------------------- | ------------------------------- |
| `Ctrl/Cmd+O`         | Load tracks                     |
| `Space`              | Toggle play on the focused deck |
| `F5` / `Ctrl/Cmd+R`  | Reload the renderer             |
| `F11` / `Ctrl+Cmd+F` | Toggle fullscreen               |

## Next steps

- Understand how the app is wired together: [Architecture](architecture.md)
- See exactly what the engine measures: [Analysis engine](analysis-engine.md)
- Learn how the AI makes decisions: [AI engine](ai-engine.md)
- Build, test and package: [Development](development.md), [Deployment](deployment.md)

## Troubleshooting

| Symptom                                          | Fix                                                                                                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Electron failed to install correctly`           | Re-run `node node_modules/electron/install.js` then `npm ci`.                                                                                                                      |
| Blank window on Linux CI / containers            | Run with `--no-sandbox` or set `ELECTRON_DISABLE_SANDBOX=1` (see the CI workflow).                                                                                                 |
| No audio playback                                | Confirm your system output device is active; Web Audio uses the default device.                                                                                                    |
| Vertical EQ sliders inverted                     | On Chromium the vertical ranges use CSS `writing-mode: vertical-lr; direction: rtl`; if you change the DOM, preserve those declarations (see `styles.css`).                        |
| `npm run verify` smoke fails silently on Windows | Smoke failure exits with a non-zero code without printing detail on Windows dev machines; run `npm test` for assertion text, or a direct `node`/JS invocation for full error text. |
