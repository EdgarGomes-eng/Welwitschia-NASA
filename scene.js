// scene.js — Estereoscopia Real (Olho Esquerdo / Olho Direito com Paralaxe 3D) + Cenário Lunar
window.WelwitschiaScene = (() => {
  const S = window.WelwitschiaShaders;

  function initScene(container) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020308);
    scene.fog = new THREE.FogExp2(0x050711, 0.0045);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 600);
    camera.position.set(0, 1.65, 0);
    scene.add(camera);

    // Câmaras dedicadas para Olho Esquerdo e Olho Direito com frustum assimétrico real
    const camL = new THREE.PerspectiveCamera(75, 1, 0.1, 600);
    const camR = new THREE.PerspectiveCamera(75, 1, 0.1, 600);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // --- ILUMINAÇÃO LUNAR DE ALTO CONTRASTE COM SOMBRAS ---
    const sunLight = new THREE.DirectionalLight(0xfff6e5, 3.0);
    sunLight.position.set(-42, 22, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 110;
    const d = 34;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0008;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x5b8cff, 0x1a1d26, 0.48);
    scene.add(hemiLight);

    // --- CÉU ESTRELADO E PLANETA TERRA COM ATMOSFERA ---
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2400;
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.98);
      const r = 340;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const b = 0.5 + Math.random() * 0.5;
      starCol[i * 3] = b;
      starCol[i * 3 + 1] = b * (0.92 + Math.random() * 0.08);
      starCol[i * 3 + 2] = 1.0;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, fog: false })));

    const earthGroup = new THREE.Group();
    earthGroup.position.set(-95, 68, -210);
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(15, 32, 32),
      new THREE.MeshStandardMaterial({ map: S.createEarthTexture(), roughness: 0.65, metalness: 0.05 })
    );
    const atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(16.2, 32, 32), S.createAtmosphereMaterial());
    earthGroup.add(earthMesh, atmoMesh);
    scene.add(earthGroup);

    // --- TERRENO LUNAR COM CRATERAS E MONTANHAS ---
    const { map: regMap, bumpMap: regBump } = S.createLunarRegolithTextures();
    const groundGeo = new THREE.PlaneGeometry(240, 240, 140, 140);
    groundGeo.rotateX(-Math.PI / 2);
    const posAttr = groundGeo.attributes.position;

    const craters = [];
    for (let i = 0; i < 28; i++) {
      const ang = (i / 28) * Math.PI * 2 + (i % 3) * 0.4;
      const dist = 26 + (i * 17) % 75;
      craters.push({ x: Math.cos(ang) * dist, z: Math.sin(ang) * dist, r: 4 + (i % 9) * 1.3 });
    }

    const getTerrainHeight = (x, z) => {
      const dist = Math.hypot(x, z);
      const flatBase = Math.min(1, Math.max(0, (dist - 18) / 38));
      let h = (S.fbm(x * 0.028, z * 0.028, 4) - 0.5) * 12 * flatBase;
      h += (S.fbm(x * 0.14, z * 0.14, 2) - 0.5) * 0.8 * flatBase;
      if (dist > 75) h += Math.pow((dist - 75) / 45, 1.8) * 24;

      for (const c of craters) {
        const dRatio = Math.hypot(x - c.x, z - c.z) / c.r;
        if (dRatio < 1.45) {
          if (dRatio < 1.0) h -= (1 - dRatio * dRatio) * c.r * 0.25;
          h += Math.exp(-Math.pow((dRatio - 1.05) / 0.2, 2)) * c.r * 0.08;
        }
      }
      return h;
    };

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i), z = posAttr.getZ(i);
      posAttr.setY(i, getTerrainHeight(x, z));
    }
    groundGeo.computeVertexNormals();

    const groundMesh = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ map: regMap, bumpMap: regBump, bumpScale: 0.35, roughness: 0.92, metalness: 0.02 })
    );
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // --- ROCHAS LUNARES VIA INSTANCED MESH ---
    const rockCount = 220;
    const rockGeo = new THREE.DodecahedronGeometry(0.6, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7d828c, bumpMap: regBump, bumpScale: 0.2, roughness: 0.95, flatShading: true });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < rockCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 13 + Math.random() * 68;
      const rx = Math.cos(a) * r, rz = Math.sin(a) * r;
      const ry = getTerrainHeight(rx, rz);
      const sc = 0.25 + Math.pow(Math.random(), 2.4) * 1.8;
      dummy.position.set(rx, ry + sc * 0.2, rz);
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      dummy.scale.set(sc * 1.3, sc * 0.75, sc);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    scene.add(rocks);

    // --- MATERIAIS DA BASE LUNAR ---
    const kaptonMat = new THREE.MeshStandardMaterial({ map: S.createKaptonGoldTexture(), metalness: 0.88, roughness: 0.22 });
    const hullWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f4fa, metalness: 0.25, roughness: 0.35 });
    const darkFrameMat = new THREE.MeshStandardMaterial({ color: 0x222938, metalness: 0.75, roughness: 0.3 });
    const solarMat = new THREE.MeshStandardMaterial({ map: S.createSolarPanelTexture(), metalness: 0.65, roughness: 0.18, emissive: 0x061942, emissiveIntensity: 0.35 });

    // Plataforma Central de Aterragem
    const padGroup = new THREE.Group();
    const padBase = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.12, 32), darkFrameMat);
    padBase.receiveShadow = true;
    const padEmblem = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 32),
      new THREE.MeshStandardMaterial({ map: S.createMissionEmblemTexture(), roughness: 0.4, metalness: 0.2 })
    );
    padEmblem.rotation.x = -Math.PI / 2;
    padEmblem.position.y = 0.065;
    padEmblem.receiveShadow = true;
    const padRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.3, 0.07, 12, 48),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff })
    );
    padRing.rotation.x = Math.PI / 2;
    padRing.position.y = 0.08;
    padGroup.add(padBase, padEmblem, padRing);
    scene.add(padGroup);

    // Totem Frontal de Identidade da Missão
    const bannerGroup = new THREE.Group();
    bannerGroup.position.set(0, 0, -14.5);
    const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.4, 12), darkFrameMat);
    poleL.position.set(-2.1, 2.2, 0);
    const poleR = poleL.clone();
    poleR.position.set(2.1, 2.2, 0);
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(4.0, 2.3, 0.14),
      new THREE.MeshStandardMaterial({ map: S.createMissionEmblemTexture(), roughness: 0.3, metalness: 0.3 })
    );
    signBoard.position.set(0, 3.1, 0);
    signBoard.castShadow = true;
    bannerGroup.add(poleL, poleR, signBoard);
    scene.add(bannerGroup);

    // --- CÚPULA GEODÉSICA ILUMINADA COM PLANTAS WELWITSCHIA ---
    const domeGroup = new THREE.Group();
    domeGroup.position.set(8.5, 0, -7.5);
    const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.45, 24), hullWhiteMat);
    domeBase.position.y = 0.22;
    domeBase.castShadow = true;
    domeBase.receiveShadow = true;

    const glassDome = new THREE.Mesh(
      new THREE.SphereGeometry(3.3, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshPhysicalMaterial({
        color: 0xa8f5ff, transparent: true, opacity: 0.32,
        roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide
      })
    );
    glassDome.position.y = 0.4;

    const domeWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.33, 1),
      new THREE.MeshBasicMaterial({ color: 0x5ce1e6, wireframe: true, transparent: true, opacity: 0.45 })
    );
    domeWire.position.y = 0.4;

    const growLight = new THREE.PointLight(0xff4dff, 2.2, 12);
    growLight.position.set(0, 2.4, 0);
    domeGroup.add(domeBase, glassDome, domeWire, growLight);

    const welwitschiaLeaves = [];
    [-1.1, 0, 1.1].forEach((ox, idx) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(ox, 0.45, (idx % 2 === 0 ? 0.5 : -0.5));
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.25, 12), new THREE.MeshStandardMaterial({ color: 0x6b4e31, roughness: 0.9 }));
      pGroup.add(trunk);

      for (let f = 0; f < 4; f++) {
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(1.45, 0.03, 0.22),
          new THREE.MeshStandardMaterial({ color: f % 2 === 0 ? 0x52d649 : 0x7be843, emissive: 0x164212, roughness: 0.6 })
        );
        leaf.rotation.y = (f * Math.PI) / 2 + 0.3;
        leaf.position.y = 0.16;
        pGroup.add(leaf);
        welwitschiaLeaves.push({ mesh: leaf, phase: f + idx });
      }
      domeGroup.add(pGroup);
    });
    scene.add(domeGroup);

    // --- PAINÉIS SOLARES INTERATIVOS ---
    const interactables = [];
    const solarPanels = [];
    for (let i = 0; i < 4; i++) {
      const pGroup = new THREE.Group();
      pGroup.position.set(-11.5, 0, -6 + i * 4.2);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.5, 10), darkFrameMat);
      stand.position.y = 0.75;
      stand.castShadow = true;

      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 3.4), solarMat.clone());
      panel.position.y = 1.85;
      panel.rotation.z = -0.45;
      panel.castShadow = true;
      panel.userData = { type: 'solar', index: i };

      pGroup.add(stand, panel);
      scene.add(pGroup);
      solarPanels.push(panel);
      interactables.push(panel);
    }

    // --- OS 4 MÓDULOS DA BASE COM ECRÃS HOLOGRÁFICOS ---
    const MODULE_DEFS = [
      { name: 'Suporte de Vida', color: '#00e5ff', hex: 0x00e5ff },
      { name: 'Blindagem Solar', color: '#ff9e2c', hex: 0xff9e2c },
      { name: 'Estufas', color: '#5ce65c', hex: 0x5ce65c },
      { name: 'Laboratório', color: '#c77dff', hex: 0xc77dff }
    ];

    const moduleScreens = [];
    const modulePositions = [];

    MODULE_DEFS.forEach((mod, i) => {
      const deg = -68 + i * 45;
      const rad = (deg * Math.PI) / 180;
      const dist = 8.2;
      const mx = Math.sin(rad) * dist;
      const mz = -Math.cos(rad) * dist;
      modulePositions.push(new THREE.Vector3(mx, 0, mz));

      const mGroup = new THREE.Group();
      mGroup.position.set(mx, 0, mz);
      mGroup.rotation.y = -rad;

      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.65, 20), kaptonMat);
      base.position.y = 0.325;
      base.castShadow = true;
      base.receiveShadow = true;

      const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.55), hullWhiteMat);
      consoleBox.position.set(0, 1.05, 0);
      consoleBox.castShadow = true;

      const holoData = S.createHoloScreenCanvas(mod.name, mod.color);
      const holoPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.1, 1.32),
        new THREE.MeshBasicMaterial({ map: holoData.texture, transparent: true, side: THREE.DoubleSide })
      );
      holoPlane.position.set(0, 2.15, 0.15);
      holoPlane.userData = { type: 'module', index: i };

      const modLight = new THREE.PointLight(mod.hex, 1.1, 7);
      modLight.position.set(0, 2.2, 0.6);

      mGroup.add(base, consoleBox, holoPlane, modLight);
      scene.add(mGroup);

      moduleScreens.push(holoData);
      interactables.push(holoPlane);
    });

    // --- ROVER LUNAR AUTÓNOMO ---
    const roverGroup = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.42, 1.9), kaptonMat);
    chassis.position.y = 0.65;
    chassis.castShadow = true;

    const topDeck = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.12, 1.75), hullWhiteMat);
    topDeck.position.y = 0.92;
    topDeck.castShadow = true;

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.85, 10), darkFrameMat);
    mast.position.set(0, 1.35, 0.55);
    const camHead = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.26), hullWhiteMat);
    camHead.position.set(0, 1.78, 0.58);

    const sensorEye = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    sensorEye.position.set(0, 1.78, 0.71);

    const roverSpot = new THREE.SpotLight(0xdff4ff, 3.5, 24, 0.55, 0.4);
    roverSpot.position.set(0, 1.1, 0.95);
    roverSpot.target.position.set(0, 0.2, 7);
    roverGroup.add(roverSpot, roverSpot.target);

    const wheels = [];
    [[-0.78, 0.72], [0.78, 0.72], [-0.78, -0.72], [0.78, -0.72]].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 16), darkFrameMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.34, wz);
      wheel.castShadow = true;
      roverGroup.add(wheel);
      wheels.push(wheel);
    });

    roverGroup.add(chassis, topDeck, mast, camHead, sensorEye);
    scene.add(roverGroup);

    // --- ASTRONAUTAS ANIMADOS ---
    const astronauts = [];
    const visorMat = new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.96, roughness: 0.08, emissive: 0x3b2300, emissiveIntensity: 0.4 });
    [[-4.2, -5.2, 0.6], [4.5, -5.8, -0.7]].forEach(([ax, az, rotY], idx) => {
      const aGroup = new THREE.Group();
      aGroup.position.set(ax, 0, az);
      aGroup.rotation.y = rotY;

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.32), hullWhiteMat);
      torso.position.y = 1.05;
      torso.castShadow = true;

      const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.58, 0.22), kaptonMat);
      backpack.position.set(0, 1.08, -0.25);

      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), hullWhiteMat);
      helmet.position.y = 1.58;
      helmet.castShadow = true;

      const visor = new THREE.Mesh(new THREE.SphereGeometry(0.20, 16, 12, 0, Math.PI), visorMat);
      visor.position.set(0, 1.58, 0.07);

      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.18), hullWhiteMat);
      legL.position.set(-0.13, 0.36, 0);
      const legR = legL.clone();
      legR.position.set(0.13, 0.36, 0);

      aGroup.add(torso, backpack, helmet, visor, legL, legR);
      scene.add(aGroup);
      astronauts.push({ group: aGroup, phase: idx * 2.5 });
    });

    // --- BOTÕES 3D FLUTUANTES ---
    function make3DButton(label, bgHex, w = 1.8, h = 0.55) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 160;
      const g = c.getContext('2d');
      g.fillStyle = bgHex;
      g.fillRect(0, 0, 512, 160);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 8;
      g.strokeRect(6, 6, 500, 148);
      g.fillStyle = '#ffffff';
      g.font = 'bold 38px sans-serif';
      g.textAlign = 'center';
      g.fillText(label, 256, 95);

      return new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 0.12),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })
      );
    }

    const startBtn = make3DButton('INICIAR MISSÃO', '#18a84c', 2.2, 0.65);
    startBtn.position.set(0, 1.55, -3.2);
    startBtn.userData = { type: 'start' };
    scene.add(startBtn);
    interactables.push(startBtn);

    const restartBtn = make3DButton('JOGAR DE NOVO', '#2a5cff', 2.1, 0.62);
    restartBtn.position.set(0, -50, 0);
    restartBtn.visible = false;
    restartBtn.userData = { type: 'restart' };
    scene.add(restartBtn);
    interactables.push(restartBtn);

    const leakBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a })
    );
    leakBeacon.position.set(0, -50, 0);
    leakBeacon.visible = false;
    leakBeacon.userData = { type: 'leak' };
    scene.add(leakBeacon);
    interactables.push(leakBeacon);

    // --- HUD ESPACIAL NO ESPAÇO 3D (A -3.0m PARA CONVERGÊNCIA ESTEREOSCÓPICA CONFORTÁVEL) ---
    const hudCanvas = document.createElement('canvas');
    hudCanvas.width = 1024; hudCanvas.height = 512;
    const hudCtx = hudCanvas.getContext('2d');
    const hudTex = new THREE.CanvasTexture(hudCanvas);

    // Colocamos o HUD na cena a 3.0m de distância na direção do olhar (com profundidade 3D real!)
    const hudGroup = new THREE.Group();
    scene.add(hudGroup);

    const hudPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.3),
      new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false })
    );
    hudPlane.position.set(0, 0, -3.0);
    hudPlane.raycast = () => {};
    hudGroup.add(hudPlane);

    const reticleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.024, 0.042, 32),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, depthTest: false })
    );
    reticleRing.position.set(0, 0, -2.8);
    reticleRing.raycast = () => {};
    hudGroup.add(reticleRing);

    function drawWrappedText(ctx, text, centerX, startY, maxWidth, lineHeight) {
      const paragraphs = String(text).split('\n');
      const allLines = [];

      paragraphs.forEach(p => {
        const words = p.split(' ');
        let currentLine = '';
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            allLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        if (currentLine) allLines.push(currentLine);
      });

      allLines.forEach((line, i) => {
        ctx.fillText(line, centerX, startY + i * lineHeight);
      });
      return allLines.length;
    }

    function updateHUD(state) {
      const g = hudCtx;
      g.clearRect(0, 0, 1024, 512);

      if (state.started && !state.over) {
        const boxX = 152, boxW = 720;
        g.fillStyle = 'rgba(5, 14, 36, 0.80)';
        g.fillRect(boxX, 14, boxW, 82);
        g.strokeStyle = state.alertFlash ? '#ff3b3b' : 'rgba(0, 229, 255, 0.65)';
        g.lineWidth = 3;
        g.strokeRect(boxX, 14, boxW, 82);

        g.fillStyle = '#ffffff';
        g.font = 'bold 20px sans-serif';
        g.textAlign = 'center';
        const cycleLabel = state.isDay ? '☀️ DIA' : '🌑 NOITE';
        g.fillText(
          `${cycleLabel} ${state.cyclePct}%  •  ⚡ BAT ${state.bat}%  •  💨 O₂ ${state.o2}%  •  🌱 COMIDA ${state.food}%`,
          512, 46
        );
        g.fillStyle = '#ffd27a';
        g.fillText(
          `🌡️ BASE ${state.ti}°C (FORA ${state.te}°C)  •  🛡️ ESCUDO ${state.integ}%  •  🔬 CIÊNCIA ${state.sci}/60`,
          512, 78
        );
      }

      if (state.note) {
        const boxX = 152, boxW = 720, boxY = 384, boxH = 112;
        g.fillStyle = state.alertFlash ? 'rgba(145, 15, 25, 0.92)' : 'rgba(5, 14, 36, 0.88)';
        g.fillRect(boxX, boxY, boxW, boxH);
        g.strokeStyle = state.alertFlash ? '#ff6b6b' : '#ffd27a';
        g.lineWidth = 3;
        g.strokeRect(boxX, boxY, boxW, boxH);

        g.fillStyle = '#fff8dc';
        g.font = 'bold 21px sans-serif';
        g.textAlign = 'center';
        drawWrappedText(g, state.note, 512, boxY + 34, boxW - 48, 28);
      }
      hudTex.needsUpdate = true;
    }

    // --- CÁLCULO ESTEREOSCÓPICO REAL (OFF-AXIS FRUSTUM PARA OLHO ESQUERDO E DIREITO) ---
    let stereoMode = false;
    const EYE_SEP = 0.068; // 6.8 cm de separação entre olhos para efeito 3D bem visível
    const FOCAL_DIST = 4.5; // Plano de convergência onde os olhos se cruzam naturalmente

    function updateStereoCameras(eyeAspect) {
      camera.updateMatrixWorld(true);

      const halfEye = EYE_SEP * 0.5;
      const near = camera.near;
      const far = camera.far;
      const top = near * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      const bottom = -top;
      const a = eyeAspect * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * FOCAL_DIST;

      // Posição e orientação base da cabeça
      const headPos = camera.position;
      const headQuat = camera.quaternion;
      const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(headQuat);

      // OLHO ESQUERDO: deslocado -halfEye para a esquerda + frustum assimétrico
      camL.position.copy(headPos).addScaledVector(rightVec, -halfEye);
      camL.quaternion.copy(headQuat);
      const bL = a - halfEye;
      const cL = a + halfEye;
      camL.projectionMatrix.makePerspective((-bL * near) / FOCAL_DIST, (cL * near) / FOCAL_DIST, top, bottom, near, far);
      camL.projectionMatrixInverse.copy(camL.projectionMatrix).invert();

      // OLHO DIREITO: deslocado +halfEye para a direita + frustum assimétrico
      camR.position.copy(headPos).addScaledVector(rightVec, halfEye);
      camR.quaternion.copy(headQuat);
      const bR = a + halfEye;
      const cR = a - halfEye;
      camR.projectionMatrix.makePerspective((-bR * near) / FOCAL_DIST, (cR * near) / FOCAL_DIST, top, bottom, near, far);
      camR.projectionMatrixInverse.copy(camR.projectionMatrix).invert();
    }

    function syncRendererSize() {
      let w = window.innerWidth;
      let h = window.innerHeight;

      if (stereoMode && h > w) {
        container.classList.add('force-landscape');
        [w, h] = [h, w];
      } else {
        container.classList.remove('force-landscape');
      }

      camera.aspect = stereoMode ? (w / 2) / h : w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
    }

    function renderFrame() {
      // Faz o HUD acompanhar suavemente a cabeça no espaço 3D (com paralaxe estereoscópica real!)
      hudGroup.position.copy(camera.position);
      hudGroup.quaternion.copy(camera.quaternion);

      const size = renderer.getSize(new THREE.Vector2());
      const w = size.x, h = size.y;

      if (!stereoMode) {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        renderer.render(scene, camera);
      } else {
        const eyeW = Math.floor(w / 2);
        const eyeAspect = eyeW / h;
        updateStereoCameras(eyeAspect);

        renderer.setScissorTest(true);

        // Metade Esquerda -> Olho Esquerdo (vê mais o lado esquerdo dos objetos)
        renderer.setScissor(0, 0, eyeW, h);
        renderer.setViewport(0, 0, eyeW, h);
        renderer.render(scene, camL);

        // Metade Direita -> Olho Direito (vê mais o lado direito dos objetos)
        renderer.setScissor(eyeW, 0, w - eyeW, h);
        renderer.setViewport(eyeW, 0, w - eyeW, h);
        renderer.render(scene, camR);
      }
    }

    function updateAnimations(elapsed, sunAngle) {
      const sn = Math.sin(sunAngle);
      sunLight.position.set(-45 * Math.cos(sunAngle), Math.max(sn * 32, -4), 18);
      sunLight.intensity = 3.0 * Math.max(0, Math.min(1, sn * 3.5)) + 0.05;
      hemiLight.intensity = 0.16 + 0.36 * Math.max(0, Math.min(1, (sn + 0.15) * 2.5));

      earthMesh.rotation.y = elapsed * 0.03;

      const rAngle = elapsed * 0.14;
      const rDist = 16.5;
      const rx = Math.cos(rAngle) * rDist;
      const rz = Math.sin(rAngle) * rDist;
      const ry = getTerrainHeight(rx, rz);
      roverGroup.position.set(rx, ry, rz);
      roverGroup.rotation.y = -rAngle;
      wheels.forEach(w => { w.rotation.x += 0.04; });

      astronauts.forEach(a => {
        a.group.position.y = Math.abs(Math.sin(elapsed * 1.4 + a.phase)) * 0.14;
      });

      welwitschiaLeaves.forEach(l => {
        l.mesh.rotation.z = Math.sin(elapsed * 1.8 + l.phase) * 0.06;
      });

      if (leakBeacon.visible) {
        const sc = 1 + Math.sin(elapsed * 9) * 0.35;
        leakBeacon.scale.set(sc, sc, sc);
      }
    }

    window.addEventListener('resize', syncRendererSize);
    window.addEventListener('orientationchange', () => setTimeout(syncRendererSize, 120));

    return {
      scene,
      camera,
      interactables,
      moduleScreens,
      modulePositions,
      solarPanels,
      startBtn,
      restartBtn,
      leakBeacon,
      reticleRing,
      updateHUD,
      updateAnimations,
      renderFrame,
      isForcedLandscape: () => container.classList.contains('force-landscape'),
      setStereoMode: (v) => {
        stereoMode = v;
        syncRendererSize();
      }
    };
  }

  return { initScene };
})();
