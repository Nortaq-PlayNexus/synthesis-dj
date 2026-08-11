# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Repository hardening: issue & PR templates, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`, `ROADMAP.md`, `LICENSE`.
- Full documentation set under `docs/` and a README with real UI screenshots.

## [1.0.0] - 2026-08-01

### Added

- **Playlist Queue**: ordered set roster with reorder (▲/▼), remove (✕), load &
  play (▶) and optional auto-advance that rolls to the next track when a deck
  finishes. Queue order persists across restarts via `localStorage`.
- **Beat Intelligence AI**: onset detection, autocorrelation + comb-filter BPM
  estimation (55–210 BPM) with sub-BPM refinement, phase alignment and per-track
  beat grids.
- **Harmonic Intelligence AI**: Krumhansl–Schmuckler key detection with Camelot
  wheel codes (chroma space keyed at A = 0).
- **Emotion Flow Engine**: per-beat RMS energy profiling, predicted drop points and
  an emotional profile per track (Deep/Dark → Euphoric).
- **Music DNA**: compact per-track fingerprint (`bpm|camelot` + energy trend,
  drops, genre guess, emotion) consumed by the AI layer.
- **AI Transition Director**: phrase mixing, drop alignment and energy breakdown
  decisions with action lists and confidence scores.
- **Autonomous modes**: ASSIST / HYBRID / AUTONOMOUS with live crossfader, beat
  sync, EQ stem matrix, FX bus (echo, beat echo, reverb, filter, riser), loops,
  pitch and jog wheels.
- **Crowd Intelligence**: set-level analysis (average BPM, peak track, storyline).
- **Optional Neural Advisor**: any OpenAI-compatible chat-completions endpoint for
  tactical DJ narration; fully offline fallback.
- **Electron security posture**: `contextIsolation`, no Node in renderer,
  sandboxed preload bridge, strict CSP.
- **Tooling**: ESLint (flat config), Prettier, Vitest unit + integration suite
  (offline `AudioContext` synthetic tracks), Electron smoke test, screenshot
  capture mode, electron-builder packaging, GitHub Actions CI + release workflows.

### Fixed

- A=0 chroma mapping so note names and Camelot tables align (unit-tested).
- Comb-based BPM refinement resolving borderline tempos to exact values
  (e.g. 127.92 → 128.00 on the synthetic 128 BPM fixture).
- `track.analysis.dna.name` now mirrors the track name for AI narration.
- Windows vertical range inputs use `writing-mode: vertical-lr; direction: rtl`
  instead of the deprecated `slider-vertical`.

[Unreleased]: https://github.com/Nortaq-PlayNexus/synthesis-dj/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Nortaq-PlayNexus/synthesis-dj/releases/tag/v1.0.0
