/* SYNTHESIS AI DJ COMMAND SYSTEM - Application Core
 * Orchestrates the audio engine, music intelligence, AI advisor,
 * autonomous mixing director and the holographic command UI.
 */

import { analyzeAudioBuffer } from './analyzer.js';
import { AudioEngine } from './engine.js';
import { AIAdvisor } from './ai.js';
import { Playlist } from './playlist.js';

const $ = (id) => document.getElementById(id);

const engine = new AudioEngine();
const advisor = new AIAdvisor();
const playlist = new Playlist();
const deckA = engine.createDeck('A');
const deckB = engine.createDeck('B');

const library = [];
let activeDeck = deckA;
let cfPos = 0.5;
let autoMix = false;
let mode = 'HYBRID';
let masterSweep = null;
let lastFeedFlash = 0;
let analyzeQueue = [];

const $A = {
  play: $('play-A'),
  cue: $('cue-A'),
  sync: $('sync-A'),
  loop: $('loop-A'),
  loopclear: $('loopclear-A'),
  riser: $('fx-riser-A'),
  wave: $('wave-A'),
  jog: $('jog-A'),
  jogCenter: $('jog-center-A'),
  pitchSlider: $('pitch-slider-A'),
  pitchVal: $('pitch-A'),
  eqLow: $('eq-low-A'),
  eqMid: $('eq-mid-A'),
  eqHigh: $('eq-high-A'),
  fxAmt: $('fx-amt-A'),
  vol: $('vol-A'),
  fxType: $('fx-type-A'),
  bpm: $('bpm-A'),
  key: $('key-A'),
  beat: $('beat-A'),
  time: $('time-A'),
  track: $('track-name-A'),
  meta: $('deck-meta-A'),
};
const $B = {
  play: $('play-B'),
  cue: $('cue-B'),
  sync: $('sync-B'),
  loop: $('loop-B'),
  loopclear: $('loopclear-B'),
  riser: $('fx-riser-B'),
  wave: $('wave-B'),
  jog: $('jog-B'),
  jogCenter: $('jog-center-B'),
  pitchSlider: $('pitch-slider-B'),
  pitchVal: $('pitch-B'),
  eqLow: $('eq-low-B'),
  eqMid: $('eq-mid-B'),
  eqHigh: $('eq-high-B'),
  fxAmt: $('fx-amt-B'),
  vol: $('vol-B'),
  fxType: $('fx-type-B'),
  bpm: $('bpm-B'),
  key: $('key-B'),
  beat: $('beat-B'),
  time: $('time-B'),
  track: $('track-name-B'),
  meta: $('deck-meta-B'),
};

/* ============================================================ UTILITIES */

function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function log(msg, type = 'info') {
  const feed = $('ai-feed');
  const t = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.className = 'feed-entry' + (type === 'decision' ? ' decision' : '');
  div.innerHTML = `<div class="fe-time">${t}</div><div class="fe-msg">${msg}</div>`;
  feed.appendChild(div);
  while (feed.children.length > 60) feed.removeChild(feed.firstChild);
  feed.scrollTop = feed.scrollHeight;
}

function setProgress(pct, label) {
  $('progress-fill').style.width = `${Math.round(pct * 100)}%`;
  $('progress-label').textContent = label || `${Math.round(pct * 100)}%`;
}

function setNeural(state, cls = '') {
  const el = $('neural-status');
  el.textContent = state;
  el.className = 'value' + (cls ? ` ${cls}` : '');
}

/* ============================================================ WAVEFORM DATA */

function computePeaks(buffer, num) {
  num = Math.min(num, 4096);
  const ch = buffer.getChannelData(0);
  const n = buffer.length;
  const min = new Float32Array(num);
  const max = new Float32Array(num);
  min.fill(0);
  max.fill(0);
  const bin = Math.max(1, Math.floor(n / num));
  for (let i = 0; i < n; i += bin) {
    const idx = Math.min(num - 1, Math.floor(i / bin));
    const v = ch[i];
    if (v < min[idx]) min[idx] = v;
    if (v > max[idx]) max[idx] = v;
  }
  return { min, max, n: num, duration: buffer.duration };
}

