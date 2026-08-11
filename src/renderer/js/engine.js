/* SYNTHESIS - Real-time Audio Engine
 * Deck intelligence, beat-sync engine (Temporal Impact Matching),
 * Transition Director mixing bus, and Neural Effects Engine.
 * Ultra-low-latency lookahead scheduling on Web Audio.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.decks = [];
    this.masterFilter = null;
    this.masterCompressor = null;
    this.masterAnalyser = null;
    this.crossfader = 0.5;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: 'interactive' });

    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 22000;

    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -14;
    this.masterCompressor.knee.value = 20;
    this.masterCompressor.ratio.value = 3;
    this.masterCompressor.attack.value = 0.003;
    this.masterCompressor.release.value = 0.18;

    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 1024;

    this.masterFilter.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);
  }

  createDeck(name) {
    this.ensure();
    const deck = new Deck(this, name);
    this.decks.push(deck);
    return deck;
  }

  setMasterFilter(freq) {
    if (this.masterFilter)
      this.masterFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
  }

  setMasterMute(muted) {
    if (this.masterCompressor) this.masterCompressor.mute = !!muted;
  }

  updatePositions() {
    for (const d of this.decks) d._updatePosition();
  }
}

export class Deck {
  constructor(engine, name) {
    this.engine = engine;
    this.name = name;
    const ctx = engine.ctx;

    this.buffer = null;
    this.analysis = null;
    this.trackName = 'EMPTY SLOT';

    this.isPlaying = false;
    this.isCued = true;
    this.position = 0;
    this._source = null;
    this._lastTick = 0;
    this._pitch = 1.0;
    this._lastTargetRate = null;
    this.volume = 0.85;
    this.eq = { low: 0, mid: 0, high: 0 };
    this.pitch = 0; // semitone cents, in percent like DJ pitch slider (-8..8)
    this.fxAmount = 0;
    this.fxType = 'echo';

    this.loopEnabled = false;
    this.loopStart = 0;
    this.loopEnd = 0;

    this.cuePoint = 0;
    this.onTrackEnded = null;

    this._gainNode = ctx.createGain();
    this._gainNode.gain.value = 0.85;

    this._low = ctx.createBiquadFilter();
    this._low.type = 'lowshelf';
    this._low.frequency.value = 220;
    this._mid = ctx.createBiquadFilter();
    this._mid.type = 'peaking';
    this._mid.frequency.value = 1000;
    this._mid.Q.value = 0.7;
    this._high = ctx.createBiquadFilter();
    this._high.type = 'highshelf';
    this._high.frequency.value = 2500;

    this._channelGain = ctx.createGain();
    this._channelGain.gain.value = 1;

    this._crossGain = ctx.createGain();

    this._fxSend = ctx.createGain();
    this._fxSend.gain.value = 0;

    this._analyser = ctx.createAnalyser();
    this._analyser.fftSize = 512;

    this._gainNode.connect(this._low);
    this._low.connect(this._mid);
    this._mid.connect(this._high);
    this._high.connect(this._channelGain);
    this._channelGain.connect(this._crossGain);
    this._channelGain.connect(this._fxSend);
    this._crossGain.connect(engine.masterFilter);
    this._analyser.connect(engine.masterFilter);
  }

  setCross(level) {
    this._crossGain.gain.setTargetAtTime(level, this.engine.ctx.currentTime, 0.02);
  }

  async loadBuffer(audioBuffer, analysis) {
    this.ensureStopped();
    this.buffer = audioBuffer;
    this.analysis = analysis;
    this.position = 0;
    this._source = null;
  }

  ensureStopped() {
    if (this._source) {
      try {
        this._source.onended = null;
        this._source.stop(0);
      } catch {}
      this._source = null;
    }
    this.isPlaying = false;
    this._lastTick = 0;
  }

  _buildSource() {
    const ctx = this.engine.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = this._effectiveRate();
    this._applyLoop(src);
    src.connect(this._gainNode);
    src.onended = () => {
      if (this.isPlaying && this._source === src) {
        this.isPlaying = false;
        this._source = null;
        if (this.position >= this.buffer.duration - 0.05) this.position = 0;
        if (this.onTrackEnded) this.onTrackEnded(this);
      }
    };
    return src;
  }

  _applyLoop(src) {
    if (this.loopEnabled && this.loopEnd > this.loopStart) {
      src.loop = true;
      src.loopStart = this.loopStart;
      src.loopEnd = Math.min(this.loopEnd, this.buffer.duration);
    } else {
      src.loop = false;
    }
  }

  _effectiveRate() {
    return this._pitch * (1 + this.pitch / 100);
  }

  play() {
    const ctx = this.engine.ctx;
    if (!this.buffer) return;
    if (this.isPlaying) return;
    if (this.position >= this.buffer.duration - 0.01) this.position = this.cuePoint || 0;
    this.engine.ensure();
    if (ctx.state === 'suspended') ctx.resume();
    const src = this._buildSource();
    this._source = src;
    src.start(ctx.currentTime, this.position);
    this.isPlaying = true;
    this._lastTick = ctx.currentTime;
    this._lastTargetRate = this._effectiveRate();
  }

  pause() {
    if (!this.isPlaying) return;
    const ctx = this.engine.ctx;
    if (this._source) {
      try {
        this._source.stop(ctx.currentTime + 0.02);
      } catch {}
    }
    this.isPlaying = false;
    this._source = null;
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  seekTo(t) {
    if (!this.buffer) return;
    this.position = Math.max(0, Math.min(t, this.buffer.duration - 0.02));
    this.isCued = false;
    if (this.isPlaying && this._source) {
      const ctx = this.engine.ctx;
      try {
        this._source.stop(ctx.currentTime + 0.01);
      } catch {}
      this._source = null;
      const src = this._buildSource();
      this._source = src;
      src.start(ctx.currentTime + 0.02, this.position);
      this._lastTick = ctx.currentTime;
    }
  }

  setPitch(p) {
    this.pitch = Math.max(-50, Math.min(50, p));
    if (this._source) {
      this._source.playbackRate.setTargetAtTime(
        this._effectiveRate(),
        this.engine.ctx.currentTime,
        0.05,
      );
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1.5, v));
    this._gainNode.gain.setTargetAtTime(this.volume, this.engine.ctx.currentTime, 0.02);
  }

  setEq(band, val) {
    this.eq[band] = Math.max(-0.85, Math.min(0.85, val));
    const g = this.eq[band] * 24;
    const ctx = this.engine.ctx;
    if (band === 'low') this._low.gain.setTargetAtTime(g, ctx.currentTime, 0.04);
    if (band === 'mid') this._mid.gain.setTargetAtTime(g, ctx.currentTime, 0.04);
    if (band === 'high') this._high.gain.setTargetAtTime(g, ctx.currentTime, 0.04);
  }

  setFxAmount(v) {
    this.fxAmount = Math.max(0, Math.min(1, v));
    this._fxSend.gain.setTargetAtTime(this.fxAmount * 0.85, this.engine.ctx.currentTime, 0.04);
  }

  setFxType(type) {
    this.fxType = type;
    const ctx = this.engine.ctx;
    if (this._fxNodes) {
      try {
        this._fxNodes.disconnect();
      } catch {}
    }
    this._buildFx(ctx);
  }

  _buildFx(ctx) {
    if (this.fxType === 'none') {
      this._fxNodes = null;
      return;
    }
    const chain = this._fxSend;
    const nodes = [];
    if (this.fxType === 'echo' || this.fxType === 'beatEcho') {
      const delay = ctx.createDelay(4);
      const feedback = ctx.createGain();
      const wet = ctx.createGain();
      const rate = this.analysis ? this.analysis.bpm / 60 : 1;
      const time = this.fxType === 'beatEcho' ? (60 / rate) * 1.5 : 0.28;
      delay.delayTime.value = time;
      feedback.gain.value = 0.45;
      wet.gain.value = 0.8;
      delay.connect(feedback);
      feedback.connect(delay);
      chain.connect(delay);
      delay.connect(wet);
      wet.connect(this.engine.masterFilter);
      delay.connect(this.engine.masterFilter);
      nodes.push(delay, feedback, wet);
    } else if (this.fxType === 'reverb') {
      const convolver = ctx.createConvolver();
      convolver.buffer = this._impulseResponse(ctx, 2.4, 3.5);
      const wet = ctx.createGain();
      wet.gain.value = 0.9;
      chain.connect(convolver);
      convolver.connect(wet);
      wet.connect(this.engine.masterFilter);
      nodes.push(convolver, wet);
    } else if (this.fxType === 'filter') {
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 4000;
      const wet = ctx.createGain();
      wet.gain.value = 1;
      chain.connect(filt);
      filt.connect(wet);
      wet.connect(this.engine.masterFilter);
      nodes.push(filt, wet);
    } else if (this.fxType === 'riser') {
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.Q.value = 2;
      filt.frequency.value = 300;
      const sweep = ctx.createGain();
      sweep.gain.value = 1;
      const now = ctx.currentTime;
      filt.frequency.setValueAtTime(300, now);
      filt.frequency.exponentialRampToValueAtTime(8000, now + 4);
      sweep.gain.setValueAtTime(0.01, now);
      sweep.gain.exponentialRampToValueAtTime(0.7, now + 4);
      chain.connect(filt);
      filt.connect(sweep);
      sweep.connect(this.engine.masterFilter);
      nodes.push(filt, sweep);
    }
    this._fxNodes = nodes;
  }

  _impulseResponse(ctx, seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  setLoop(enable, start, end) {
    this.loopEnabled = enable;
    if (start !== undefined) this.loopStart = start;
    if (end !== undefined) this.loopEnd = end;
    if (this._source && this._source.buffer) this._applyLoop(this._source);
  }

  clearLoop() {
    this.loopEnabled = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    if (this._source) this._applyLoop(this._source);
  }

  nudge(ms) {
    if (!this.buffer) return;
    this.seekTo(this.position + ms / 1000);
  }

  _updatePosition() {
    const ctx = this.engine.ctx;
    if (!this.isPlaying || !this._source) return;
    const now = ctx.currentTime;
    if (!this._lastTick) this._lastTick = now;
    let dt = now - this._lastTick;
    this._lastTick = now;
    if (dt < 0 || dt > 0.5) dt = 0;
    let pos = this.position + dt * this._effectiveRate();
    if (this.loopEnabled && this.loopEnd > this.loopStart) {
      const span = this.loopEnd - this.loopStart;
      if (pos >= this.loopEnd) pos = this.loopStart + ((pos - this.loopStart) % span);
    }
    this.position = pos;
    if (this.position >= this.buffer.duration - 0.02) {
      this.position = 0;
    }
  }

  getBPM() {
    return this.analysis ? this.analysis.bpm : 0;
  }

  currentBeat() {
    if (!this.analysis || this.analysis.bpm <= 0) return -1;
    const beatLen = 60 / this.analysis.bpm;
    const offset = this.position - this.analysis.phase;
    return offset >= 0 ? Math.floor(offset / beatLen) : -1;
  }

  beatPhase() {
    if (!this.analysis || this.analysis.bpm <= 0) return 0;
    const beatLen = 60 / this.analysis.bpm;
    const offset = this.position - this.analysis.phase;
    if (offset < 0) return 0;
    return (offset % beatLen) / beatLen;
  }

  /* Temporal Impact Matching - beat-sync with phase correction */
  syncTo(referenceDeck) {
    if (!this.analysis || !referenceDeck.analysis || !this.buffer) return;
    const ctx = this.engine.ctx;
    const targetRate = referenceDeck.analysis.bpm / this.analysis.bpm;

    const beatA = referenceDeck.analysis.bpm > 0 ? 60 / referenceDeck.analysis.bpm : 1;
    const beatB = this.analysis.bpm > 0 ? 60 / this.analysis.bpm : 1;
    const posA = referenceDeck.position;
    const posB = this.position;

    const phaseA = (((posA - referenceDeck.analysis.phase) % beatA) + beatA) % beatA;
    const phaseB = (((posB - this.analysis.phase) % beatB) + beatB) % beatB;

    const phaseDelta = (phaseA - phaseB) % beatA;
    let correction = phaseDelta;
    if (correction > beatA / 2) correction -= beatA;

    const now = ctx.currentTime;
    if (this._source) {
      const targetNow = targetRate;
      if (Math.abs(correction) > 0.002) {
        const dir = correction > 0 ? 1 : -1;
        const duration = Math.max(0.1, Math.min(3, Math.abs(correction) / 0.018));
        const rateNow = targetNow * (1 + dir * 0.012);
        this._source.playbackRate.setValueAtTime(rateNow, now);
        this._source.playbackRate.setTargetAtTime(targetNow, now + duration, duration / 4);
      } else {
        this._source.playbackRate.setTargetAtTime(targetNow, now, 0.05);
      }
    }
    this._pitch = targetRate / (1 + this.pitch / 100);
    this._lastTargetRate = targetRate;
    this.isCued = false;
    return { targetRate, correction };
  }

  setMasterSyncRate(rate) {
    if (this._source) {
      this._source.playbackRate.setTargetAtTime(rate, this.engine.ctx.currentTime, 0.06);
    }
    this._lastTargetRate = rate;
  }

  getFxNodes() {
    return this._fxNodes;
  }
}
