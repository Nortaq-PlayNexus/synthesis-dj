# API reference

This document covers the public surfaces: the preload bridge, the IPC contract, and
the module APIs exported from the renderer packages.

## `window.synthesis` (preload bridge)

Exposed by `src/preload/preload.js` via `contextBridge`. This is the _only_ bridge
between the renderer and the main process.

```ts
interface SynthesisBridge {
  /** Open the native file dialog and return decoded file data. */
  openAudio(allowMultiple: boolean): Promise<AudioFile[]>;

  /** Open a URL in the system browser. */
  openExternal(url: string): Promise<void>;

  /** Subscribe to the File → Load Tracks menu action. */
  onMenuLoad(cb: () => void): void;

  /** True when the app is running in screenshot-capture mode. */
  captureMode: boolean;

  /** process.platform from the main process. */
  platform: string;
}

interface AudioFile {
  name: string; // basename
  path: string; // absolute path on disk
  size: number; // byte length
  data: Uint8Array; // raw file bytes
}
```

## IPC contract (main process)

| Channel              | Type                     | Request                    | Response                  |
| -------------------- | ------------------------ | -------------------------- | ------------------------- |
| `dialog:openAudio`   | `invoke`                 | `boolean` (allow multiple) | `AudioFile[]`             |
| `shell:openExternal` | `invoke`                 | `string` (url)             | `void`                    |
| `menu:load`          | `send` (main → renderer) | —                          | `void` (via `onMenuLoad`) |

`dialog:openAudio` reads files with `fs.readFileSync` and returns their bytes over
the bridge. Audio extensions accepted by the filter: `mp3`, `wav`, `ogg`, `flac`,
`m4a`, `aac`, `mp4`, `aiff`, `wma`, `opus`.

## `analyzer.js`

```js
export async function analyzeAudioBuffer(
  buffer: AudioBuffer,
  onProgress: (pct: number, label: string) => void,
): Promise<AnalysisResult>;

export const KEY_NAMES: string[]; // pitch-class names, A = 0
```

`AnalysisResult`:

```ts
interface AnalysisResult {
  bpm: number;
  beatLength: number; // seconds per beat
  phase: number; // first-beat offset in seconds
  bestLag: number;
  beatTimes: number[]; // beat timestamps
  key: {
    root: number; // 0..11 (A..G#)
    mode: 'major' | 'minor';
    name: string; // e.g. "A maj"
    camelot: string; // e.g. "11B"
    confidence: number;
  };
  energy: {
    frames: Float32Array; // normalized RMS curve
    frameSr: number;
    beats: { beat: number; energy: number }[];
    peaks: { time: number; strength: number }[];
    mean: number;
  };
  dna: MusicDNA;
  duration: number;
  sampleRate: number;
  channels: number;
}

interface MusicDNA {
  signature: string; // "<bpm>|<camelot>"
  bpm: number;
  key: string;
  camelot: string;
  duration: number;
  beats: number;
  energyTrend: number[]; // 8 bins, opening → climax
  predictedDrops: { time: number; strength: number }[];
  genreGuess: string;
  emotionalProfile: string;
  transitionScore: number;
}
```

## `engine.js`

```js
export class AudioEngine {
  ensure(): void;                 // lazily create + resume the AudioContext
  createDeck(name: string): Deck;
  setMasterFilter(freq: number): void;
  setMasterMute(muted: boolean): void;
  updatePositions(): void;        // refresh deck positions (called per frame)
}

export class Deck {
  loadBuffer(audioBuffer: AudioBuffer, analysis: AnalysisResult): Promise<void>;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seekTo(t: number): void;
  setPitch(p: number): void;       // percent, -8..8
  setVolume(v: number): void;      // 0..150
  setEq(band: string, val: number): void; // band: 'low' | 'mid' | 'high'
  setFxAmount(v: number): void;    // 0..100
  setFxType(type: string): void;   // none|echo|beatEcho|reverb|filter|riser
  setLoop(enable: boolean, start?: number, end?: number): void;
  clearLoop(): void;
  nudge(ms: number): void;         // beat-grid nudge
  getBPM(): number;
  currentBeat(): number;
  beatPhase(): number;
  syncTo(referenceDeck: Deck): void;  // tempo-match the beat grid
  setCross(level: number): void;   // crossfader 0..1
}
```

Notes:

- The engine creates one `AudioContext` with `latencyHint: 'interactive'`.
- Master chain: `masterFilter (lowpass) → dynamicsCompressor → analyser → destination`.
- Pitch is implemented via `playbackRate`; loops via source loop points; beat sync
  derives a follower playback rate from the reference deck's BPM.
- FX types: `echo` (delay), `beatEcho` (sync'd delay, default), `reverb`
  (convolver with generated impulse response), `filter` (resonant lowpass),
  `riser` (automated filtered riser). See `_buildFx`.

## `ai.js`

```js
export const CAMELOT_ADJACENCY: Record<number, number>;

export function harmonicCompatibility(keyA: string, keyB: string): {
  score: number;
  label: string;
};

export function transitionCompatibility(dnaA: MusicDNA, dnaB: MusicDNA): {
  score: number;
  harmonic: { score: number; label: string };
  bpmMatch: number;
  energyFlow: number;
  reasons: string[];
};

export class AIAdvisor {
  settings: {
    mixingLevel: number;
    creativity: number;
    transitionStyle: 'cinematic' | 'aggressive' | 'smooth' | 'minimal';
    crowdMode: 'balanced' | 'peak_hunting' | 'build_up' | 'cool_down';
    llm: { enabled: boolean; baseUrl: string; apiKey: string; model: string };
  };

  recommendNext(currentDna, library, opts?): RankedTrack[];   // top 8
  transitionPlan(deckA, deckB, library): TransitionPlan | null;
  crowdAnalysis(setDnas): CrowdAnalysis | null;
  buildSet(startDna, library, length?): MusicDNA[];
  narrateWithLLM(context, onStatus?): Promise<string | null>;
}

interface TransitionPlan {
  type: 'drop alignment' | 'energy breakdown' | 'phrase mix';
  pointSeconds: number;
  bars: number;
  confidence: number;
  nextTrack: string;
  nextScore: number;
  actions: string[];
}
```

See [ai-engine.md](ai-engine.md) for the scoring math.

## Environment variables (main process)

| Variable          | Effect                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `SYNTH_SMOKE=1`   | Run the in-Electron analysis smoke test, print results, exit.                                     |
| `SYNTH_CAPTURE=1` | Render the demo UI, capture screenshots to `assets/screenshots/`, render `assets/logo.png`, exit. |

Neither is set during normal use.