function drawTrack(ctx, peaks, t0, t1, y0, y1, color, alpha) {
  if (!peaks.n) return;
  const w = ctx.canvas.width;
  const dur = peaks.duration;
  const span = Math.max(1e-4, t1 - t0);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += 2) {
    const t = t0 + (x / w) * span;
    const f = Math.min(0.9999, Math.max(0, t / dur));
    const idx = Math.floor(f * peaks.n);
    const m = Math.abs(peaks.min[idx]);
    const M = Math.abs(peaks.max[idx]);
    const v = Math.max(m, M);
    const h = v * ((y1 - y0) / 2) * 0.9;
    ctx.moveTo(x, (y0 + y1) / 2 - h);
    ctx.lineTo(x, (y0 + y1) / 2 + h);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPlayhead(ctx, t, t0, t1, y0, y1, color) {
  const w = ctx.canvas.width;
  if (t < t0 || t > t1) return;
  const x = ((t - t0) / (t1 - t0)) * w;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/* ============================================================ CANVAS SETUP */

const canvases = {};
function setupCanvas(id, logicalHeight) {
  const c = $(id);
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth;
  const h = logicalHeight || c.clientHeight;
  c.width = Math.max(1, w * dpr);
  c.height = Math.max(1, h * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  canvases[id] = { canvas: c, ctx, w: Math.max(1, w), h: Math.max(1, h) };
  return canvases[id];
}

function resizeAll() {
  setupCanvas('wave-canvas');
  setupCanvas('energy-canvas', 90);
  setupCanvas('wave-A', 60);
  setupCanvas('wave-B', 60);
  setupCanvas('jog-A', 150);
  setupCanvas('jog-B', 150);
}

/* ============================================================ LOADING & ANALYSIS */

async function loadTracks() {
  const files = await window.synthesis.openAudio(true);
  if (!files || !files.length) return;
  engine.ensure();
  const ctx = engine.ctx;
  setNeural('ANALYZING', 'busy');
  $('analysis-status').textContent = 'BUSY';
  $('analysis-status').className = 'value busy';

  for (const f of files) {
    try {
      const buf = f.data.buffer;
      setProgress(0.02, `DECODING ${f.name.toUpperCase()}`);
      const audioBuffer = await ctx.decodeAudioData(buf.slice(0));
      setProgress(0.05, `DECODING ${f.name.toUpperCase()}`);
      const analysis = await analyzeAudioBuffer(audioBuffer, (p, label) => {
        setProgress(0.05 + p * 0.9, label);
      });
      const track = {
        name: f.name.replace(/\.[^.]+$/, ''),
        path: f.path,
        buffer: audioBuffer,
        analysis,
        peaks: computePeaks(audioBuffer, 2400),
      };
      track.analysis.dna.name = track.name;
      library.push(track);
      analyzeQueue.push(track);
      playlist.add(track);
      log(
        `MUSIC DNA MAPPED :: ${track.name.toUpperCase()} @ ${track.analysis.bpm.toFixed(1)}BPM ${track.analysis.key.name.toUpperCase()}`,
        'decision',
      );
    } catch (e) {
      console.error('decode/analysis failed', e);
      log(`REJECTED :: ${f.name} (unsupported or corrupt)`);
    }
  }

  setNeural('ONLINE', 'ok');
  $('analysis-status').textContent = 'IDLE';
  $('analysis-status').className = 'value';
  setProgress(1, 'READY');

  if (!deckA.buffer && library[0]) assignTrack(deckA, library[0]);
  if (!deckB.buffer && library[1]) assignTrack(deckB, library[1]);
  reorderToSavedQueue();
  if (playlist.length && playlist.currentIndex < 0) playlist.markCurrent(0);

  renderRecommendations();
  renderPlaylist();
  if (!activeDeck.buffer && library[0]) activeDeck = deckA;
  updateInfoPanels();
  log(`${library.length} TRACKS IN ARSENAL. RECOMMENDING...`);
  log(advisor.crowdAnalysis(library.map((t) => t.dna))?.narrative || '', 'decision');
}

function reorderToSavedQueue() {
  const saved = playlist.hydrate();
  if (!saved || !Array.isArray(saved.tracks) || !saved.tracks.length) return;
  const loaded = new Map(library.map((t) => [t.path, t]));
  playlist.clear();
  const staged = [];
  for (const meta of saved.tracks) {
    const track = loaded.get(meta.path);
    if (track) {
      staged.push(track);
      loaded.delete(meta.path);
    }
  }
  for (const track of loaded.values()) staged.push(track);
  playlist.addMany(staged);
  playlist.autoAdvance = saved.autoAdvance !== false;
}

function assignTrack(deck, track) {
  deck.loadBuffer(track.buffer, track.analysis).then(() => {
    deck.setVolume(0.85);
    deck.seekTo(0);
    deck.setEq('low', 0);
    deck.setEq('mid', 0);
    deck.setEq('high', 0);
    refreshDeckUI(deck);
    renderRecommendations();
    updateInfoPanels();
  });
}

/* ============================================================ RECOMMENDATIONS */

function renderRecommendations() {
  const list = $('rec-list');
  const current = activeDeck.analysis;
  list.innerHTML = '';
  if (!current) {
    list.innerHTML = '<div class="empty-hint">Load tracks to begin neural analysis</div>';
    return;
  }
  const recs = advisor.recommendNext(current.dna, library);
  if (!recs.length) {
    list.innerHTML = '<div class="empty-hint">Load more tracks for transitions</div>';
    return;
  }
  for (const r of recs) {
    const div = document.createElement('div');
    div.className = 'rec-item';
    const drop = r.track.analysis.energy.peaks[0];
    div.innerHTML = `
      <div class="ri-name">${r.track.name}</div>
      <div class="ri-meta">
        <span>${r.track.analysis.bpm.toFixed(1)} BPM · ${r.track.analysis.key.name.toUpperCase()} · ${r.track.analysis.key.camelot}</span>
        <span class="ri-score">${(r.score * 100).toFixed(0)}% ${drop ? '▲' + (drop.strength * 100).toFixed(0) : ''}</span>
      </div>`;
    div.title = r.reasons.join(' · ');
    div.addEventListener('click', () => {
      const target =
        deckB.buffer === null || deckB.buffer === deckA.buffer
          ? deckB
          : activeDeck === deckA
            ? deckB
            : deckA;
      assignTrack(target, r.track);
      log(
        `AI DIRECTED :: ${r.track.name.toUpperCase()} → DECK ${target.name} (${(r.score * 100).toFixed(0)}% compatible)`,
      );
      if (target === deckB) {
        log(`TRANSITION PROTOCOL :: ${r.harmonic.label} · ${r.reasons[1]}`, 'decision');
      }
    });
    list.appendChild(div);
  }
}

/* ============================================================ PLAYLIST QUEUE */

function renderPlaylist() {
  const list = $('pl-list');
  $('pl-meta').textContent = `${playlist.length} TRACK${playlist.length === 1 ? '' : 'S'} STAGED`;
  $('toggle-advance').checked = playlist.autoAdvance;
  list.innerHTML = '';
  if (!playlist.length) {
    list.innerHTML = '<div class="empty-hint">Load tracks to build the playlist queue</div>';
    return;
  }
  playlist.queue.forEach((track, i) => {
    const active = i === playlist.currentIndex;
    const div = document.createElement('div');
    div.className = 'pl-item' + (active ? ' active' : '');
    div.innerHTML = `
      <div class="pl-idx">${String(i + 1).padStart(2, '0')}</div>
      <div class="pl-main">
        <div class="pl-name">${track.name.toUpperCase()}</div>
        <div class="pl-sub">${track.analysis.bpm.toFixed(1)} BPM · ${track.analysis.key.camelot} · ${track.analysis.key.name.toUpperCase()}</div>
      </div>
      <div class="pl-actions">
        <button class="pl-btn play" title="LOAD & PLAY">▶</button>
        <button class="pl-btn" title="MOVE UP" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="pl-btn" title="MOVE DOWN" ${i === playlist.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="pl-btn remove" title="REMOVE">✕</button>
      </div>`;
    div.querySelector('.pl-btn.play').addEventListener('click', () => playQueueIndex(i));
    div.querySelectorAll('.pl-btn')[1].addEventListener('click', () => {
      playlist.move(i, -1);
      renderPlaylist();
    });
    div.querySelectorAll('.pl-btn')[2].addEventListener('click', () => {
      playlist.move(i, 1);
      renderPlaylist();
    });
    div.querySelector('.pl-btn.remove').addEventListener('click', () => {
      playlist.removeAt(i);
      renderPlaylist();
      log(`PLAYLIST :: REMOVED ${track.name.toUpperCase()} FROM QUEUE`);
    });
    list.appendChild(div);
  });
}

function playQueueIndex(i) {
  const track = playlist.queue[i];
  if (!track) return;
  const target =
    deckB.buffer === null || deckB.buffer === deckA.buffer
      ? deckB
      : activeDeck === deckA
        ? deckB
        : deckA;
  playlist.markCurrent(i);
  assignTrack(target, track);
  target.play();
  (target === deckA ? $A : $B).play.textContent = 'PAUSE';
  log(`PLAYLIST :: ${track.name.toUpperCase()} LOADED ON DECK ${target.name}`, 'decision');
}

function handleTrackEnded(deck) {
  if (!playlist.autoAdvance) return;
  const next = playlist.next();
  if (!next) return;
  playlist.advance();
  assignTrack(deck, next);
  deck.play();
  (deck === deckA ? $A : $B).play.textContent = 'PAUSE';
  log(`PLAYLIST :: AUTO-ADVANCE → ${next.name.toUpperCase()} ON DECK ${deck.name}`, 'decision');
}

/* ============================================================ UI REFRESH */

function refreshDeckUI(deck) {
  const isA = deck === deckA;
  const ui = isA ? $A : $B;
  ui.track.textContent = deck.buffer ? deck.trackName.toUpperCase() : 'EMPTY SLOT';
  ui.track.title = deck.trackName;
  if (deck.analysis) {
    ui.bpm.textContent = deck.analysis.bpm.toFixed(1);
    ui.key.textContent = deck.analysis.key.name.toUpperCase();
    ui.meta.textContent = `${deck.analysis.bpm.toFixed(1)} BPM / ${deck.analysis.key.camelot}`;
  } else {
    ui.bpm.textContent = '--';
    ui.key.textContent = '--';
    ui.meta.textContent = '-- BPM / -- KEY';
  }
}

function updateInfoPanels() {
  const a = deckA.analysis;
  if (!a) {
    $('ai-track-name').textContent = 'NO TRACK LOADED';
    $('ro-bpm').textContent = '--';
    $('ro-key').textContent = '--';
    $('ro-camelot').textContent = '--';
    $('ro-energy').textContent = '--';
    $('ro-genre').textContent = '--';
    $('ro-dna').textContent = '--';
    $('emotion-profile').textContent = '--';
    return;
  }
  $('ai-track-name').textContent = deckA.trackName.toUpperCase();
  $('ro-bpm').textContent = a.bpm.toFixed(1);
  $('ro-key').textContent = a.key.name.toUpperCase();
  $('ro-camelot').textContent = a.key.camelot;
  $('ro-energy').textContent = (a.energy.mean * 100).toFixed(0) + '%';
  $('ro-genre').textContent = a.dna.genreGuess.toUpperCase();
  $('ro-dna').textContent = a.dna.signature;
  $('emotion-profile').textContent = a.dna.emotionalProfile.toUpperCase();
  drawEnergyCanvas(a);
  $('battle-meta').textContent =
    `DECK A ${a.bpm.toFixed(1)}BPM/${a.key.camelot}${deckB.analysis ? `  ·  DECK B ${deckB.analysis.bpm.toFixed(1)}BPM/${deckB.analysis.key.camelot}` : ''}`;
}

function drawEnergyCanvas(analysis) {
  const c = canvases['energy-canvas'];
  if (!c) return;
  const { ctx, w, h } = c;
  ctx.clearRect(0, 0, w, h);
  const trend = analysis.dna.energyTrend;
  const bw = w / 8;
  for (let i = 0; i < 8; i++) {
    const v = trend[i] || 0;
    const bh = v * (h - 12);
    const grad = ctx.createLinearGradient(0, h, 0, h - bh);
    grad.addColorStop(0, '#0ea5e9');
    grad.addColorStop(1, '#22d3ee');
    ctx.fillStyle = grad;
    ctx.fillRect(i * bw + 4, h - bh, bw - 8, bh);
  }
  ctx.fillStyle = 'rgba(251,191,36,0.9)';
  for (const p of analysis.energy.peaks.slice(0, 5)) {
    const x = (p.time / analysis.duration) * w;
    ctx.beginPath();
    ctx.arc(x, 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(148,163,184,0.3)';
  ctx.beginPath();
  for (let i = 1; i < 8; i++) {
    ctx.moveTo(i * bw, 0);
    ctx.lineTo(i * bw, h);
  }
  ctx.stroke();
}

/* ============================================================ BATTLEFIELD RENDERING */

const view = { offset: 0, span: 60 };

function renderBattlefield() {
  const c = canvases['wave-canvas'];
  if (!c) return;
  const { ctx, w, h } = c;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(15,23,42,0.35)';
  ctx.fillRect(0, 0, w, h);

  // time grid
  ctx.strokeStyle = 'rgba(148,163,184,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  const decksWith = [deckA, deckB].filter((d) => d.buffer);
  if (!decksWith.length) {
    ctx.fillStyle = 'rgba(148,163,184,0.25)';
    ctx.font = '12px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LOAD TRACKS TO ACTIVATE THE TEMPORAL BATTLEFIELD', w / 2, h / 2);
    return;
  }

  // adaptive view
  const primary = deckA.buffer ? deckA : deckB;
  const pd = primary.analysis.duration;
  if (view.span > pd) view.span = pd;
  view.offset = Math.max(0, Math.min(primary.position - view.span * 0.3, pd - view.span));
  const t0 = view.offset;
  const t1 = view.offset + view.span;

  const mid = h * 0.42;

  // Deck A bottom half, Deck B top half
  const drawDeck = (deck, bandY0, bandY1, color, alpha) => {
    if (!deck.buffer) return;
    drawTrack(ctx, deck.peaks, t0, t1, bandY0, bandY1, color, alpha);
    // beat grid
    const a = deck.analysis;
    const beatLen = 60 / a.bpm;
    const first = Math.max(t0, a.phase);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.15;
    for (let t = first; t < t1; t += beatLen) {
      const x = ((t - t0) / view.span) * w;
      ctx.beginPath();
      ctx.moveTo(x, bandY0);
      ctx.lineTo(x, bandY1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // phrases (16 beats)
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([4, 4]);
    const phraseLen = beatLen * 16;
    const firstPhrase =
      a.phase + Math.ceil((Math.max(t0, a.phase) - a.phase) / phraseLen) * phraseLen;
    for (let t = firstPhrase; t < t1; t += phraseLen) {
      const x = ((t - t0) / view.span) * w;
      ctx.beginPath();
      ctx.moveTo(x, bandY0);
      ctx.lineTo(x, bandY1);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // predicted drops
    ctx.fillStyle = 'rgba(251,191,36,0.9)';
    ctx.strokeStyle = 'rgba(251,191,36,0.5)';
    ctx.setLineDash([2, 2]);
    for (const p of a.energy.peaks) {
      if (p.time < t0 || p.time > t1) continue;
      const x = ((p.time - t0) / view.span) * w;
      ctx.beginPath();
      ctx.moveTo(x, bandY0);
      ctx.lineTo(x, bandY1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 5, bandY0 + 10);
      ctx.lineTo(x + 5, bandY0 + 10);
      ctx.lineTo(x, bandY0 + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.setLineDash([]);
    drawPlayhead(ctx, deck.position, t0, t1, bandY0, bandY1, color);
  };

  drawDeck(deckA, mid + 2, h - 10, '#22d3ee', 0.9);
  drawDeck(deckB, 8, mid - 2, '#e879f9', 0.9);

  // separator
  ctx.strokeStyle = 'rgba(96,165,250,0.25)';
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.stroke();

  // AI decision point
  if (deckA.analysis && deckB.buffer) {
    const plan = advisor.transitionPlan(deckA, deckB, library);
    if (plan && plan.pointSeconds > t0 && plan.pointSeconds < t1) {
      const x = ((plan.pointSeconds - t0) / view.span) * w;
      ctx.strokeStyle = 'rgba(248,113,113,0.7)';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f87171';
      ctx.font = '9px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${plan.type.toUpperCase()} ${(plan.confidence * 100).toFixed(0)}%`, x, h - 4);
    }
  }

  // time labels
  ctx.fillStyle = 'rgba(148,163,184,0.5)';
  ctx.font = '9px Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(fmtTime(t0), 4, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText(fmtTime(t1), w - 4, h - 4);
}

function renderDeckWave(deck, ui) {
  const c = canvases[ui === $A ? 'wave-A' : 'wave-B'];
  if (!c) return;
  const { ctx, w, h } = c;
  ctx.clearRect(0, 0, w, h);
  if (!deck.buffer) return;
  drawTrack(
    ctx,
    deck.peaks,
    0,
    deck.analysis.duration,
    2,
    h - 2,
    deck === deckA ? '#22d3ee' : '#e879f9',
    0.75,
  );
  // beat grid light
  const a = deck.analysis;
  const beatLen = 60 / a.bpm;
  ctx.strokeStyle = 'rgba(52,211,153,0.3)';
  for (let t = a.phase; t < a.duration; t += beatLen * 4) {
    const x = (t / a.duration) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  if (deck.loopEnabled && deck.loopEnd > deck.loopStart) {
    const x0 = (deck.loopStart / a.duration) * w;
    const x1 = (deck.loopEnd / a.duration) * w;
    ctx.fillStyle = 'rgba(232,121,249,0.12)';
    ctx.fillRect(x0, 0, x1 - x0, h);
    ctx.strokeStyle = '#e879f9';
    ctx.strokeRect(x0, 0, x1 - x0, h);
  }
  const x = (deck.position / a.duration) * w;
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#f1f5f9';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
}

function renderJog(deck, ui) {
  const c = canvases[ui === $A ? 'jog-A' : 'jog-B'];
  if (!c) return;
  const { ctx, w, h } = c;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2,
    cy = h / 2,
    r = Math.min(w, h) / 2 - 4;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  grad.addColorStop(0, '#0b1322');
  grad.addColorStop(0.8, '#070c16');
  grad.addColorStop(1, '#0f1b2e');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = deck.isPlaying ? '#22d3ee' : 'rgba(96,165,250,0.35)';
  ctx.lineWidth = 2;
  ctx.shadowColor = deck.isPlaying ? '#22d3ee' : 'transparent';
  ctx.shadowBlur = deck.isPlaying ? 14 : 0;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // ticks
  const angle = deck.isPlaying
    ? (deck.position % 1) * Math.PI * 2 * (deck.analysis ? deck.analysis.bpm / 60 : 0)
    : 0;
  for (let i = 0; i < 40; i++) {
    const a0 = (i / 40) * Math.PI * 2;
    const a1 = a0 + (i % 4 === 0 ? 0.05 : 0.03);
    const r0 = i % 4 === 0 ? r - 9 : r - 6;
    ctx.strokeStyle = i % 4 === 0 ? '#22d3ee' : 'rgba(148,163,184,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r0, a0, a1);
    ctx.stroke();
  }
  // rotating marker
  ctx.strokeStyle = 'rgba(232,121,249,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 3, angle, angle + 0.35);
  ctx.stroke();
}

function renderMeters() {
  const analysers = [deckA._analyser, deckB._analyser, engine.masterAnalyser];
  const ids = ['meter-A', 'meter-B', 'master-meter'];
  analysers.forEach((an, i) => {
    const arr = new Uint8Array(an.fftSize);
    an.getByteTimeDomainData(arr);
    let peak = 0;
    for (let j = 0; j < arr.length; j++) {
      const v = Math.abs(arr[j] - 128) / 128;
      if (v > peak) peak = v;
    }
    let el = $(ids[i]);
    if (!el) return;
    const pct = Math.min(1, peak * 1.6);
    el.innerHTML = `<div style="height:${pct * 100}%"></div>`;
  });
}

/* ============================================================ AUTONOMOUS DIRECTOR */

function autonomousDirector() {
  if (!autoMix) return;
  if (mode === 'ASSIST') return;
  if (!deckA.analysis || !deckB.buffer) return;

  const plan = advisor.transitionPlan(deckA, deckB, library);
  if (!plan) return;

  if (!deckB.isPlaying && plan.pointSeconds - deckA.position < 2.5 && deckA.isPlaying) {
    deckB.play();
    deckB.syncTo(deckA);
    log(
      `AUTONOMOUS :: CUED ${deckB.trackName.toUpperCase()} @ ${plan.type.toUpperCase()} POINT`,
      'decision',
    );
    log(`DIRECTOR ACTIONS :: ${plan.actions.join(' | ')}`, 'decision');
    crossfadeTo(0.9);
    // bass swap: cut A bass, keep B bass
    deckA.setEq('low', -0.5);
  }

  if (deckB.isPlaying) {
    deckB.setEq('low', Math.max(-0.5, 0.4 - cfPos * 0.9));
  }
  if (cfPos > 0.85 && deckA.isPlaying && deckA.position > plan.pointSeconds + 32) {
    deckA.pause();
    log('AUTONOMOUS :: HANDOFF COMPLETE, DECK A PARKED');
  }
}

function crossfadeTo(target) {
  const dur = 1.5;
  const from = cfPos;
  const start = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / (dur * 1000));
    const ease = t * t * (3 - 2 * t);
    setCrossfader(from + (target - from) * ease);
    if (t < 1) requestAnimationFrame(step);
  };
  step();
}

function setCrossfader(pos) {
  cfPos = Math.max(0, Math.min(1, pos));
  const a = Math.cos((cfPos * Math.PI) / 2);
  const b = Math.sin((cfPos * Math.PI) / 2);
  deckA.setCross(a);
  deckB.setCross(b);
  $('cf-knob').style.left = `${cfPos * 100}%`;
}

/* ============================================================ WIRING */

function wireDeck(deck, ui) {
  ui.play.addEventListener('click', () => {
    deck.togglePlay();
    ui.play.textContent = deck.isPlaying ? 'PAUSE' : 'PLAY';
    log(`DECK ${deck.name} :: ${deck.isPlaying ? 'ENGAGED' : 'PAUSED'}`);
  });
  ui.cue.addEventListener('click', () => {
    if (deck.isPlaying) {
      deck.pause();
      ui.play.textContent = 'PLAY';
    }
    if (!deck.analysis) return;
    deck.seekTo(deck.cuePoint || 0);
    log(`DECK ${deck.name} :: CUE RETURN`);
  });
  ui.sync.addEventListener('click', () => {
    const ref = deck === deckA ? deckB : deckA;
    if (!ref.buffer || !deck.buffer) return;
    const r = deck.syncTo(ref);
    ui.pitchSlider.value = deck.pitch;
    ui.pitchVal.textContent = `${deck.pitch.toFixed(1)}%`;
    log(
      `TEMPORAL IMPACT MATCH :: DECK ${deck.name} SYNCED ${ref.analysis.bpm.toFixed(1)}BPM (Δ${Math.round(r.correction * 1000)}ms phase)`,
    );
    if (ref.isPlaying && !deck.isPlaying) deck.play();
  });
  ui.loop.addEventListener('click', () => {
    if (!deck.analysis || !deck.buffer) return;
    const beatLen = 60 / deck.analysis.bpm;
    const start =
      deck.analysis.phase +
      Math.floor((deck.position - deck.analysis.phase) / (beatLen * 4)) * beatLen * 4;
    deck.setLoop(true, start, start + beatLen * 4);
    log(
      `DECK ${deck.name} :: BEAT LOOP 4 ENGAGED @ bar ${Math.round((start - deck.analysis.phase) / (beatLen * 4)) + 1}`,
    );
  });
  ui.loopclear.addEventListener('click', () => {
    deck.clearLoop();
    log(`DECK ${deck.name} :: LOOP RELEASED`);
  });
  ui.riser.addEventListener('click', () => {
    if (!deck.buffer) return;
    deck.setFxType('riser');
    deck.setFxAmount(1);
    ui.fxAmt.value = 100;
    ui.fxType.value = 'riser';
    ui.fxType.classList.add('fx-active');
    setTimeout(() => {
      deck.setFxType('beatEcho');
      deck.setFxAmount(0);
      ui.fxAmt.value = 0;
      ui.fxType.value = 'beatEcho';
      ui.fxType.classList.remove('fx-active');
    }, 4200);
    log(`DECK ${deck.name} :: NEURAL RISER LAUNCHED`);
  });

  ui.pitchSlider.addEventListener('input', () => {
    deck.setPitch(parseFloat(ui.pitchSlider.value));
    ui.pitchVal.textContent = `${deck.pitch.toFixed(1)}%`;
  });
  ui.eqLow.addEventListener('input', () => deck.setEq('low', ui.eqLow.value / 100));
  ui.eqMid.addEventListener('input', () => deck.setEq('mid', ui.eqMid.value / 100));
  ui.eqHigh.addEventListener('input', () => deck.setEq('high', ui.eqHigh.value / 100));
  ui.fxAmt.addEventListener('input', () => {
    deck.setFxAmount(ui.fxAmt.value / 100);
    ui.fxType.classList.toggle(
      'fx-active',
      parseFloat(ui.fxAmt.value) > 0 && deck.fxType !== 'none',
    );
  });
  ui.vol.addEventListener('input', () => deck.setVolume(ui.vol.value / 100));
  ui.fxType.addEventListener('change', () => {
    deck.setFxType(ui.fxType.value);
    if (ui.fxType.value !== 'none' && parseFloat(ui.fxAmt.value) > 0)
      deck.setFxAmount(ui.fxAmt.value / 100);
  });

  // wave scrub
  ui.wave.addEventListener('pointerdown', (e) => {
    if (!deck.buffer) return;
    const rect = ui.wave.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    deck.seekTo(frac * deck.analysis.duration);
  });

  // jog drag scrub
  let dragging = false;
  ui.jog.addEventListener('pointerdown', (e) => {
    dragging = true;
    ui.jog.setPointerCapture(e.pointerId);
  });
  ui.jog.addEventListener('pointerup', () => {
    dragging = false;
  });
  ui.jog.addEventListener('pointermove', (e) => {
    if (!dragging || !deck.buffer) return;
    const rect = ui.jog.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    deck.seekTo(frac * deck.analysis.duration);
  });
}

function wireDeckKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      activeDeck.togglePlay();
      (activeDeck === deckA ? $A : $B).play.textContent = activeDeck.isPlaying ? 'PAUSE' : 'PLAY';
    }
  });
}

function wireGlobal() {
  $('btn-load').addEventListener('click', loadTracks);
  if (window.synthesis) window.synthesis.onMenuLoad(loadTracks);

  $('btn-pl-clear').addEventListener('click', () => {
    playlist.clear();
    renderPlaylist();
    log('PLAYLIST :: QUEUE PURGED');
  });
  $('toggle-advance').addEventListener('change', () => {
    playlist.autoAdvance = $('toggle-advance').checked;
    playlist.persist();
    log(`PLAYLIST :: AUTO-ADVANCE ${playlist.autoAdvance ? 'ENGAGED' : 'DISENGAGED'}`);
  });

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      log(`PERFORMANCE MODE :: ${mode}`);
      if (mode === 'AUTONOMOUS' && !autoMix) {
        $('toggle-automix').checked = true;
        autoMix = true;
        log('AUTONOMOUS ENGAGED - AI WILL CONDUCT THE SET');
      }
    });
  });

  $('toggle-automix').addEventListener('change', () => {
    autoMix = $('toggle-automix').checked;
    log(`AUTO MIX :: ${autoMix ? 'ENGAGED' : 'DISENGAGED'}`);
  });

  $('s-mixing').addEventListener('input', () => {
    advisor.settings.mixingLevel = $('s-mixing').value / 100;
    $('v-mixing').textContent = $('s-mixing').value;
  });
  $('s-creativity').addEventListener('input', () => {
    advisor.settings.creativity = $('s-creativity').value / 100;
    $('v-creativity').textContent = $('s-creativity').value;
  });
  $('s-style').addEventListener('change', () => {
    advisor.settings.transitionStyle = $('s-style').value;
  });
  $('s-crowd').addEventListener('change', () => {
    advisor.settings.crowdMode = $('s-crowd').value;
  });

  // crossfader
  const cfTrack = $('cf-track');
  const moveCF = (e) => {
    const rect = cfTrack.getBoundingClientRect();
    setCrossfader((e.clientX - rect.left) / rect.width);
  };
  cfTrack.addEventListener('pointerdown', (e) => {
    moveCF(e);
    cfTrack.setPointerCapture(e.pointerId);
  });
  cfTrack.addEventListener('pointermove', (e) => {
    if (e.buttons === 1) moveCF(e);
  });

  $('btn-masterfilter').addEventListener('click', () => {
    if (masterSweep) return;
    const t0 = engine.ctx.currentTime;
    engine.masterFilter.frequency.setValueAtTime(22000, t0);
    engine.masterFilter.frequency.exponentialRampToValueAtTime(500, t0 + 2);
    engine.masterFilter.frequency.exponentialRampToValueAtTime(22000, t0 + 4);
    log('MASTER FILTER :: CINEMATIC SWEEP ENGAGED');
    setTimeout(() => {
      masterSweep = null;
    }, 4200);
  });

  // LLM advisor
  $('btn-llm').addEventListener('click', async () => {
    advisor.settings.llm = {
      enabled: true,
      baseUrl: $('llm-url').value,
      apiKey: $('llm-key').value,
      model: $('llm-model').value,
    };
    localStorage.setItem('synthesis-llm', JSON.stringify(advisor.settings.llm));
    $('llm-state').textContent = 'QUERYING...';
    const context = {
      activeTrack: deckA.trackName,
      activeDna: deckA.analysis ? deckA.analysis.dna : null,
      nextCandidates: advisor
        .recommendNext(deckA.analysis?.dna, library)
        .slice(0, 3)
        .map((r) => r.track.name),
      crowd: advisor.crowdAnalysis(library.map((t) => t.dna)),
      performanceMode: mode,
    };
    const text = await advisor.narrateWithLLM(context, (s) => {
      $('llm-state').textContent = s;
      setNeural('QUERYING', 'busy');
    });
    setNeural('ONLINE', 'ok');
    if (text) {
      log(text, 'decision');
      $('llm-state').textContent = 'ONLINE';
    } else {
      $('llm-state').textContent = 'OFFLINE TACTICAL ENGINE';
      log('NEURAL ADVISOR UNREACHABLE - TACTICAL ENGINE RECOMMENDS IN LEFT PANEL');
    }
  });

  // restore llm settings
  try {
    const saved = JSON.parse(localStorage.getItem('synthesis-llm') || '{}');
    if (saved.baseUrl) $('llm-url').value = saved.baseUrl;
    if (saved.apiKey) $('llm-key').value = saved.apiKey;
    if (saved.model) $('llm-model').value = saved.model;
  } catch {}

  // waveform zoom
  const wc = $('wave-canvas');
  wc.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (!deckA.buffer) return;
      view.span = Math.max(
        8,
        Math.min(deckA.analysis.duration, view.span * (e.deltaY > 0 ? 1.15 : 0.87)),
      );
    },
    { passive: false },
  );
  wc.addEventListener('pointerdown', (e) => {
    if (!deckA.buffer) return;
    const rect = wc.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const t = view.offset + frac * view.span;
    deckA.seekTo(t);
  });
}

