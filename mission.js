/**
 * ============================================================================
 *  WELWITSCHIA LUNAR — mission.js
 *  Módulo de Simulação Científica e Áudio Procedural (Código do Edgar)
 *  - Motor de Áudio Web Audio com sintetizador de vento, ruído e zumbido
 *  - Voz do Copiloto em Português de Angola / Portugal (pt-AO / pt-PT)
 *  - Gestão de Recursos: Bateria, Oxigénio, Comida, Escudo e Ciência
 *  - Eventos de Emergência: Tempestade de Poeira Solar e Fuga de O₂
 * ============================================================================
 */
window.WelwitschiaMission = (() => {
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.windGain = null;
      this.windFilter = null;
      this.muted = false;
      this._noise = null;
      this._voice = null;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (_) { return; }

      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.72;
      this.master.connect(ctx.destination);

      this._noise = this._makeNoise(3.2);

      const windSrc = ctx.createBufferSource();
      windSrc.buffer = this._noise;
      windSrc.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 380;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0.035;
      windSrc.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      windSrc.start();

      const hum = ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 47;
      const humGain = ctx.createGain();
      humGain.gain.value = 0.032;
      hum.connect(humGain);
      humGain.connect(this.master);
      hum.start();

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

    tone(freq = 440, dur = 0.12, type = 'sine', vol = 0.07, delay = 0) {
      if (!this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.06);
    }

    click() { this.tone(920, 0.045, 'square', 0.03); }
    step() { this.tone(85, 0.11, 'sine', 0.05); }
    error() { this.tone(200, 0.14, 'square', 0.045); this.tone(150, 0.2, 'square', 0.045, 0.12); }
    success() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.06, i * 0.085)); }
    alarm() {
      for (let i = 0; i < 3; i++) {
        this.tone(880, 0.12, 'sawtooth', 0.04, i * 0.26);
        this.tone(620, 0.12, 'sawtooth', 0.035, i * 0.26 + 0.13);
      }
    }

    setStorm(level) {
      if (!this.ctx || !this.windGain) return;
      const t = this.ctx.currentTime;
      this.windGain.gain.setTargetAtTime(0.035 + level * 0.32, t, 1.4);
      this.windFilter.frequency.setTargetAtTime(360 + level * 820, t, 1.4);
    }

    _ptVoice() {
      if (typeof speechSynthesis === 'undefined') return null;
      if (this._voice) return this._voice;
      let voices = [];
      try { voices = speechSynthesis.getVoices() || []; } catch (_) { return null; }
      if (!voices.length) return null;
      const find = (lang) => voices.find((v) => (v.lang || '').toLowerCase() === lang);
      this._voice = find('pt-ao') || find('pt-pt') || voices.find((v) => (v.lang || '').toLowerCase().startsWith('pt')) || null;
      return this._voice;
    }

    speak(text) {
      if (this.muted || !text || typeof speechSynthesis === 'undefined') return;
      try {
        speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text.replace(/\n/g, ' '));
        utter.lang = 'pt-PT';
        utter.rate = 0.98;
        utter.pitch = 0.96;
        utter.volume = 0.95;
        const voice = this._ptVoice();
        if (voice) utter.voice = voice;
        speechSynthesis.speak(utter);
      } catch (_) {}
    }
  }

  const FACTS = [
    'A Lua está a 384 mil km da Terra. Cabiam 30 planetas Terra lado a lado!',
    'Na Lua, a gravidade é seis vezes mais fraca do que na Terra.',
    'Um dia lunar tem 14 dias de luz seguidos de 14 dias de escuridão.',
    'De dia a Lua chega a +127°C e de noite desce até -173°C!',
    'A Lua não tem ar nem escudo magnético. Precisamos de oxigénio e blindagem.',
    'A Welwitschia é uma planta do deserto do Namibe, em Angola, e vive mais de mil anos!'
  ];

  const MOD_NAMES = ['Suporte de Vida', 'Blindagem Solar', 'Estufas', 'Laboratório'];
  const SAVE_KEY = 'welwitschia-lunar-vr-v15';

  function createMissionState() {
    return {
      T: 300,
      t: 0,
      L: [1, 0, 1, 0],
      bat: 65,
      o2: 80,
      food: 75,
      sci: 0,
      integ: 100,
      ti: 20,
      started: false,
      over: false,
      ev: null,
      nextEv: 28,
      fk: 0,
      dust: false,
      note: 'Toca ou aponta o visor para INICIAR MISSÃO!',
      noteT: 999,
      alertT: 0
    };
  }

  return {
    AudioEngine,
    FACTS,
    MOD_NAMES,
    SAVE_KEY,
    createMissionState
  };
})();
