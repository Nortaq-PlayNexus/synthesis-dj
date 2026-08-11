/* SYNTHESIS - Music Intelligence Core
 * Beat Intelligence AI, Harmonic Intelligence AI, Energy Profiling
 * and Music DNA Mapping. Pure Web Audio / DSP, runs fully offline.
 */

// Chroma pitch-class space uses A=0 (chroma[0] = A), so note names and
// Camelot tables are keyed to that space.
export const KEY_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

// Camelot wheel: [camelotNumber, letter] keyed by chroma index (0 = A).
// Majors: A->11B, A#->6B, B->1B, C->8B, C#->3B, D->10B, D#->5B, E->12B, F->7B, F#->2B, G->9B, G#->4B
const MAJOR_CAMELOT = {
  0: [11, 'B'],
  1: [6, 'B'],
  2: [1, 'B'],
  3: [8, 'B'],
  4: [3, 'B'],
  5: [10, 'B'],
  6: [5, 'B'],
  7: [12, 'B'],
  8: [7, 'B'],
  9: [2, 'B'],
  10: [9, 'B'],
  11: [4, 'B'],
};
// Minors: A->8A, A#->3A, B->10A, C->5A, C#->12A, D->7A, D#->2A, E->9A, F->4A, F#->11A, G->6A, G#->1A
const MINOR_CAMELOT = {
  0: [8, 'A'],
  1: [3, 'A'],
  2: [10, 'A'],
  3: [5, 'A'],
  4: [12, 'A'],
  5: [7, 'A'],
  6: [2, 'A'],
  7: [9, 'A'],
  8: [4, 'A'],
  9: [11, 'A'],
  10: [6, 'A'],
  11: [1, 'A'],
};

function downmix(buffer) {
  const ch = buffer.numberOfChannels;
  const len = buffer.length;
  const out = new Float32Array(len);
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let c = 0; c < ch; c++) s += data[c][i];
    out[i] = s / ch;
  }
  return out;
}

function resample(mono, sr, target) {
  const ratio = target / sr;
  const outLen = Math.floor(mono.length * ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i / ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, mono.length - 1);
    const frac = src - i0;
    out[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
  }
  return out;
}

function onsetEnvelope(mono, sr) {
  const frame = 512;
  const hop = 256;
  const n = mono.length;
  const numFrames = Math.floor((n - frame) / hop);
  const env = new Float32Array(numFrames);
  const hann = new Float32Array(frame);
  for (let i = 0; i < frame; i++) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frame - 1)));
  const prev = new Float32Array(frame);
  for (let f = 0; f < numFrames; f++) {
    const off = f * hop;
    let energy = 0;
    for (let i = 0; i < frame; i++) {
      const v = mono[off + i] * hann[i];
      const d = v - prev[i];
      energy += d * d;
      prev[i] = v;
    }
    env[f] = Math.sqrt(energy);
  }
  const envSr = sr / hop;
  const smooth = new Float32Array(numFrames);
  let sum = 0;
  for (let i = 0; i < numFrames; i++) sum += env[i];
  const mean = sum / numFrames;
  for (let i = 0; i < numFrames; i++) smooth[i] = Math.max(0, env[i] - mean);
  return { env: smooth, sr: envSr };
}

function autocorrAt(env, lag) {
  const n = env.length;
  let sum = 0;
  for (let i = 0; i + lag < n; i += 4) sum += env[i] * env[i + lag];
  return sum / (n - lag);
}

function interpEnv(env, i) {
  const l = Math.floor(i);
  const f = i - l;
  return l + 1 < env.length ? env[l] * (1 - f) + env[l + 1] * f : env[l];
}

function combScore(env, lag) {
  const len = env.length;
  let best = -Infinity;
  const step = Math.max(1, Math.floor(lag / 60));
  for (let p = 0; p < lag; p += step) {
    let score = 0;
    for (let k = 0; ; k++) {
      const pos = p + k * lag;
      if (pos >= len - 1) break;
      score += interpEnv(env, pos);
    }
    if (score > best) best = score;
  }
  return best;
}