/* ============================================================ MAIN LOOP */

function loop() {
  engine.updatePositions();

  const a = deckA,
    b = deckB;
  if (a.isPlaying || b.isPlaying) {
    $A.play.textContent = a.isPlaying ? 'PAUSE' : 'PLAY';
    $B.play.textContent = b.isPlaying ? 'PAUSE' : 'PLAY';
  }

  if (a.analysis) {
    $A.beat.textContent = Math.max(0, a.currentBeat() + 1);
    $A.time.textContent = fmtTime(a.position);
  }
  if (b.analysis) {
    $B.beat.textContent = Math.max(0, b.currentBeat() + 1);
    $B.time.textContent = fmtTime(b.position);
  }

  renderBattlefield();
  renderDeckWave(a, $A);
  renderDeckWave(b, $B);
  renderJog(a, $A);
  renderJog(b, $B);
  renderMeters();

  // periodic AI feed of transition intel
  if (a.analysis && b.analysis && performance.now() - lastFeedFlash > 8000) {
    lastFeedFlash = performance.now();
    const plan = advisor.transitionPlan(a, b, library);
    if (plan)
      log(
        `INTEL :: ${plan.type.toUpperCase()} at ${fmtTime(plan.pointSeconds)} · next ${plan.nextTrack} (${(plan.nextScore * 100).toFixed(0)}%)`,
      );
  }

  autonomousDirector();

  requestAnimationFrame(loop);
}

