import { describe, it, expect } from 'vitest';
import {
  AIAdvisor,
  transitionCompatibility,
  harmonicCompatibility,
} from '../../src/renderer/js/ai.js';

const MAJOR_A = {
  bpm: 128,
  camelot: '8A',
  energyTrend: [0.4, 0.5, 0.6],
  predictedDrops: [{ strength: 0.7 }],
};

function track(name, dna) {
  return {
    name,
    dna: { energyTrend: [0.5, 0.5, 0.5], predictedDrops: [{ strength: 0.5 }], ...dna },
  };
}

describe('Harmonic compatibility (Camelot wheel)', () => {
  it('scores the same key as a perfect match', () => {
    expect(harmonicCompatibility('8A', '8A').score).toBe(1.0);
  });

  it('scores adjacent keys on the wheel as harmonic energy', () => {
    expect(harmonicCompatibility('8A', '9A').score).toBe(0.92);
  });

  it('scores the relative major/minor pair well', () => {
    expect(harmonicCompatibility('8A', '8B').score).toBe(0.85);
  });

  it('scores distant keys as dissonant', () => {
    expect(harmonicCompatibility('8A', '3B').score).toBeLessThan(0.5);
  });
});

describe('Transition compatibility scoring', () => {
  it('rewards matched BPM and clean energy flow', () => {
    const a = { ...MAJOR_A, energyTrend: [0.4, 0.5, 0.6] };
    const b = { bpm: 126, camelot: '9A', energyTrend: [0.5, 0.6, 0.7] };
    const c = transitionCompatibility(a, b);
    expect(c.score).toBeGreaterThan(0.7);
    expect(c.reasons.length).toBeGreaterThan(0);
  });

  it('penalizes a distant key with a large BPM gap', () => {
    const a = { ...MAJOR_A, energyTrend: [0.4, 0.5, 0.6] };
    const b = { bpm: 90, camelot: '3B', energyTrend: [0.3, 0.3, 0.3] };
    expect(transitionCompatibility(a, b).score).toBeLessThan(0.6);
  });
});

describe('AIAdvisor recommendation engine', () => {
  const advisor = new AIAdvisor();
  const library = [
    track('PERFECT', { bpm: 128, camelot: '8A' }),
    track('GOOD', { bpm: 126, camelot: '9A' }),
    track('BAD', { bpm: 90, camelot: '3B', energyTrend: [0.2, 0.2, 0.2] }),
  ];

  it('ranks the most compatible track first', () => {
    const recs = advisor.recommendNext(MAJOR_A, library);
    expect(recs[0].track.name).toBe('PERFECT');
    expect(recs[2].track.name).toBe('BAD');
  });

  it('never recommends the current track', () => {
    const current = track('CURRENT', { bpm: 128, camelot: '8A' });
    const recs = advisor.recommendNext(current.dna, [current, library[0]]);
    expect(recs.every((r) => r.track.name !== 'CURRENT')).toBe(true);
  });

  it('produces a transition plan with a decision point and actions', () => {
    const plan = advisor.transitionPlan(
      {
        position: 40,
        analysis: {
          bpm: 128,
          phase: 0,
          duration: 120,
          energy: { peaks: [], frames: [0.4, 0.5, 0.6, 0.5, 0.4], frameSr: 0.1 },
          dna: { ...MAJOR_A },
        },
      },
      { buffer: {} },
      library,
    );
    expect(plan).not.toBeNull();
    expect(plan.type).toBeDefined();
    expect(plan.pointSeconds).toBeGreaterThan(0);
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.nextTrack).toBe('PERFECT');
  });

  it('builds a full set with a storyline', () => {
    const set = advisor.buildSet(MAJOR_A, library, 3);
    expect(set.length).toBeGreaterThanOrEqual(2);
    const crowd = advisor.crowdAnalysis(set);
    expect(crowd.avgBpm).toBeGreaterThan(0);
    expect(crowd.narrative.length).toBeGreaterThan(20);
  });
});
