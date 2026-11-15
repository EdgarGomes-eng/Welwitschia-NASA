/**
 * ============================================================================
 *  WELWITSCHIA LUNAR — main.js
 *  Orquestrador WebXR Mobile, Fusão Arquitetural e Gestor de Modos (VR / 360°)
 *  - Fusão: Lógica WebVR do Edgar + Gráficos Exteriores PBR do Alberto
 *  - Modo VR Fotorrealista como PADRÃO em todos os ambientes
 *  - Alternância em tempo real entre VR (Head-Tracking) e Modo Normal 360°
 *  - HUD Blindado responsivo e compensação de ecrã mobile portrait/landscape
 * ============================================================================
 */
(() => {
  const stage = document.getElementById('vr-stage');
  const container = document.getElementById('canvas-container');
  const visor = document.getElementById('helmet-visor');
  const overlay = document.getElementById('vr-overlay');
  const btnVR = document.getElementById('btn-vr');
  const btn360 = document.getElementById('btn-360');
  const btnModeToggle = document.getElementById('btn-mode-toggle');
  const hudTopBar = document.getElementById('hud-top-bar');
  const telemetryBox = document.getElementById('telemetry-box');
  const teleR1 = document.getElementById('tele-r1');
  const teleR2 = document.getElementById('tele-r2');
  const hudNoteBox = document.getElementById('hud-note-box');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnMute = document.getElementById('btn-mute');
  const btnExit = document.getElementById('btn-exit');

  // 1. INICIALIZAÇÃO DA CENA THREE.JS
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(82, window.innerWidth / window.innerHeight, 0.1, 700);
  camera.position.set(0, 1.65, 0);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  container.appendChild(renderer.domElement);

  // 2. FUSÃO: EXTERIOR REALISTA (ALBERTO) + BASE INTERIOR & CALIBRAÇÃO (EDGAR)
  const exterior = window.WelwitschiaExterior.createExterior(scene);
  const base = window.WelwitschiaBase.createBase(scene, camera);
  const audio = new window.WelwitschiaMission.AudioEngine();
  const state = window.WelwitschiaMission.createMissionState();

  const FACTS = window.WelwitschiaMission.FACTS;
  const MOD_NAMES = window.WelwitschiaMission.MOD_NAMES;
  const SAVE_KEY = window.WelwitschiaMission.SAVE_KEY;

  // 3. ESTADO DE MODOS: VR É O PADRÃO ATIVO
  let isVRMode = true; // VR é o padrão em todos os ambientes
  let useGyro = true;
  let gyroAvailable = false;
  let deviceAlpha = 0, deviceBeta = 0, deviceGamma = 0;
  let pitch = 0, yaw = 0;
  let isDragging = false;
  let startX = 0, startY = 0;

  function updateModeUI() {
    if (btnModeToggle) {
      btnModeToggle.textContent = isVRMode ? '🥽 Modo: VR [Ativo]' : '📱 Modo: Normal 360°';
      btnModeToggle.style.borderColor = isVRMode ? '#00e5ff' : '#ffd27a';
      btnModeToggle.style.color = isVRMode ? '#00e5ff' : '#ffd27a';
    }
    visor.style.display = isVRMode ? 'block' : 'none';
    useGyro = isVRMode;
    base.reticleRing.visible = isVRMode;
    syncStageOrientation();
  }

  function setMode(vrActive, speakNotice = true) {
    isVRMode = vrActive;
    updateModeUI();
    if (speakNotice) {
      say(isVRMode
        ? 'Modo VR ativado com capacete e sensor giroscópio!'
        : 'Modo Normal 360° ativado! Arrasta o ecrã para explorar.',
        true
      );
    }
  }

  // 4. ORIENTAÇÃO DO PALCO E DETEÇÃO MOBILE
  function isDevicePortrait() {
    if (window.matchMedia) {
      return window.matchMedia('(orientation: portrait)').matches;
    }
    return window.innerHeight > window.innerWidth;
  }

  function syncStageOrientation() {
    let w = document.documentElement.clientWidth || window.innerWidth;
    let h = document.documentElement.clientHeight || window.innerHeight;

    if (isVRMode && isDevicePortrait()) {
      stage.classList.add('force-landscape');
      const maxDim = Math.max(w, h);
      const minDim = Math.min(w, h);
      w = maxDim;
      h = minDim;
    } else {
      stage.classList.remove('force-landscape');
    }

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
  }

  function getScreenAngle() {
    if (stage.classList.contains('force-landscape')) return 90;
    if (screen.orientation && typeof screen.orientation.angle === 'number') {
      return screen.orientation.angle;
    }
    if (typeof window.orientation === 'number') {
      return window.orientation;
    }
    return 0;
  }

  // 5. RASTREAMENTO DE CABEÇA E CÂMARA (CALIBRAÇÃO DO EDGAR)
  function handleDeviceOrientation(e) {
    if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
      deviceAlpha = e.alpha;
      deviceBeta = e.beta;
      deviceGamma = e.gamma;
      gyroAvailable = true;
    }
  }
  window.addEventListener('deviceorientation', handleDeviceOrientation, true);

  function updateCameraOrientation() {
    if (isVRMode && useGyro && gyroAvailable && !isDragging) {
      const targetQuat = base.calculateVRQuaternion(deviceAlpha, deviceBeta, deviceGamma, getScreenAngle());
      camera.quaternion.slerp(targetQuat, 0.25);
    } else {
      const targetQuat = base.calculateManualQuaternion(pitch, yaw);
      camera.quaternion.slerp(targetQuat, 0.25);
    }
  }

  // Controlo táctil / rato manual para Modo Normal 360° ou ajuste fino
  function onPointerDown(e) {
    isDragging = true;
    startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    let dx = clientX - startX;
    let dy = clientY - startY;

    if (stage.classList.contains('force-landscape')) {
      const temp = dx;
      dx = dy;
      dy = -temp;
    }

    yaw -= dx * 0.0035;
    pitch = Math.max(-1.45, Math.min(1.45, pitch - dy * 0.0035));
    startX = clientX;
    startY = clientY;
  }

  function onPointerUp(e) {
    isDragging = false;
    // Clique manual para interação
    const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX) || 0;
    const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY) || 0;

    let px = clientX;
    let py = clientY;
    if (stage.classList.contains('force-landscape')) {
      px = clientY;
      py = window.innerHeight - clientX;
    }

    pointerVec.x = (px / window.innerWidth) * 2 - 1;
    pointerVec.y = -(py / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerVec, camera);
    const hits = raycaster.intersectObjects(base.interactables, false);
    const hit = hits.find(h => h.object.visible);
    if (hit) handleInteraction(hit.object);
  }

  window.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('touchstart', onPointerDown, { passive: true });
  window.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('touchend', onPointerUp, { passive: true });

  // 6. RAYCASTER POR OLHAR (GAZE FUSE DE 0.85s — CÓDIGO DO EDGAR)
  const raycaster = new THREE.Raycaster();
  const centerVec = new THREE.Vector2(0, 0);
  const pointerVec = new THREE.Vector2();
  let gazedObj = null;
  let gazeTimer = 0;
  const FUSE_TIME = 0.85;

  function updateGaze(dt) {
    if (!isVRMode) {
      base.reticleRing.scale.set(1, 1, 1);
      return;
    }

    raycaster.setFromCamera(centerVec, camera);
    const hits = raycaster.intersectObjects(base.interactables, false);
    const hit = hits.find(h => h.object.visible);

    if (hit) {
      if (gazedObj !== hit.object) {
        gazedObj = hit.object;
        gazeTimer = 0;
      } else {
        gazeTimer += dt;
        const progress = Math.min(1, gazeTimer / FUSE_TIME);
        const sc = 1 + progress * 0.7;
        base.reticleRing.scale.set(sc, sc, 1);
        base.reticleRing.material.color.setHex(progress >= 1 ? 0x5ce65c : 0xffcb05);

        if (gazeTimer >= FUSE_TIME) {
          handleInteraction(gazedObj);
          gazeTimer = -0.6;
        }
      }
    } else {
      gazedObj = null;
      gazeTimer = 0;
      base.reticleRing.scale.set(1, 1, 1);
      base.reticleRing.material.color.setHex(0x00f0ff);
    }
  }

  // 7. LÓGICA DE INTERAÇÕES E ATIVIDADES DA MISSÃO
  const targetCamPos = new THREE.Vector3(0, 1.65, 0);
  function moveTo(x, z) {
    targetCamPos.set(x, 1.65, z);
  }

  function say(msg, voice = true) {
    state.note = msg;
    state.noteT = 6.5;
    if (voice) audio.speak(msg);
  }

  function handleInteraction(obj) {
    const data = obj.userData || {};
    audio.click();

    if (data.type === 'start') {
      startMission();
    } else if (data.type === 'restart') {
      startMission();
    } else if (data.type === 'module') {
      const idx = data.index;
      state.L[idx] = (state.L[idx] + 1) % 4;
      const lvl = state.L[idx];
      base.moduleScreens[idx].update(lvl, `NÍVEL DE ENERGIA: ${lvl}/3`);
      say(`${MOD_NAMES[idx]}: Nível ${lvl}/3 configurado.`);
    } else if (data.type === 'solar') {
      if (state.dust) {
        state.dust = false;
        base.solarPanels.forEach(p => p.material.color.setHex(0xffffff));
        audio.success();
        say('Painéis solares limpos! Geração de energia restaurada.', true);
      } else {
        say('Painéis fotovoltaicos operando com eficiência solar polar.', false);
      }
    } else if (data.type === 'leak') {
      state.ev = null;
      base.leakBeacon.visible = false;
      base.leakBeacon.position.y = -50;
      audio.success();
      say('Fuga de oxigénio selada com sucesso! Suporte de vida estável.', true);
    } else if (data.type === 'move') {
      moveTo(data.x, data.z);
      say(`A mover para: ${data.label}`, false);
      audio.step();
    }
  }

  function startMission() {
    state.started = true;
    state.over = false;
    state.t = 0;
    state.bat = 65;
    state.o2 = 80;
    state.food = 75;
    state.sci = 0;
    state.integ = 100;
    state.ti = 20;
    state.ev = null;
    state.dust = false;
    state.L = [1, 0, 1, 0];

    base.startBtn.visible = false;
    base.startBtn.position.y = -50;
    base.restartBtn.visible = false;
    base.restartBtn.position.y = -50;

    telemetryBox.style.display = 'block';
    audio.success();
    say('Missão Welwitschia 2032 Iniciada! Equilibra os 4 módulos para sobreviver ao dia lunar.', true);

    for (let i = 0; i < 4; i++) {
      base.moduleScreens[i].update(state.L[i], `NÍVEL: ${state.L[i]}/3`);
    }
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
      : `${msg} — Toca ou olha para JOGAR DE NOVO!`;
    state.noteT = 999;
    audio.speak(win ? 'Missão cumprida! Parabéns, astronauta de Angola!' : msg);

    base.restartBtn.visible = true;
    base.restartBtn.position.set(0, 1.5, -3.0);
  }

  // 8. SIMULAÇÃO CIENTÍFICA (BALANÇO DE ENERGIA & CICLO POLAR)
  function triggerEvent(kind) {
    state.ev = { k: kind, t: 18 };
    audio.alarm();
    state.alertT = 5;

    if (kind === 'storm') {
      state.dust = true;
      base.solarPanels.forEach(p => p.material.color.setHex(0xb89662));
      say('ALERTA: Tempestade Solar de Poeira! Limpa os painéis para não perder energia!', true);
    } else {
      const idx = Math.floor(Math.random() * 4);
      const pos = base.modulePositions[idx];
      base.leakBeacon.position.set(pos.x, 3.2, pos.z);
      base.leakBeacon.visible = true;
      say(`ALERTA: Fuga no Módulo ${MOD_NAMES[idx]}! Olha ou toca para selar!`, true);
    }
  }

  function updateSimulation(dt) {
    if (!state.started || state.over) return;
    state.t += dt;

    const th = (state.t / state.T) * Math.PI * 2;
    const isDay = Math.sin(th) > 0;
    const gen = isDay ? (state.dust ? 0.35 : 1.0) * 1.8 : 0;
    const con = state.L.reduce((a, b) => a + b, 0) * 0.48 + 0.15;
    state.bat = Math.max(0, Math.min(100, state.bat + (gen - con) * dt * 1.4));

    const powered = (i) => state.L[i] > 0 && state.bat > 5;
    state.o2 = Math.max(0, Math.min(100, state.o2 + (powered(0) ? 0.28 : -0.72) * dt));
    state.integ = Math.max(0, Math.min(100, state.integ + (powered(1) ? 0.18 : -0.32) * dt));
    state.food = Math.max(0, Math.min(100, state.food + (powered(2) ? 0.22 : -0.42) * dt));
    if (powered(3)) state.sci = Math.min(60, state.sci + 0.55 * dt);

    const te = isDay ? 127 : -173;
    state.ti += ((powered(0) ? 20 : te * 0.1) - state.ti) * 0.03 * dt;

    if (state.ev) {
      state.ev.t -= dt;
      if (state.ev.k === 'storm') {
        audio.setStorm(0.85);
        state.integ = Math.max(0, state.integ - 0.45 * dt);
      }
      if (state.ev.t <= 0) {
        state.ev = null;
        base.leakBeacon.visible = false;
        base.leakBeacon.position.y = -50;
        audio.setStorm(0);
      }
    } else {
      audio.setStorm(0);
      state.nextEv -= dt;
      if (state.nextEv <= 0) {
        triggerEvent(Math.random() < 0.55 ? 'storm' : 'leak');
        state.nextEv = 28 + Math.random() * 24;
      }
    }

    if (state.t > (state.fk + 1) * 45 && state.fk < FACTS.length) {
      say(`FACTO ESPACIAL: ${FACTS[state.fk]}`, true);
      state.fk++;
    }

    if (state.o2 <= 0) finishMission(false, 'O oxigénio esgotou-se!');
    else if (state.food <= 0) finishMission(false, 'As reservas alimentares terminaram!');
    else if (state.integ <= 0) finishMission(false, 'A blindagem da base falhou!');
    else if (state.sci >= 60 || state.t >= state.T) finishMission(true, '');
  }

  // 9. RENDERIZAÇÃO DO HUD HTML BLINDADO
  function renderHTMLHUD(isDay, cyclePct, te) {
    if (state.started && !state.over) {
      const cycleLabel = isDay ? '☀️ DIA' : '🌑 NOITE';
      teleR1.textContent = `${cycleLabel} ${cyclePct}% • ⚡ BAT ${Math.round(state.bat)}% • 💨 O₂ ${Math.round(state.o2)}% • 🌱 COMIDA ${Math.round(state.food)}%`;
      teleR2.textContent = `🌡️ BASE ${Math.round(state.ti)}°C (FORA ${Math.round(te)}°C) • 🛡️ ESCUDO ${Math.round(state.integ)}% • 🔬 CIÊNCIA ${Math.round(state.sci)}/60`;
    }

    const isAlert = state.alertT > 0 || (state.ev && state.ev.k === 'storm');
    telemetryBox.classList.toggle('alert-border', isAlert);

    const showNote = state.noteT > 0 || state.over;
    if (showNote && state.note) {
      hudNoteBox.style.display = 'block';
      hudNoteBox.textContent = state.note;
      hudNoteBox.classList.toggle('alert-mode', isAlert);
    } else {
      hudNoteBox.style.display = 'none';
    }
  }

  // 10. GESTÃO DE ENTRADA, TELA CHEIA E MODOS
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
            syncStageOrientation();
          }).catch(() => {});
        }
      } catch (_) {}
    }
  }

  function openMode(isVR) {
    requestMobileFullscreen(isVR);
    overlay.classList.add('hidden');
    hudTopBar.style.display = 'flex';
    hudNoteBox.style.display = 'block';

    setMode(isVR, false);

    try { audio.init(); } catch (_) {}
    audio.speak(
      isVR
        ? 'Capacete espacial VR ativado com sensor de cabeça! Deita o telemóvel na horizontal e inicia a missão.'
        : 'Modo 360 graus ativado! Toca ou aponta para iniciar a missão.'
    );

    if (isVR && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  }

  // Event Listeners dos Botões
  btnVR.addEventListener('click', () => openMode(true));
  btn360.addEventListener('click', () => openMode(false));

  if (btnModeToggle) {
    btnModeToggle.addEventListener('click', () => {
      setMode(!isVRMode, true);
    });
  }

  btnFullscreen.addEventListener('click', () => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) {
      requestMobileFullscreen(isVRMode);
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
    hudTopBar.style.display = 'none';
    hudNoteBox.style.display = 'none';
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
      exit.call(document).catch(() => {});
    }
  });

  window.addEventListener('resize', syncStageOrientation);
  window.addEventListener('orientationchange', () => {
    setTimeout(syncStageOrientation, 80);
    setTimeout(syncStageOrientation, 300);
  });
  document.addEventListener('fullscreenchange', () => {
    syncStageOrientation();
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    btnFullscreen.textContent = fsEl ? '⛶ Normal' : '⛶ Tela Cheia';
  });

  // 11. CICLO PRINCIPAL DE RENDERIZAÇÃO (60 FPS)
  let lastTime = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    const elapsed = now * 0.001;

    updateCameraOrientation();
    camera.position.lerp(targetCamPos, 0.06);

    const th = (state.t / state.T) * Math.PI * 2;
    exterior.updateExterior(elapsed, th);
    base.updateBase(elapsed);

    updateGaze(dt);
    updateSimulation(dt);

    if (state.noteT > 0 && state.noteT < 900) state.noteT -= dt;
    if (state.alertT > 0) state.alertT -= dt;

    const isDay = Math.sin(th) > 0;
    const cyclePct = Math.round((state.t / state.T) * 100) % 100;
    const te = isDay ? 127 : -173;
    renderHTMLHUD(isDay, cyclePct, te);

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
  syncStageOrientation();
})();