/* ============================================================ CAPTURE MODE */

function synthBuffer({ bpm, duration = 40, rootFreq, notes, kickAmp = 0.9 }) {
  const ctx = engine.ctx;
  const sr = 22050;
  const beat = 60 / bpm;
  const len = Math.floor(sr * duration);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const add = (t, freq, amp, l2, decay) => {
    const s = Math.floor(t * sr);
    const l = Math.floor(l2 * sr);
    for (let i = 0; i < l && s + i < len; i++) {
      d[s + i] += amp * Math.sin((2 * Math.PI * freq * i) / sr) * Math.pow(1 - i / l, decay);
    }
  };
  for (let k = 0; k < duration / beat; k++) {
    add(k * beat, 62, kickAmp, 0.1, 3);
    add(k * beat + beat * 0.5, 250, 0.15, 0.04, 2);
  }
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    d[i] += 0.2 * Math.sin(2 * Math.PI * rootFreq * t);
    for (const mul of notes) d[i] += 0.1 * Math.sin(2 * Math.PI * rootFreq * 2 * mul * t);
  }
  return buf;
}

async function capturePrep() {
  try {
    engine.ensure();
    const bufA = synthBuffer({ bpm: 128, rootFreq: 110, notes: [1, 1.2, 1.5] });
    const bufB = synthBuffer({ bpm: 126, rootFreq: 220, notes: [1, 1.2, 1.5] });
    const anA = await analyzeAudioBuffer(bufA, () => {});
    const anB = await analyzeAudioBuffer(bufB, () => {});
    const trackA = {
      name: 'NIGHT DRIVE // SYNTH 128',
      buffer: bufA,
      analysis: anA,
      peaks: computePeaks(bufA, 2400),
    };
    const trackB = {
      name: 'NEON SKYLINE // SYNTH 126',
      buffer: bufB,
      analysis: anB,
      peaks: computePeaks(bufB, 2400),
    };
    trackA.analysis.dna.name = trackA.name;
    trackB.analysis.dna.name = trackB.name;
    library.push(trackA, trackB);
    await assignTrack(deckA, trackA);
    await assignTrack(deckB, trackB);
    renderRecommendations();
    updateInfoPanels();
    deckA.play();
    await new Promise((r) => setTimeout(r, 400));
    window.__captureReady = true;
  } catch (e) {
    console.error('capture prep failed', e);
    window.__captureReady = true;
  }
}

