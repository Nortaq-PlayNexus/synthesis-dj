# Analysis engine

`src/renderer/js/analyzer.js` is a dependency-free DSP module. It runs fully offline
and needs nothing but the decoded `AudioBuffer` to produce a complete analysis.
The single public entry point is:

```js
import { analyzeAudioBuffer } from './analyzer.js';

const analysis = await analyzeAudioBuffer(buffer, (pct, label) => {
  console.log(`${(pct * 100).toFixed(0)}%`, label);
});
```

## Pipeline stages

### 1. Preprocessing

- **`downmix`** — averages all channels into a single `Float32Array`.
- **`resample`** — linearly interpolates the mono signal to **11025 Hz** so the
  expensive stages run on a fixed, small cost regardless of the source sample rate.

### 2. Beat Intelligence

**Onset envelope** (`onsetEnvelope`): a Hann-windowed spectral-difference approach.
Frames of 512 samples hop by 256 (envelope sample rate ≈ 43 Hz at 11 kHz input);
the per-sample delta energy is summed per frame and the DC mean is subtracted.

**Tempo estimation** (`estimateBPM`):

1. Autocorrelation over lags covering **55–210 BPM**.
2. The raw BPM (`sr / bestLag * 60`) is refined with a **comb filter** sweep
   (`refineBPM`, ±1.5 BPM at 0.02 BPM resolution). The comb aligns candidate lags to
   the envelope's periodic impulse train, which is far more robust than plain
   autocorrelation for drum-heavy material.
3. Multiple candidates (`refined × {0.5, 1, 1.5, 2, 3}`) are re-scored with the comb;
   the best is chosen, with a small bias toward the 116–132 BPM club range when
   scores are nearly equal.

**Phase alignment** (`estimatePhase`): the beat offset that maximizes the sum of
envelope energy at integer multiples of the beat period. This places beat zero
precisely on a real onset (e.g. the downbeat).

**Beat grid** (`buildBeatGrid`): `duration / beatLength` beat timestamps from phase.

### 3. Harmonic Intelligence (key detection)

`detectKey` implements a **Krumhansl–Schmuckler** key-finding algorithm:

1. An FFT (4096-point, radix-2, hop 2048) computes spectra for every other frame.
2. Frequency bins between **55 Hz and 5 kHz** are folded into a 12-bin **chroma
   vector**, magnitude-weighted by `1 / (freq * 0.4)` to emphasize lower octaves
   (where the root and fifth live).
3. The chroma vector is normalized, rotated across all 12 roots, and correlated
   against the Krumhansl major and minor probe tone profiles.
4. The root/mode with the highest correlation wins, giving `{ root, mode, name,
confidence }` plus a **Camelot code**.

Pitch-class space uses **A = 0**, so `KEY_NAMES[0] === 'A'`. The Camelot tables
(`MAJOR_CAMELOT` / `MINOR_CAMELOT`) map each chroma root to its wheel position, e.g.
A major → `11B`, A minor → `8A`. These tables live in the same file and are covered
by unit tests.

### 4. Energy profiling

`energyProfile` computes a rolling RMS energy curve (0.5 s frames, 0.25 s hop),
normalizes it, buckets it into per-beat averages, and smooths it (window width 8)
to find **predicted drops** — peaks that rise 12%+ above the local floor, sit above
0.45 normalized energy, and are true local maxima. Up to 24 peaks are retained, each
with `{ time, strength }`.

### 5. Music DNA

`buildDNA` compiles everything into the compact fingerprint the AI engine consumes:

| Field              | Meaning                                              |
| ------------------ | ---------------------------------------------------- |
| `signature`        | `"<bpm>                                              | <camelot>"` short form |
| `bpm`              | measured tempo                                       |
| `key`              | detected key name                                    |
| `camelot`          | Camelot wheel code                                   |
| `beats`            | total beat count                                     |
| `energyTrend`      | 8-bin energy trajectory (opening → climax)           |
| `predictedDrops`   | list of predicted drop points                        |
| `genreGuess`       | rule-based genre guess from BPM + mean energy        |
| `emotionalProfile` | one of Deep/Dark, Chill, Groovy, Energetic, Euphoric |
| `transitionScore`  | runtime field, used by the AI engine                 |

`guessGenre` and `emotionalProfile` are simple, transparent heuristics:

- Genre buckets keyed on BPM (e.g. 124–128 deep house, 160–180 D&B, 85–100 hip-hop).
- Emotion = blend of BPM-driven _drive_, mean _intensity_ and their _flow_ agreement.

## Output shape

`analyzeAudioBuffer` resolves to:

```js
{
  bpm, beatLength, phase, bestLag, beatTimes,   // beat intelligence
  key: { root, mode, name, camelot, confidence },// harmonic intelligence
  energy: { frames, frameSr, beats, peaks, mean },
  dna,                                        // music DNA fingerprint
  duration, sampleRate, channels,
}
```

## Design notes

- **Deterministic** — no randomness, no platform dependencies; the same buffer
  always yields the same analysis (this is what makes the unit + integration tests
  possible).
- **Pure functions** — `downmix`, `resample`, FFT, autocorrelation, comb scoring,
  etc. are top-level functions that are exported for tests via the module boundary
  behavior exercised in `test/unit/analyzer.test.js`.
- **Performance** — all heavy work is on downsampled mono data; typical full-track
  analysis completes in well under a second on modern hardware.
