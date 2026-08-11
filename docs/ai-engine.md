# AI engine

`src/renderer/js/ai.js` contains the deterministic decision intelligence and the
optional LLM advisor. Everything here runs in the renderer process.

## Public API

```js
import {
  CAMELOT_ADJACENCY,
  harmonicCompatibility,
  transitionCompatibility,
  AIAdvisor,
} from './ai.js';
```

### `harmonicCompatibility(keyA, keyB)`

Compares two Camelot codes (e.g. `"11B"`, `"8A"`) and returns
`{ score, label }`:

| Case                          | Score | Label           |
| ----------------------------- | ----- | --------------- |
| Same code                     | 1.00  | Perfect match   |
| Same letter, adjacent number  | 0.92  | Harmonic energy |
| Same number, different letter | 0.85  | Relative key    |
| Same letter, within 1 step    | 0.75  | Close key       |
| Anything else                 | 0.35  | Dissonant       |
| Unknown / malformed code      | 0.30  | Unknown         |

`CAMELOT_ADJACENCY` is the wheel mapping `8→9→10→11→12→1→…→8` used to decide
"adjacent".

### `transitionCompatibility(dnaA, dnaB)`

Scores a potential A→B transition as a weighted blend:

```
score = harmonic * 0.5  +  bpmMatch * 0.3  +  energyFlow * 0.2
```

- **harmonic** — `harmonicCompatibility(dnaA.camelot, dnaB.camelot).score`.
- **bpmMatch** — `1 - |1 - bpmA/bpmB| * 8` clamped to [0, 1]; a near-perfect ratio
  (e.g. 128→128) scores ~1, a ratio of 1.25 (128→160) scores 0.
- **energyFlow** — `1 - |energyIncoming_start - energyPlaying_end| * 2.2`, rewarding
  sets where the next track opens at the energy level the current one closes at.

Returns `{ score, harmonic, bpmMatch, energyFlow, reasons[] }`.

### `class AIAdvisor`

Holds the tunable settings and exposes the director.

**Settings** (`advisor.settings`):

```js
{
  mixingLevel: 0.7,          // how aggressive the director is
  creativity: 0.6,           // creativity boost applied to rankings
  transitionStyle: 'cinematic', // cinematic | aggressive | smooth | minimal
  crowdMode: 'balanced',     // balanced | peak_hunting | build_up | cool_down
  llm: { enabled, baseUrl, apiKey, model },
}
```

**Methods**

| Method                                     | Purpose                                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `recommendNext(currentDna, library, opts)` | Ranks the library against the current track, returns top 8 with score breakdowns.                                 |
| `transitionPlan(deckA, deckB, library)`    | The core director decision. See below.                                                                            |
| `crowdAnalysis(setDnas)`                   | Whole-set intelligence: average BPM, peak-engagement track index, intensity, and an opening→resolution storyline. |
| `buildSet(startDna, library, length = 8)`  | Greedily chains `recommendNext` into a harmonic set of ≤ `length` tracks.                                         |
| `narrateWithLLM(context, onStatus)`        | Optional chat-completions call. Returns text or `null`.                                                           |

## The Transition Director

`transitionPlan` is called every frame by `app.js`. It decides **when** the next mix
happens and **what actions** to take:

1. **Anchor on structure** — computes the current 16-bar phrase (`4 × 4 beats`), the
   seconds to its end, and the next predicted drop ahead of the playhead.
2. **Pick a decision type**:
   - `drop alignment` — a predicted drop is coming; mix in 8 bars before impact.
   - `energy breakdown` — energy is about to fall; exit during the breakdown.
   - `phrase mix` — default clean mix at the phrase boundary.
3. **Confidence** — `drop alignment` scores 0.88, breakdown 0.80, phrase 0.72.
4. **Choose the next track** — `recommendNext` against the current DNA (creativity
   applies a ±0.1 boost).
5. **Emit actions** — e.g. _"Remove bass on incoming deck"_, _"Bring vocals in at the
   impact"_, _"Crossfade 24 beats before phrase end"_.

The results stream into the **NEURAL COMMAND FEED** and, in AUTONOMOUS mode, drive
the crossfader and EQ stems.

## Modes

| Mode       | Behavior                                                                                |
| ---------- | --------------------------------------------------------------------------------------- |
| ASSIST     | AI recommends; the DJ (you) executes.                                                   |
| HYBRID     | AI schedules mixes and the DJ can override; the director acts when you enable AUTO MIX. |
| AUTONOMOUS | Director owns the crossfader and stems end-to-end.                                      |

## Crowd Intelligence

`crowdAnalysis` builds a narrative for the loaded set: it finds the peak-engagement
track (strongest predicted drop), computes average BPM and crowd intensity, and labels
each track as `opening` / `building` / `climax zone` / `resolution` for storytelling.

## Optional LLM advisor

`narrateWithLLM` POSTs the current context (track DNA, transition plan, energy) as
JSON to any OpenAI-compatible endpoint:

```
POST <baseUrl>/chat/completions
Authorization: Bearer <apiKey>
{
  "model": "<model>",
  "messages": [system, user],
  "temperature": 0.7,
  "max_tokens": 400
}
```

Notes:

- The key lives **only in renderer memory** and is never written to disk.
- The request goes straight from the renderer to the endpoint; the CSP
  (`connect-src *`) permits arbitrary endpoints so you can use OpenRouter, local
  Ollama, LM Studio, etc.
- On any failure it falls back to the deterministic tactical engine with a status
  message — the app never depends on the LLM.
- The feed is sanitized before rendering (added as text content, not HTML).

## Testing

`test/unit/ai.test.js` covers harmonic compatibility boundaries, transition
compatibility weights, ranking order, set building, crowd analysis, and LLM
fallback behavior. `test/integration/pipeline.test.js` runs the full
decode → analyze → DNA → recommend pipeline against synthesized tracks.