function refineBPM(env, sr, bpm) {
  let best = bpm;
  let bestScore = -Infinity;
  for (let b = bpm - 1.5; b <= bpm + 1.5; b += 0.02) {
    const s = combScore(env, sr / (b / 60));
    if (s > bestScore) {
      bestScore = s;
      best = b;
    }
  }
  return best;
}

function estimateBPM(env, sr) {
  const minLag = (sr * 60) / 210;
  const maxLag = (sr * 60) / 55;
  const minL = Math.floor(minLag);
  const maxL = Math.ceil(maxLag);
  let bestLag = minL;
  let bestScore = -Infinity;
  const scores = new Float32Array(maxL + 1);
  for (let lag = minL; lag <= maxL; lag++) {
    const s = autocorrAt(env, lag);
    scores[lag] = s;
    if (s > bestScore) {
      bestScore = s;
      bestLag = lag;
    }
  }
  const raw = (sr / bestLag) * 60;
  let refined = refineBPM(env, sr, raw);

  const candidates = [];
  for (const mult of [0.5, 1, 1.5, 2, 3]) {
    const bpm = refined * mult;
    if (bpm < 55 || bpm > 210) continue;
    const score = combScore(env, sr / (bpm / 60));
    candidates.push({ bpm, score });
  }
  candidates.sort((a, b) => b.score - a.score);

  let chosen = candidates[0] || { bpm: refined };
  const near120 = candidates.filter((c) => Math.abs(c.bpm - 124) < 8);
  if (near120.length && near120[0].score > chosen.score * 0.97) chosen = near120[0];

  const final = refineBPM(env, sr, chosen.bpm);
  const bpm = Math.round(final * 100) / 100;
  const beatLength = 60 / bpm;
  return { bpm, beatLength, bestLag: Math.round(sr / (bpm / 60)) };
}

function estimatePhase(env, sr, beatLength) {
  const beatLag = Math.round(sr * beatLength);
  const n = env.length;
  let bestPhase = 0;
  let bestScore = -Infinity;
  for (let p = 0; p < beatLag; p += Math.max(1, Math.floor(beatLag / 60))) {
    let score = 0;
    for (let k = 0; p + k * beatLag < n; k++) score += env[p + k * beatLag];
    if (score > bestScore) {
      bestScore = score;
      bestPhase = p;
    }
  }
  return bestPhase / sr;
}

function buildBeatGrid(duration, bpm, phase) {
  const beatLength = 60 / bpm;
  const beats = [];
  for (let t = phase; t < duration - 0.02; t += beatLength) beats.push(t);
  return beats;
}

function detectKey(mono, sr) {
  const fftSize = 4096;
  const hop = 2048;
  const n = mono.length;
  const numFrames = Math.floor((n - fftSize) / hop);
  if (numFrames < 2) return { root: 0, mode: 'major', name: 'C major' };
  const chroma = new Float32Array(12);
  const hann = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++)
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);

  for (let f = 0; f < numFrames; f += 2) {
    const off = f * hop;
    for (let i = 0; i < fftSize; i++) {
      re[i] = mono[off + i] * hann[i];
      im[i] = 0;
    }
    const spectrum = fft(re, im);
    for (let bin = 2; bin < fftSize / 2; bin++) {
      const freq = (bin * sr) / fftSize;
      if (freq < 55 || freq > 5000) continue;
      const pc = Math.round(12 * Math.log2(freq / 440)) % 12;
      const p = ((pc % 12) + 12) % 12;
      chroma[p] += spectrum.mag[bin] / Math.max(1, freq * 0.4);
    }
  }

  let max = 0;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > max) max = chroma[i];
  }
  for (let i = 0; i < 12; i++) chroma[i] = max > 0 ? chroma[i] / max : 0;

  const majorProf = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minorProf = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const norm = (a) => {
    const s = a.reduce((x, y) => x + y, 0);
    return a.map((v) => v / s);
  };
  const cm = norm(Array.from(chroma));
  const pmaj = norm(majorProf);
  const pmin = norm(minorProf);
  const corr = (a, b) => {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += a[i] * b[i];
    return sum;
  };

  let best = { root: 0, mode: 'major', score: -1 };
  for (let root = 0; root < 12; root++) {
    const rot = (p) => cm[(root + p) % 12];
    const rMaj = Array.from({ length: 12 }, (_, i) => rot(i));
    const rMin = Array.from({ length: 12 }, (_, i) => rot(i));
    const sMaj = corr(rMaj, pmaj);
    const sMin = corr(rMin, pmin);
    if (sMaj > best.score) best = { root, mode: 'major', score: sMaj };
    if (sMin > best.score) best = { root, mode: 'minor', score: sMin };
  }

  const name = `${KEY_NAMES[best.root]} ${best.mode === 'major' ? 'maj' : 'min'}`;
  const camelot = best.mode === 'major' ? MAJOR_CAMELOT[best.root] : MINOR_CAMELOT[best.root];
  return {
    root: best.root,
    mode: best.mode,
    name,
    camelot: `${camelot[0]}${camelot[1]}`,
    confidence: best.score,
  };
}

