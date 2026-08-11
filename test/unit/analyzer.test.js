import { describe, it, expect } from 'vitest';
import { analyzeAudioBuffer } from '../../src/renderer/js/analyzer.js';
import { makeTestTrack } from '../helpers/synth.js';

describe('Beat Intelligence AI', () => {
  it('detects a 128 BPM four-on-the-floor track', async () => {
    const track = makeTestTrack({ bpm: 128, rootFreq: 110, notes: [1, 1.2, 1.5] });
    const analysis = await analyzeAudioBuffer(track, () => {});
    expect(Math.abs(analysis.bpm - 128)).toBeLessThan(0.6);
    expect(analysis.beatLength).toBeCloseTo(60 / 128, 2);
  });

  it('detects a 140 BPM track', async () => {
    const track = makeTestTrack({ bpm: 140, rootFreq: 261.63, notes: [1, 1.3348, 1.5] });
    const analysis = await analyzeAudioBuffer(track, () => {});
    expect(Math.abs(analysis.bpm - 140)).toBeLessThan(0.6);
  });

  it('detects a slower 95 BPM track', async () => {
    const track = makeTestTrack({ bpm: 95, rootFreq: 164.81, notes: [1, 1.2, 1.5] });
    const analysis = await analyzeAudioBuffer(track, () => {});
    expect(Math.abs(analysis.bpm - 95)).toBeLessThan(0.6);
  });

  it('builds a beat grid that covers the track duration', async () => {
    const track = makeTestTrack({ bpm: 128, rootFreq: 110, notes: [1] });
    const analysis = await analyzeAudioBuffer(track, () => {});
    const beatLen = 60 / analysis.bpm;
    const expectedBeats = Math.floor((track.duration - analysis.phase) / beatLen);
    expect(Math.abs(analysis.beatTimes.length - expectedBeats)).toBeLessThanOrEqual(2);
    expect(analysis.beatTimes[0]).toBeGreaterThanOrEqual(0);
  });
});

describe('Harmonic Intelligence AI', () => {
  it('detects A minor (Camelot 8A) from an A-rooted track', async () => {
    const track = makeTestTrack({ bpm: 128, rootFreq: 110, notes: [1, 1.2, 1.5] });
    const analysis = await analyzeAudioBuffer(track, () => {});
    expect(analysis.key.name).toBe('A min');
    expect(analysis.key.camelot).toBe('8A');
  });

  it('detects C major (Camelot 8B) from a C-rooted track', async () => {
    const track = makeTestTrack({ bpm: 140, rootFreq: 261.63, notes: [1, 1.3348, 1.5] });
    const analysis = await analyzeAudioBuffer(track, () => {});
    expect(analysis.key.name).toBe('C maj');
    expect(analysis.key.camelot).toBe('8B');
  });

  it('detects E minor from an E-rooted track', async () => {
    const track = makeTestTrack({ bpm: 95, rootFreq: 164.81, notes: [1, 1.2, 1.5] });
    const analysis = await analyzeAudioBuffer(track, () => {});
    expect(analysis.key.name).toBe('E min');
  });
});

describe('Music DNA mapping', () => {
  it('produces a stable signature with energy and emotional profile', async () => {
    const track = makeTestTrack({ bpm: 128, rootFreq: 110, notes: [1, 1.2, 1.5] });
    const analysis = await analyzeAudioBuffer(track, () => {});
    const dna = analysis.dna;
    expect(dna.signature).toBe(`${analysis.bpm.toFixed(1)}|${analysis.key.camelot}`);
    expect(dna.beats).toBeGreaterThan(0);
    expect(dna.energyTrend).toHaveLength(8);
    expect(typeof dna.genreGuess).toBe('string');
    expect(typeof dna.emotionalProfile).toBe('string');
    expect(dna.predictedDrops).toBeInstanceOf(Array);
  });

  it('produces an energy profile over the whole track', async () => {
    const track = makeTestTrack({ bpm: 128, rootFreq: 110, notes: [1] });
    const analysis = await analyzeAudioBuffer(track, () => {});
    expect(analysis.energy.frames.length).toBeGreaterThan(0);
    expect(analysis.energy.mean).toBeGreaterThan(0);
  });
});
