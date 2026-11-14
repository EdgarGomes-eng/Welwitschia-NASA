/**
 * ============================================================================
 *  WELWITSCHIA LUNAR — game.js
 *  Lógica da missão NASA, objectivos, eventos dinâmicos, áudio sintetizado
 *  PT-AO (voz + ambiente) e gravação offline com MediaRecorder.
 * ============================================================================
 */
import { LunarWorld } from './scene.js';

const $ = (sel) => document.querySelector(sel);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad2 = (n) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
const fmtTime = (sec) => `${pad2(sec / 60)}:${pad2(sec % 60)}`;
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

/* ==================================================================== *
 *  ÁUDIO — tudo sintetizado / falado localmente (sem ficheiros)
 * ==================================================================== */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.streamDest = null;
    this.windGain = null;
    this.windFilter = null;
    this.drillGain = null;
    this.muted = false;
    this._drill = false;
    this._noise = null;
    this._started = false;
    this._voice = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (_) {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.72;
    this.master.connect(ctx.destination);

    try {
      this.streamDest = ctx.createMediaStreamDestination();
      this.master.connect(this.streamDest);
    } catch (_) {
      this.streamDest = null;
    }

    this._noise = this._makeNoise(3.2);

    // vento lunar / poeira
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this._noise;
    windSrc.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 380;
    this.windFilter.Q.value = 0.4;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.035;
    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    windSrc.start();

    // zumbido do fato / suporte de vida
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 47;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.032;
    hum.connect(humGain);
    humGain.connect(this.master);
    hum.start();

    const hum2 = ctx.createOscillator();
    hum2.type = 'triangle';
    hum2.frequency.value = 94;
    const hum2Gain = ctx.createGain();
    hum2Gain.gain.value = 0.008;
    hum2.connect(hum2Gain);
    hum2Gain.connect(this.master);
    hum2.start();

    // broca
    const drillSrc = ctx.createBufferSource();
    drillSrc.buffer = this._noise;
    drillSrc.loop = true;
    const drillFilter = ctx.createBiquadFilter();
    drillFilter.type = 'bandpass';
    drillFilter.frequency.value = 950;
    drillFilter.Q.value = 0.85;
    this.drillGain = ctx.createGain();
    this.drillGain.gain.value = 0;
    drillSrc.connect(drillFilter);
    drillFilter.connect(this.drillGain);
    this.drillGain.connect(this.master);
    drillSrc.start();

    this._started = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  _makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 2.4;
    }
    return buf;
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.72, this.ctx.currentTime, 0.04);
    }
    if (this.muted && typeof speechSynthesis !== 'undefined') {
      try { speechSynthesis.cancel(); } catch (_) {}
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    if (typeof speechSynthesis !== 'undefined') {
      try { speechSynthesis.pause(); } catch (_) {}
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (typeof speechSynthesis !== 'undefined') {
      try { speechSynthesis.resume(); } catch (_) {}
    }
  }

  tone(freq = 440, dur = 0.12, type = 'sine', vol = 0.07, delay = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.06);
  }

  noiseBurst(dur = 0.3, vol = 0.1, cutoff = 900, delay = 0) {
    if (!this.ctx || !this._noise || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  click() {
    this.tone(920, 0.045, 'square', 0.025);
  }

  error() {
    this.tone(200, 0.14, 'square', 0.045);
    this.tone(150, 0.2, 'square', 0.045, 0.12);
  }

  success() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.055, i * 0.085));
  }

  alarm() {
    for (let i = 0; i < 3; i++) {
      this.tone(880, 0.12, 'sawtooth', 0.035, i * 0.26);
      this.tone(620, 0.12, 'sawtooth', 0.03, i * 0.26 + 0.13);
    }
  }

  servo() {
    this.tone(260, 0.5, 'sawtooth', 0.028, 0, 120);
  }

  impact() {
    this.tone(95, 0.85, 'sine', 0.24, 0, 32);
    this.noiseBurst(0.7, 0.2, 420);
    this.noiseBurst(0.25, 0.12, 1600, 0.04);
  }

  footstep(sprint) {
    this.noiseBurst(0.08, sprint ? 0.055 : 0.038, 240);
    this.tone(sprint ? 74 : 64, 0.07, 'sine', 0.025);
  }

  setStorm(level) {
    if (!this.ctx || !this.windGain) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.035 + level * 0.32, t, 1.4);
    this.windFilter.frequency.setTargetAtTime(360 + level * 820, t, 1.4);
  }

  setDrill(on) {
    if (!this.ctx || !this.drillGain || this._drill === on) return;
    this._drill = on;
    this.drillGain.gain.setTargetAtTime(on ? 0.075 : 0, this.ctx.currentTime, on ? 0.06 : 0.12);
    if (on) this.tone(190, 0.35, 'sawtooth', 0.02, 0, 240);
  }

  getAudioTrack() {
    if (!this.streamDest) return null;
    const tracks = this.streamDest.stream.getAudioTracks();
    return tracks.length ? tracks[0] : null;
  }

  _ptVoice() {
    if (typeof speechSynthesis === 'undefined') return null;
    if (this._voice) return this._voice;
    let voices = [];
    try { voices = speechSynthesis.getVoices() || []; } catch (_) { return null; }
    if (!voices.length) return null;
    const find = (lang) => voices.find((v) => (v.lang || '').toLowerCase() === lang);
    this._voice =
      find('pt-ao') ||
      find('pt-pt') ||
      voices.find((v) => (v.lang || '').toLowerCase().startsWith('pt')) ||
      null;
    return this._voice;
  }

  speak(text) {
    if (this.muted || !text || typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'pt-PT';
      utter.rate = 1.0;
      utter.pitch = 0.94;
      utter.volume = 0.92;
      const voice = this._ptVoice();
      if (voice) utter.voice = voice;
      speechSynthesis.speak(utter);
    } catch (_) {
      /* sem voz disponível */
    }
  }
}