function energyProfile(mono, sr, beatLength) {
  const frame = Math.floor(sr * 0.5);
  const hop = Math.floor(sr * 0.25);
  const n = mono.length;
  const frames = [];
  for (let i = 0; i + frame < n; i += hop) {
    let sum = 0;
    for (let j = i; j < i + frame; j++) sum += mono[j] * mono[j];
    frames.push(Math.sqrt(sum / frame));
  }
  const frameSr = sr / hop;
  const maxRms = Math.max(...frames, 1e-6);
  const normalized = frames.map((v) => v / maxRms);

  const beatEnergy = [];
  const beatDuration = Math.max(1, Math.floor(frameSr * beatLength));
  for (let i = 0; i < normalized.length; i += beatDuration) {
    let sum = 0;
    let cnt = 0;
    for (let j = i; j < Math.min(i + beatDuration, normalized.length); j++) {
      sum += normalized[j];
      cnt++;
    }
    beatEnergy.push({ beat: beatEnergy.length, energy: cnt ? sum / cnt : 0 });
  }

  const smooth = smoothArray(normalized, 8);
  const peaks = [];
  for (let i = 6; i < smooth.length - 6; i++) {
    if (
      smooth[i] >= smooth[i - 1] &&
      smooth[i] >= smooth[i + 1] &&
      smooth[i] > smooth[i - 6] * 1.12 &&
      smooth[i] > 0.45
    ) {
      peaks.push({ time: i / frameSr, strength: smooth[i] });
    }
  }

  return {
    frames: normalized,
    frameSr,
    beats: beatEnergy,
    peaks: peaks.slice(0, 24),
    mean: normalized.reduce((a, b) => a + b, 0) / normalized.length,
  };
}

function smoothArray(arr, width) {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let cnt = 0;
    for (let j = Math.max(0, i - width); j <= Math.min(arr.length - 1, i + width); j++) {
      sum += arr[j];
      cnt++;
    }
    out[i] = sum / cnt;
  }
  return out;
}

function fft(re, im) {
  const n = re.length;
  if (n <= 1) return { re, im, mag: [Math.abs(re[0])] };
  const mag = new Float32Array(n >> 1);
  const N = 1 << Math.round(Math.log2(n));
  const a = new Float32Array(N);
  const b = new Float32Array(N);
  a.set(re.slice(0, N));
  b.set(im.slice(0, N));
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const ta = a[i];
      a[i] = a[j];
      a[j] = ta;
      const tb = b[i];
      b[i] = b[j];
      b[j] = tb;
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cr = 1,
        ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const uR = a[i + j];
        const uI = b[i + j];
        const vR = a[i + j + len / 2] * cr - b[i + j + len / 2] * ci;
        const vI = a[i + j + len / 2] * ci + b[i + j + len / 2] * cr;
        a[i + j] = uR + vR;
        b[i + j] = uI + vI;
        a[i + j + len / 2] = uR - vR;
        b[i + j + len / 2] = uI - vI;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  for (let i = 0; i < n >> 1; i++) {
    mag[i] = Math.sqrt(a[i] * a[i] + b[i] * b[i]);
  }
  return { re: a, im: b, mag };
}

