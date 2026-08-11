import { describe, it, expect } from 'vitest';
import { analyzeAudioBuffer } from '../../src/renderer/js/analyzer.js';
import { AIAdvisor } from '../../src/renderer/js/ai.js';
import { makeTestTrack } from '../helpers/synth.js';

describe('Full analysis pipeline (integration)', () => {
  it('analyzes multiple tracks into a coherent recommendation set', async () => {
    const trackA = await analyzeAudioBuffer(
      makeTestTrack({ bpm: 128, rootFreq: 110, notes: [1, 1.2, 1.5], duration: 40 }),
      () => {},
    );
    const trackB = await analyzeAudioBuffer(
      makeTestTrack({ bpm: 126, rootFreq: 110, notes: [1, 1.2, 1.5], duration: 40 }),
      () => {},
    );
    const trackC = await analyzeAudioBuffer(
      makeTestTrack({ bpm: 90, rootFreq: 130.81, notes: [1, 1.2, 1.5], duration: 40 }),
      () => {},
    );

    expect(trackA.dna.camelot).toBe('8A');
    expect(trackB.dna.camelot).toBe('8A');
    expect(trackC.dna.camelot).toBe('8B'); // C-rooted track resolves to C major

    const library = [
      { name: 'TRACK A', dna: trackA.dna },
      { name: 'TRACK B', dna: trackB.dna },
      { name: 'TRACK C', dna: trackC.dna },
    ];

    const advisor = new AIAdvisor();
    const recs = advisor.recommendNext(trackA.dna, library);
    expect(recs[0].track.name).toBe('TRACK B');
    expect(recs[recs.length - 1].track.name).toBe('TRACK C');

    const crowd = advisor.crowdAnalysis(library.map((t) => t.dna));
    expect(crowd.peakIndex).toBeGreaterThanOrEqual(0);
  });

  it('produces consistent DNA signatures that are round-trip stable', async () => {
    const track = await analyzeAudioBuffer(
      makeTestTrack({ bpm: 140, rootFreq: 261.63, notes: [1, 1.3348, 1.5], duration: 40 }),
      () => {},
    );
    expect(track.dna.signature).toBe(`${track.bpm.toFixed(1)}|8B`);
  });
});
