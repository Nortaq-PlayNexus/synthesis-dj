/* SYNTHESIS - AI Decision Intelligence
 * Harmonic compatibility (Camelot), Crowd Intelligence / Emotion Flow Engine,
 * Predictive Mixing AI, Transition Director decisions, and optional
 * offline-first LLM advisor via any OpenAI-compatible endpoint.
 */

export const CAMELOT_ADJACENCY = {
  8: 9,
  9: 10,
  10: 11,
  11: 12,
  12: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 7,
  7: 8,
};

function camelotInfo(code) {
  const m = /^(\d{1,2})([AB])$/.exec(code || '');
  if (!m) return null;
  return { num: parseInt(m[1], 10), letter: m[2] };
}

export function harmonicCompatibility(keyA, keyB) {
  const a = camelotInfo(keyA);
  const b = camelotInfo(keyB);
  if (!a || !b) return { score: 0.3, label: 'Unknown' };
  if (a.letter === b.letter && a.num === b.num) return { score: 1.0, label: 'Perfect match' };
  if (a.letter === b.letter && CAMELOT_ADJACENCY[a.num] === b.num)
    return { score: 0.92, label: 'Harmonic energy' };
  if (a.letter === b.letter && CAMELOT_ADJACENCY[b.num] === a.num)
    return { score: 0.92, label: 'Harmonic energy' };
  if (a.num === b.num && a.letter !== b.letter) return { score: 0.85, label: 'Relative key' };
  if (
    a.letter === b.letter &&
    Math.abs(CAMELOT_ADJACENCY[a.num] === b.num ? 1 : a.num - b.num) <= 1
  )
    return { score: 0.75, label: 'Close key' };
  return { score: 0.35, label: 'Dissonant' };
}

function bpmRatioScore(bpmA, bpmB) {
  if (!bpmA || !bpmB) return 0.4;
  const ratio = bpmA / bpmB;
  const closeness = Math.max(0, 1 - Math.abs(1 - ratio) * 8);
  return Math.min(1, closeness);
}

export function transitionCompatibility(dnaA, dnaB) {
  const harm = harmonicCompatibility(dnaA.camelot, dnaB.camelot);
  const bpm = bpmRatioScore(dnaA.bpm, dnaB.bpm);
  const energyDelta = Math.abs(
    (dnaB.energyTrend[0] || 0.5) - (dnaA.energyTrend[dnaA.energyTrend.length - 1] || 0.5),
  );
  const energy = Math.max(0, 1 - energyDelta * 2.2);
  const score = harm.score * 0.5 + bpm * 0.3 + energy * 0.2;
  return {
    score: Math.round(score * 100) / 100,
    harmonic: harm,
    bpmMatch: Math.round(bpm * 100) / 100,
    energyFlow: Math.round(energy * 100) / 100,
    reasons: [
      harm.label,
      bpm > 0.7
        ? `BPM compatible (${dnaA.bpm.toFixed(1)} vs ${dnaB.bpm.toFixed(1)})`
        : 'BPM stretch required',
      energy > 0.7 ? 'Clean energy flow' : 'Energy shift to manage',
    ],
  };
}

export class AIAdvisor {
  constructor() {
    this.settings = {
      mixingLevel: 0.7,
      creativity: 0.6,
      transitionStyle: 'cinematic',
      crowdMode: 'balanced',
      llm: { enabled: false, baseUrl: '', apiKey: '', model: '' },
    };
    this.setHistory = [];
  }

  recommendNext(currentDna, library, opts = {}) {
    const ranked = [];
    for (const track of library) {
      if (!track.dna || track.dna === currentDna) continue;
      const c = transitionCompatibility(currentDna, track.dna);
      let creativityBoost = opts.creativity != null ? (opts.creativity - 0.5) * 0.2 : 0;
      const score = Math.min(1, c.score + creativityBoost);
      ranked.push({ track, ...c, score });
    }
    ranked.sort((x, y) => y.score - x.score);
    return ranked.slice(0, 8);
  }

