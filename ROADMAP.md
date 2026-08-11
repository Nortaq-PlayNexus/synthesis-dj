# Roadmap

SYNTHESIS is an evolving autonomous music-intelligence platform. This roadmap is a
living document; priorities shift based on community feedback. Items are grouped by
theme, not promised dates.

## v1.x — Solidify the core

- [x] **Real-time analysis** — BPM, key/Camelot, energy, drops, Music DNA.
- [x] **AI transition director** — phrase/drop/breakdown mixing with actions.
- [x] **Autonomous modes** — ASSIST / HYBRID / AUTONOMOUS.
- [x] **Optional LLM advisor** — any OpenAI-compatible endpoint.
- [x] **Engineering hygiene** — lint, format, tests, smoke, CI/CD, docs.
- [ ] **Keyboard-driven flow** — full deck control without a mouse (next-priority).
- [ ] **Track library persistence** — remembered analysis cache so re-analysis of a
      library is instant.
- [ ] **Analysis quality pass** — tempo doubling/halving edge cases on real music,
      better off-beat phase handling, multi-band onset weighting.
- [ ] **EQ curves & stem visualization** — show filter curves on the waveform.

## v2.0 — Real-time mixing intelligence

- [ ] **Lookahead transport scheduler** — sample-accurate cue scheduling and
      beat-synced FX automation.
- [ ] **On-the-fly re-analysis** — re-analyze on drop/sample import without
      reloading the library.
- [ ] **Smart auto-mixing levels** — the director learns your EQ and crossfader
      taste per set and adapts `mixingLevel` automatically.
- [ ] **Cue points & memory** — user-managed cue/loop banks stored per track.
- [ ] **Export & recording** — capture a live mix to disk (WAV).
- [ ] **FX chain editor** — user-composable FX graph instead of the fixed bus.

## v3.0 — Networked & community

- [ ] **Remote control surface** — control SYNTHESIS from a phone/tablet UI.
- [ ] **Set sharing** — export/import sets (track order + DNA + mix decisions) as
      portable JSON.
- [ ] **Community analysis models** — pluggable analysis profiles (EDM, hip-hop,
      ambient) contributed by the community.
- [ ] **Plugin architecture** — allow third-party DSP/AI modules via a stable API.

## Non-goals (for now)

- Streaming/cloud DVS (mixxx-style timecode) — out of scope for the current
  offline-first identity.
- Automatic copyright-cleared music discovery.
- Native mobile builds (the audio engine is heavy enough to stay desktop-first).

## How to influence this

Open or upvote issues, contribute tests for real-world analysis edge cases, and share
analysis accuracy reports (track → expected BPM/key → measured) so the DSP pass list
is driven by data. See [CONTRIBUTING.md](CONTRIBUTING.md).
