# Diagrams

Visual overviews of SYNTHESIS. Mermaid blocks render on GitHub; ASCII versions are
included for offline reading.

## 1. System overview

```mermaid
flowchart TB
    subgraph Main["MAIN PROCESS (Node)"]
        MW[BrowserWindow]
        MENU[App Menu]
        IPC[dialog:openAudio / shell:openExternal]
        CAP[Capture & Smoke modes]
    end

    subgraph Preload["PRELOAD (sandboxed)"]
        BR["contextBridge → window.synthesis"]
    end

    subgraph Renderer["RENDERER (Chromium)"]
        APP["app.js — boot, wiring, render loop"]
        AN["analyzer.js — DSP analysis"]
        EN["engine.js — AudioEngine / Deck"]
        AI["ai.js — AIAdvisor"]
        DOM["DOM + Canvas"]
    end

    MENU --> MW
    MW <--> IPC
    CAP --> MW
    IPC <--> BR
    BR <--> APP
    APP --> AN
    APP --> EN
    APP --> AI
    APP --> DOM
    EN --> AN
    AI --> EN
    AI --> AN
    AI --> DOM
```

ASCII:

```
  Main process ──menu:load──▶ window.synthesis ──▶ app.js
       ▲                                 │ decodeAudioData
       │ file bytes                      ▼
  dialog:openAudio  ◀──────────────── analyzer.js ──▶ analysis + DNA
                                            │
      shell:openExternal ◀── external link │
                                            ▼
                                       engine.js (decks)
                                            ▲
       UI controls ◀── app.js ◀── ai.js (director) ──▶ crossfader/stems
```

## 2. Audio graph per deck

```mermaid
flowchart LR
    SRC["AudioBufferSourceNode<br/>(playbackRate = pitch)"]
    G["gain (volume)"]
    LOW["low BiquadFilter"]
    MID["mid BiquadFilter"]
    HIGH["high BiquadFilter"]
    FX["FX bus<br/>echo | beatEcho | reverb | filter | riser"]
    XFA["crossfader gain A"]
    XFB["crossfader gain B"]
    MASTER["master gain"]
    MF["master lowpass"]
    COMP["DynamicsCompressor"]
    OUT["destination"]

    SRC --> G --> LOW --> MID --> HIGH
    HIGH --> XFA
    HIGH --> FX
    FX --> XFA
    SRC2["Deck B source chain"] --> XFB
    XFA --> MASTER
    XFB --> MASTER
    MASTER --> MF --> COMP --> OUT
```

Each deck owns its chain (volume → EQ → FX → crossfade gain). Only the crossfader
mixes A and B; the master strip is shared.

## 3. Analysis pipeline

```mermaid
flowchart TD
    BUF["AudioBuffer"]
    DOWN["downmix → mono"]
    RES["resample → 11025 Hz"]
    ONS["onset envelope<br/>Δ-energy, 512/256 window"]
    TEMPO["autocorrelation + comb<br/>BPM estimate 55–210"]
    PHASE["comb phase alignment"]
    GRID["beat grid"]
    FFT["FFT spectra"]
    CHROMA["chroma folding (A=0)"]
    KEY["Krumhansl–Schmuckler<br/>root + mode + Camelot"]
    ENERGY["RMS energy profile"]
    PEAKS["smoothed peaks → predicted drops"]
    DNA["Music DNA"]
    OUT["AnalysisResult"]

    BUF --> DOWN --> RES --> ONS --> TEMPO --> PHASE --> GRID
    RES --> FFT --> CHROMA --> KEY
    ONS --> ENERGY --> PEAKS
    GRID --> OUT
    KEY --> OUT
    ENERGY --> DNA
    PEAKS --> DNA
    KEY --> DNA
    DNA --> OUT
```

## 4. AI director loop (per animation frame)

```mermaid
flowchart TD
    LOOP["requestAnimationFrame(loop)"]
    POS["update deck positions"]
    RENDER["render battlefield / decks / meters"]
    PLAN["AIAdvisor.transitionPlan(A, B, library)"]
    Q{"decision due?<br/>pointSeconds reached?"}
    X["execute crossfade + actions"]
    N["AUTO MIX on?"]

    LOOP --> POS --> RENDER
    RENDER --> PLAN --> Q
    Q -- yes --> X --> N
    Q -- no --> N
    N -- yes --> X
    N -- no --> LOOP
    X --> LOOP
```

The director anchors on phrase boundaries (16 bars), predicted drops and energy
breakdowns, and only executes when the scheduled point is reached and AUTO MIX is
armed.

## 5. CI / release flow

```mermaid
flowchart LR
    PUSH["push / PR → main"] --> LINT["lint + format:check"]
    PUSH --> TEST["npm test (vitest)"]
    PUSH --> SMOKE["electron smoke (xvfb)"]
    LINT --> OK{all green}
    TEST --> OK
    SMOKE --> OK
    OK -- yes --> MR["maintainable"]
    OK -- no --> BLOCK["PR blocked / fix required"]

    TAG["push tag v*"] --> BLDWIN["build --win"]
    TAG --> BLDMAC["build --mac"]
    TAG --> BLDLNX["build --linux"]
    BLDWIN --> ART["upload artifacts"]
    BLDMAC --> ART
    BLDLNX --> ART
    ART --> REL["draft GitHub release"]
```

See [deployment.md](deployment.md) for the exact workflow definitions.