async function captureStage2() {
  deckB.play();
  deckB.syncTo(deckA);
  setCrossfader(0.5);
  autoMix = true;
  $('toggle-automix').checked = true;
  $('s-mixing').value = 80;
  $('s-creativity').value = 80;
  advisor.settings.mixingLevel = 0.8;
  advisor.settings.creativity = 0.8;
  setTimeout(() => {
    window.__captureStage2Done = true;
  }, 1200);
}

/* ============================================================ BOOT */

async function boot() {
  const fill = $('boot-fill');
  const status = $('boot-status');
  const phases = [
    [0.15, 'Initializing neural core...'],
    [0.3, 'Calibrating beat intelligence...'],
    [0.45, 'Loading harmonic engine...'],
    [0.6, 'Arming transition director...'],
    [0.75, 'Spinning up emotion flow engine...'],
    [0.9, 'Synchronizing temporal battlefield...'],
    [1.0, 'System online.'],
  ];
  for (const [p, s] of phases) {
    fill.style.width = `${p * 100}%`;
    status.textContent = s;
    await new Promise((r) => setTimeout(r, 240));
  }
  await new Promise((r) => setTimeout(r, 300));
  $('boot-overlay').classList.add('hidden');
  $('app').classList.remove('hidden');

  engine.ensure();
  wireGlobal();
  wireDeckKeys();
  wireDeck(deckA, $A);
  wireDeck(deckB, $B);
  playlist.onChange = renderPlaylist;
  deckA.onTrackEnded = handleTrackEnded;
  deckB.onTrackEnded = handleTrackEnded;
  renderPlaylist();
  setCrossfader(0.5);
  resizeAll();
  window.addEventListener('resize', resizeAll);

  setNeural('ONLINE', 'ok');
  $('audio-status').textContent = 'ARMED';
  $('sys-status').textContent = 'ONLINE';
  log('SYNTHESIS COMMAND SYSTEM ONLINE. LOAD TRACKS TO BEGIN.');
  log('TACTICAL MODES: ASSIST / HYBRID / AUTONOMOUS. AUTO-MIX ENGAGED FOR FULL AI CONDUCTING.');

  setInterval(() => {
    $('clock').textContent = new Date().toLocaleTimeString();
  }, 500);

  if (window.synthesis.captureMode) {
    window.__captureStage2 = captureStage2;
    capturePrep();
  }

  requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', boot);
