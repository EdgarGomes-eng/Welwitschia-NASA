/**
 * ============================================================================
 *  WELWITSCHIA LUNAR — game.js
 *  Prioridade Web Mobile: Tela Cheia Síncrona, Modo VR Horizontal e Modo 360°
 * ============================================================================
 */
(() => {
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

  const stage = document.getElementById('vr-stage');
  const container = document.getElementById('canvas-container');
  const visor = document.getElementById('helmet-visor');
  const overlay = document.getElementById('vr-overlay');
  const btnVR = document.getElementById('btn-vr');
  const btn360 = document.getElementById('btn-360');
  const topControls = document.getElementById('top-controls');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnMute = document.getElementById('btn-mute');
  const btnExit = document.getElementById('btn-exit');

  const audio = new AudioEngine();
  const world = window.WelwitschiaScene.initScene(container, stage);

  const FACTS = [
    'A Lua está a 384 mil km da Terra. Cabiam 30 planetas Terra lado a lado!',
    'Na Lua, a gravidade é seis vezes mais fraca do que na Terra.',
    'Um dia lunar tem 14 dias de luz seguidos de 14 dias de escuridão.',
    'De dia a Lua chega a +127°C e de noite desce até -173°C!',
    'A Lua não tem ar nem escudo magnético. Precisamos de oxigénio e blindagem.',
    'A Welwitschia é uma planta do deserto do Namibe, em Angola, e vive mais de mil anos!'
  ];

  const MOD_NAMES = ['Suporte de Vida', 'Blindagem Solar', 'Estufas', 'Laboratório'];
  const SAVE_KEY = 'welwitschia-lunar-vr-v10';

  const state = {
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

  function say(msg, voice = true) {
    state.note = msg;
    state.noteT = 6.5;
    if (voice) audio.speak(msg);
  }

  function triggerAlert(msg) {
    state.alertT = 4.0;
    audio.alarm();
    say(msg, true);
  }

  function refreshScreens() {
    state.L.forEach((lvl, i) => {
      world.moduleScreens[i].update(lvl, `NÍVEL DE ENERGIA: ${lvl}/3`);
    });
  }

  function startMission() {
    if (state.started) return;
    audio.init();
    audio.success();
    state.started = true;
    world.startBtn.visible = false;
    world.startBtn.position.y = -50;
    refreshScreens();
    say('Missão iniciada! Vira a cabeça ou desliza o ecrã para explorar a base lunar.');
    state.noteT = 8;
  }

  function finishMission(win, msg) {
    state.over = true;
    const stars = (state.o2 > 50 ? 1 : 0) + (state.food > 50 ? 1 : 0) + (state.integ > 60 ? 1 : 0);
    try {
      const sv = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      sv.best = Math.max(sv.best || 0, Math.round(state.sci));
      localStorage.setItem(SAVE_KEY, JSON.stringify(sv));
    } catch (_) {}

    if (win) audio.success();
    else audio.error();

    state.note = win
      ? `Missão Cumprida! Ciência: ${Math.round(state.sci)} • Estrelas: ${stars}/3`
      : `${msg}\nToca ou olha para JOGAR DE NOVO!`;
    state.noteT = 999;
    audio.speak(win ? 'Missão cumprida! Parabéns, astronauta de Angola!' : msg);

    world.restartBtn.visible = true;
    world.restartBtn.position.set(0, 1.5, -3.0);
  }

  function spawnEvent() {
    const kind = ['storm', 'dust', 'leak'][Math.floor(Math.random() * 3)];
    state.nextEv = state.t + 38 + Math.random() * 18;

    if (kind === 'storm') {
      state.ev = { k: 'storm', t: 10 };
      audio.setStorm(1.0);
      triggerAlert('Alerta! Tempestade solar! Aumenta a Blindagem Solar para o nível 3!');
    } else if (kind === 'dust') {
      state.ev = { k: 'dust' };
      state.dust = true;
      world.solarPanels.forEach(p => p.material.color.setHex(0xb89662));
      triggerAlert('Poeira lunar nos painéis! Olha ou toca nos painéis solares à esquerda.');
    } else {
      const idx = Math.floor(Math.random() * 4);
      const pos = world.modulePositions[idx];
      state.ev = { k: 'leak', t: 15 };
      world.leakBeacon.position.set(pos.x, 3.2, pos.z);
      world.leakBeacon.visible = true;
      triggerAlert('Fuga de calor! Olha ou toca na esfera vermelha para selar!');
    }
  }

  function endEvent() {
    const k = state.ev.k;
    state.ev = null;
    audio.setStorm(0);
    if (k === 'storm') {
      const diff = 3 - state.L[1];
      state.integ -= diff * 20;
      state.o2 -= diff * 8;
      if (diff > 0) {
        audio.error();
        say('A tempestade solar danificou a base!');
      } else {
        audio.success();
        say('A blindagem resistiu perfeitamente!');
      }
    } else if (k === 'leak') {
      state.ti -= 24;
      world.leakBeacon.visible = false;
      world.leakBeacon.position.y = -50;
      audio.error();
      say('O calor escapou e a estação arrefeceu!');
    }
  }

  function handleInteraction(obj) {
    const data = obj.userData;
    if (!data) return;

    if (data.type === 'start' && !state.started) {
      startMission();
    } else if (data.type === 'restart' && state.over) {
      location.reload();
    } else if (data.type === 'move' && state.started) {
      world.moveTo(data.x, data.z);
      audio.step();
      say(`A caminhar para: ${data.label}`, false);
    } else if (data.type === 'module' && state.started && !state.over) {
      const i = data.index;
      state.L[i] = (state.L[i] + 1) % 4;
      audio.click();
      refreshScreens();
      say(`${MOD_NAMES[i]} no nível ${state.L[i]}`, false);
    } else if (data.type === 'solar' && state.started && state.dust) {
      state.dust = false;
      state.ev = null;
      audio.success();
      world.solarPanels.forEach(p => p.material.color.setHex(0xffffff));
      say('Painéis solares limpos! Energia restaurada!');
    } else if (data.type === 'leak' && state.ev && state.ev.k === 'leak') {
      state.ev = null;
      audio.success();
      world.leakBeacon.visible = false;
      world.leakBeacon.position.y = -50;
      say('Fuga térmica selada! Excelente trabalho!');
    }
  }

  // --- CONTROLO DE ORIENTAÇÃO MOBILE (GIROSCÓPIO + ARRASTAR) ---
  let useGyro = false;
  let gyroAvailable = false;
  let deviceAlpha = 0, deviceBeta = 90, deviceGamma = 0;
  let yaw = 0, pitch = 0, isDragging = false, downX = 0, downY = 0, lastX = 0, lastY = 0;

  window.addEventListener('deviceorientation', (e) => {
    if (e.alpha !== null) {
      gyroAvailable = true;
      deviceAlpha = e.alpha;
      deviceBeta = e.beta;
      deviceGamma = e.gamma;
    }
  });

  const raycaster = new THREE.Raycaster();
  const centerVec = new THREE.Vector2(0, 0);
  const pointerVec = new THREE.Vector2();

  container.addEventListener('pointerdown', (e) => {
    isDragging = true;
    downX = lastX = e.clientX;
    downY = lastY = e.clientY;
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    if (world.isForcedLandscape()) {
      yaw -= (e.clientY - lastY) * 0.004;
      pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientX - lastX) * 0.004));
    } else {
      yaw -= (e.clientX - lastX) * 0.004;
      pitch = Math.max(-1.3, Math.min(1.3, pitch - (e.clientY - lastY) * 0.004));
    }
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener('pointerup', (e) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    isDragging = false;
    if (moved < 12) {
      const w = window.innerWidth, h = window.innerHeight;
      if (world.isForcedLandscape()) {
        pointerVec.x = (e.clientY / h) * 2 - 1;
        pointerVec.y = (e.clientX / w) * 2 - 1;
      } else {
        pointerVec.x = (e.clientX / w) * 2 - 1;
        pointerVec.y = -(e.clientY / h) * 2 + 1;
      }
      raycaster.setFromCamera(pointerVec, world.camera);
      const hits = raycaster.intersectObjects(world.interactables, false);
      const hit = hits.find(h => h.object.visible);
      if (hit) handleInteraction(hit.object);
    }
  });

  const euler = new THREE.Euler();
  const q0 = new THREE.Quaternion();
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  const targetQuat = new THREE.Quaternion();

  function getScreenAngle() {
    if (world.isForcedLandscape()) return 90;
    if (screen.orientation && typeof screen.orientation.angle === 'number') {
      return screen.orientation.angle;
    }
    return window.orientation || 0;
  }

  function updateCameraOrientation() {
    if (useGyro && gyroAvailable && !isDragging) {
      const alpha = THREE.MathUtils.degToRad(deviceAlpha);
      const beta = THREE.MathUtils.degToRad(deviceBeta);
      const gamma = THREE.MathUtils.degToRad(deviceGamma);
      const orient = THREE.MathUtils.degToRad(getScreenAngle());

      euler.set(beta, alpha, -gamma, 'YXZ');
      q0.setFromEuler(euler);
      q0.multiply(q1);
      q0.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -orient));
      targetQuat.copy(q0);
    } else {
      euler.set(pitch, yaw, 0, 'YXZ');
      targetQuat.setFromEuler(euler);
    }
    world.camera.quaternion.slerp(targetQuat, 0.25);
  }

  // --- RAYCASTER POR OLHAR (GAZE FUSE DE 0.85s) ---
  let gazedObj = null;
  let gazeTimer = 0;
  const FUSE_TIME = 0.85;

  function updateGaze(dt) {
    raycaster.setFromCamera(centerVec, world.camera);
    const hits = raycaster.intersectObjects(world.interactables, false);
    const hit = hits.find(h => h.object.visible);

    if (hit) {
      if (gazedObj !== hit.object) {
        gazedObj = hit.object;
        gazeTimer = 0;
      } else {
        gazeTimer += dt;
        const progress = Math.min(1, gazeTimer / FUSE_TIME);
        const sc = 1 + progress * 0.7;
        world.reticleRing.scale.set(sc, sc, 1);
        world.reticleRing.material.color.setHex(progress >= 1 ? 0x5ce65c : 0xffcb05);

        if (gazeTimer >= FUSE_TIME) {
          handleInteraction(gazedObj);
          gazeTimer = -0.6;
        }
      }
    } else {
      gazedObj = null;
      gazeTimer = 0;
      world.reticleRing.scale.set(1, 1, 1);
      world.reticleRing.material.color.setHex(0x00f0ff);
    }
  }

  // --- ATIVAÇÃO DE TELA CHEIA (FULLSCREEN) SÍNCRONA NO GESTO DE CLIQUE MOBILE ---
  function requestMobileFullscreen(lockLandscape) {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (req) {
      try {
        const promise = req.call(el, { navigationUI: 'hide' });
        if (promise && promise.then) {
          promise.then(() => {
            if (lockLandscape && screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('landscape-primary').catch(() => {});
            }
            world.syncStageOrientation();
          }).catch(() => {});
        }
      } catch (_) {}
    }
  }

  // Escuta mudanças de fullscreen para sincronizar
  document.addEventListener('fullscreenchange', () => {
    world.syncStageOrientation();
    // Atualiza botão de fullscreen
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    btnFullscreen.textContent = fsEl ? '⛶ Sair Tela Cheia' : '⛶ Tela Cheia';
  });

  function openMode(isVR) {
    // 1. Pede Tela Cheia imediatamente no clique (regra obrigatória do Chrome/Android)
    requestMobileFullscreen(isVR);

    // 2. Esconde o menu e ativa o palco
    overlay.classList.add('hidden');
    topControls.style.display = 'flex';
    visor.style.display = isVR ? 'block' : 'none';
    useGyro = isVR;
    world.setVRLandscape(isVR);

    // 3. Inicia áudio e voz PT-AO
    try { audio.init(); } catch (_) {}
    audio.speak(
      isVR
        ? 'Capacete espacial ativado! Deita o telemóvel na horizontal e inicia a missão.'
        : 'Modo 360 graus em tela cheia ativado! Toca ou aponta para iniciar a missão.'
    );

    // 4. Pedido de giroscópio para iOS
    if (isVR && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  }

  btnVR.addEventListener('click', () => openMode(true));
  btn360.addEventListener('click', () => openMode(false));

  btnFullscreen.addEventListener('click', () => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) {
      requestMobileFullscreen(useGyro);
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document).catch(() => {});
    }
  });

  btnMute.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    btnMute.textContent = audio.muted ? '🔇 Mudo' : '🔊 Som';
  });

  btnExit.addEventListener('click', () => {
    overlay.classList.remove('hidden');
    visor.style.display = 'none';
    topControls.style.display = 'none';
    useGyro = false;
    world.setVRLandscape(false);
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
      exit.call(document).catch(() => {});
    }
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.getElapsedTime();

    const th = 0.25 + (state.t / state.T) * Math.PI * 2;
    const sn = Math.sin(th);
    const te = -173 + 300 * Math.max(0, Math.min(1, (sn + 0.1) / 0.45));
    const gen = Math.max(0, sn) * 3.2 * (state.dust ? 0.4 : 1);

    if (state.started && !state.over) {
      const c = state.L;
      state.t += dt;
      state.noteT -= dt;
      state.alertT -= dt;

      const drain = 0.28 * (c[0] + c[1] + c[2]) + 0.34 * c[3];
      state.bat = Math.max(0, Math.min(100, state.bat + (gen - drain) * dt));
      const pw = state.bat > 0;
      const cold = state.ti < -10;

      state.o2 = Math.max(0, Math.min(100, state.o2 + (-0.48 + (pw ? c[0] * 0.45 : 0) - (cold ? 0.55 : 0)) * dt));
      state.food = Math.max(0, Math.min(100, state.food + (-0.24 + (pw ? c[2] * 0.22 : 0)) * dt));

      if (pw && !cold) {
        state.sci = Math.max(0, Math.min(100, state.sci + c[3] * 0.85 * dt));
        while (state.fk < FACTS.length && state.sci >= 10 * (state.fk + 1)) {
          audio.success();
          say('Descoberta! ' + FACTS[state.fk], true);
          state.noteT = 9;
          state.fk++;
        }
      }

      state.integ = Math.max(0, Math.min(100, state.integ + (pw && c[1] > 0 ? 0.22 : 0) * dt));
      state.ti += ((pw ? 20 : te * 0.4) - state.ti) * 0.03 * dt;

      if (state.ev) {
        if (state.ev.k !== 'dust') {
          state.ev.t -= dt;
          if (state.ev.t <= 0) endEvent();
        }
      } else if (state.t >= state.nextEv) {
        spawnEvent();
      }

      if (state.o2 <= 0) finishMission(false, 'Acabou o oxigénio na estação!');
      else if (state.food <= 0) finishMission(false, 'Acabaram os alimentos da estufa!');
      else if (state.integ <= 0) finishMission(false, 'A blindagem da base falhou!');
      else if (state.ti < -40) finishMission(false, 'A base congelou na noite lunar!');
      else if (state.t >= state.T) finishMission(state.sci >= 60, 'Faltou ciência! Usa mais o Laboratório.');
    }

    updateCameraOrientation();
    updateGaze(dt);
    world.updateAnimations(elapsed, th);

    world.updateHUD({
      started: state.started,
      over: state.over,
      isDay: sn > 0,
      cyclePct: Math.round((state.t / state.T) * 100),
      bat: Math.round(state.bat),
      o2: Math.round(state.o2),
      food: Math.round(state.food),
      ti: Math.round(state.ti),
      te: Math.round(te),
      integ: Math.round(state.integ),
      sci: Math.round(state.sci),
      note: state.noteT > 0 || state.over ? state.note : '',
      alertFlash: state.alertT > 0 || (state.ev && state.ev.k === 'storm')
    });

    world.renderFrame();
  }

  animate();
})();