  transitionPlan(deckA, deckB, library) {
    const a = deckA.analysis;
    if (!a) return null;
    const now = deckA.position;
    const beatLen = 60 / a.bpm;
    const phrase = 4 * beatLen * 4;
    const toPhraseEnd = phrase - ((now - a.phase) % phrase || phrase);
    const drop = a.energy.peaks.find((p) => p.time > now + 15) || null;

    const next = this.recommendNext(a.dna, library)[0];
    const energyNow = this._energyAt(a, now);
    const energySoon = this._energyAt(a, now + Math.min(30, a.duration - now - 1));

    let type = 'phrase mix';
    let point = now + toPhraseEnd;
    let confidence = 0.72;

    if (drop) {
      type = 'drop alignment';
      point = drop.time - beatLen * 8;
      confidence = 0.88;
    } else if (energyNow > energySoon && toPhraseEnd < 30) {
      type = 'energy breakdown';
      confidence = 0.8;
    }

    return {
      type,
      pointSeconds: point,
      bars: Math.round((point - now) / (4 * beatLen)),
      confidence,
      nextTrack: next ? next.track.name : 'LIBRARY EMPTY',
      nextScore: next ? next.score : 0,
      actions: this._directorActions(type, energyNow, energySoon),
    };
  }

  _directorActions(type, eNow, eSoon) {
    const actions = [];
    if (eNow > eSoon + 0.1) actions.push('Remove bass on incoming deck');
    if (type === 'drop alignment') actions.push('Bring vocals in at the impact');
    if (type === 'energy breakdown') actions.push('Extend breakdown, then reintroduce drums');
    actions.push('Crossfade 24 beats before phrase end');
    return actions;
  }

  _energyAt(analysis, t) {
    const e = analysis.energy;
    if (!e.frames.length) return 0.5;
    const idx = Math.floor(t * e.frameSr);
    if (idx < 0) return e.frames[0];
    if (idx >= e.frames.length) return e.frames[e.frames.length - 1];
    return e.frames[idx];
  }

  crowdAnalysis(setDnas) {
    if (!setDnas.length) return null;
    const profile = setDnas.map((d, i) => ({
      index: i,
      bpm: d.bpm,
      energy: d.energyTrend[d.energyTrend.length - 1] || 0.5,
      peak: d.predictedDrops && d.predictedDrops[0] ? d.predictedDrops[0].strength : 0.5,
    }));
    const avgBpm = profile.reduce((s, p) => s + p.bpm, 0) / profile.length;
    const peakIndex = profile.reduce((best, p, i) => (p.peak > profile[best].peak ? i : best), 0);
    const totalEnergy = profile.reduce((s, p) => s + p.energy, 0);
    const phase = (i) => {
      if (i === 0) return 'opening';
      if (i < profile.length * 0.35) return 'building';
      if (i < profile.length * 0.75) return 'climax zone';
      return 'resolution';
    };
    return {
      avgBpm: Math.round(avgBpm),
      peakIndex,
      peakTrack: setDnas[peakIndex].name || `TRACK ${peakIndex + 1}`,
      crowdIntensity: Math.min(1, totalEnergy / (profile.length * 0.75)),
      narrative: `Set opens at ${phase(0).toUpperCase()}, climbs through ${phase(1).toUpperCase()} and peaks at track ${peakIndex + 1} (${setDnas[peakIndex].name || peakIndex + 1}). ${profile[peakIndex].energy > 0.7 ? 'Crowd is projected to reach peak engagement here.' : 'Manage energy carefully before the climax.'}`,
      storyline: profile.map((p, i) => ({ ...p, phase: phase(i) })),
    };
  }

  buildSet(startDna, library, length = 8) {
    const set = [startDna];
    const remaining = library.filter((t) => t.dna && t.dna !== startDna);
    let current = startDna;
    while (set.length < Math.min(length, remaining.length + 1)) {
      const ranked = this.recommendNext(current, remaining).filter((r) => r.score >= 0.3);
      const chosen = ranked[0];
      if (!chosen) break;
      set.push(chosen.track.dna);
      current = chosen.track.dna;
      const idx = remaining.findIndex((t) => t === chosen.track);
      if (idx >= 0) remaining.splice(idx, 1);
    }
    return set;
  }

  async narrateWithLLM(context, onStatus) {
    const cfg = this.settings.llm;
    if (!cfg.enabled || !cfg.baseUrl || !cfg.apiKey || !cfg.model) {
      return null;
    }
    try {
      if (onStatus) onStatus('Querying neural advisor...');
      const url = cfg.baseUrl.replace(/\/+$/, '');
      const res = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            {
              role: 'system',
              content:
                'You are the SYNTHESIS AI DJ Command System advisor. Give elite-DJ recommendations: transition points, harmonic mixing suggestions, crowd-energy tactics, and set storytelling. Be concise, tactical, and confident.',
            },
            { role: 'user', content: JSON.stringify(context) },
          ],
          temperature: 0.7,
          max_tokens: 400,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (onStatus) onStatus('Neural advisor online');
      return text;
    } catch {
      if (onStatus) onStatus('Neural advisor unavailable - using tactical engine');
      return null;
    }
  }
}