function buildDNA({ bpm, key, camelot, energy, duration, peaks, genreGuess }) {
  const beatCount = Math.round(duration / (60 / bpm));
  const energyTrend = [];
  for (let i = 0; i < 8; i++) {
    const s = Math.floor((i * energy.beats.length) / 8);
    const e = Math.floor(((i + 1) * energy.beats.length) / 8);
    let sum = 0;
    for (let j = s; j < Math.min(e, energy.beats.length); j++) sum += energy.beats[j].energy;
    energyTrend.push(sum / Math.max(1, e - s));
  }
  return {
    signature: `${bpm.toFixed(1)}|${camelot}`,
    bpm,
    key: key.name,
    camelot,
    duration,
    beats: beatCount,
    energyTrend,
    predictedDrops: peaks,
    genreGuess: genreGuess || guessGenre(bpm, energy),
    emotionalProfile: emotionalProfile(energy, bpm),
    transitionScore: 0,
  };
}

function guessGenre(bpm, energy) {
  const b = bpm;
  if (b >= 172 && b <= 180 && energy.mean > 0.5) return 'Hardcore / Drum & Bass';
  if (b >= 160 && b <= 180) return 'Drum & Bass / Jungle';
  if (b >= 128 && b <= 140 && energy.mean > 0.55) return 'House / EDM';
  if (b >= 124 && b <= 128 && energy.mean > 0.5) return 'Deep House / Tech House';
  if (b >= 110 && b <= 124) return 'Progressive / Disco House';
  if (b >= 85 && b <= 100) return 'Hip-Hop / Trap';
  if (b >= 70 && b <= 85) return 'R&B / Soul';
  return 'Ambient / Downtempo';
}

function emotionalProfile(energy, bpm) {
  const drive = Math.min(1, bpm / 150);
  const intensity = energy.mean;
  const flow = Math.max(0, 1 - Math.abs(intensity - drive));
  const vibe = intensity * 0.5 + drive * 0.3 + flow * 0.2;
  if (vibe > 0.75) return 'Euphoric';
  if (vibe > 0.6) return 'Energetic';
  if (vibe > 0.45) return 'Groovy';
  if (vibe > 0.3) return 'Chill';
  return 'Deep / Dark';
}

export async function analyzeAudioBuffer(buffer, onProgress) {
  const duration = buffer.duration;
  onProgress(0.05, 'Decoding waveform...');
  const mono = downmix(buffer);
  const sr = buffer.sampleRate;
  const analysisSr = 11025;
  const resampled = resample(mono, sr, analysisSr);

  onProgress(0.2, 'Beat Intelligence: onset detection...');
  const { env, sr: envSr } = onsetEnvelope(resampled, analysisSr);
  onProgress(0.35, 'Beat Intelligence: tempo estimation...');
  const { bpm, beatLength, bestLag } = estimateBPM(env, envSr);
  onProgress(0.45, 'Beat Intelligence: phase alignment...');
  const phase = estimatePhase(env, envSr, beatLength);
  const beatTimes = buildBeatGrid(duration, bpm, phase);

  onProgress(0.55, 'Harmonic Intelligence: key detection...');
  const key = detectKey(resampled, analysisSr);

  onProgress(0.7, 'Energy profiling...');
  const energy = energyProfile(mono, sr, beatLength);

  onProgress(0.85, 'Mapping Music DNA...');
  const dna = buildDNA({ bpm, key, camelot: key.camelot, energy, duration, peaks: energy.peaks });

  onProgress(1, 'Analysis complete');
  return {
    bpm,
    beatLength,
    phase,
    bestLag,
    beatTimes,
    key,
    energy,
    dna,
    duration,
    sampleRate: sr,
    channels: buffer.numberOfChannels,
  };
}
