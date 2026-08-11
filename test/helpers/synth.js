/**
 * Test helper that synthesizes a deterministic electronic track with a
 * known BPM, root note and harmonic content, shaped like an AudioBuffer so
 * the analysis engine can consume it directly.
 */
export function makeTestTrack({
  bpm,
  duration = 30,
  rootFreq,
  notes = [1, 1.2, 1.5],
  kickAmp = 0.9,
  sr = 22050,
}) {
  const beat = 60 / bpm;
  const length = Math.floor(sr * duration);
  const mono = new Float32Array(length);

  const add = (t, freq, amp, len, decay) => {
    const s = Math.floor(t * sr);
    const l = Math.floor(len * sr);
    for (let i = 0; i < l && s + i < length; i++) {
      mono[s + i] += amp * Math.sin((2 * Math.PI * freq * i) / sr) * Math.pow(1 - i / l, decay);
    }
  };

  for (let k = 0; k < duration / beat; k++) {
    add(k * beat, 62, kickAmp, 0.1, 3);
    add(k * beat + beat * 0.5, 250, 0.15, 0.04, 2);
  }
  for (let i = 0; i < length; i++) {
    const t = i / sr;
    mono[i] += 0.2 * Math.sin(2 * Math.PI * rootFreq * t);
    for (const mul of notes) mono[i] += 0.1 * Math.sin(2 * Math.PI * rootFreq * 2 * mul * t);
  }

  return {
    numberOfChannels: 1,
    sampleRate: sr,
    length,
    duration: length / sr,
    getChannelData: () => mono,
  };
}
