/**
 * ============================================================================
 *  WELWITSCHIA LUNAR — vr-base.js
 *  Módulo da Base Lunar, Terminais e Calibração WebVR (Código do Edgar)
 *  - Cúpula geodésica panorâmica com vidros duplos de observação
 *  - Estufa hidropónica com plantas perenes Welwitschia mirabilis animadas
 *  - Consolas interativas dos 4 módulos de suporte de vida
 *  - Painéis solares verticais e balizas de navegação
 *  - Calibração matemática de Head-Tracking (Giroscópio / Quaternions)
 *  - REMOÇÃO TOTAL DE OUTROS ASTRONAUTAS (Jogador em 1ª pessoa único)
 * ============================================================================
 */
window.WelwitschiaBase = (() => {
  const S = window.WelwitschiaShaders;

  function createBase(scene, camera) {
    const interactables = [];

    // 1. MATERIAIS DE ENGENHARIA DA BASE LUNAR
    const kaptonMat = new THREE.MeshStandardMaterial({
      map: S.createKaptonGoldTexture(),
      metalness: 0.92,
      roughness: 0.22
    });

    const hullWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf2f6fc,
      metalness: 0.28,
      roughness: 0.32
    });

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x5a6575,
      metalness: 0.88,
      roughness: 0.26
    });

    const darkFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1b2029,
      metalness: 0.82,
      roughness: 0.38
    });

    const solarMat = new THREE.MeshStandardMaterial({
      map: S.createSolarPanelTexture(),
      metalness: 0.75,
      roughness: 0.16,
      emissive: 0x071e4d,
      emissiveIntensity: 0.42
    });

    // 2. PLATAFORMA SINTERIZADA CENTRAL
    const padGroup = new THREE.Group();
    const padBase = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, 0.16, 36), darkFrameMat);
    padBase.receiveShadow = true;

    const padEmblem = new THREE.Mesh(
      new THREE.CircleGeometry(3.1, 36),
      new THREE.MeshStandardMaterial({ map: S.createMissionEmblemTexture(), roughness: 0.35, metalness: 0.22 })
    );
    padEmblem.rotation.x = -Math.PI / 2;
    padEmblem.position.y = 0.085;
    padEmblem.receiveShadow = true;

    const padRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.65, 0.08, 12, 48),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    padRing.rotation.x = Math.PI / 2;
    padRing.position.y = 0.09;

    padGroup.add(padBase, padEmblem, padRing);

    // Balizas LED de aproximação
    for (let i = 0; i < 8; i++) {
      const bAng = (i / 8) * Math.PI * 2;
      const bx = Math.cos(bAng) * 4.6;
      const bz = Math.sin(bAng) * 4.6;
      const beaconPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.45, 8), titaniumMat);
      beaconPost.position.set(bx, 0.22, bz);
      const beaconLed = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      beaconLed.position.set(bx, 0.46, bz);
      padGroup.add(beaconPost, beaconLed);
    }
    scene.add(padGroup);

    // Totem Frontal com Emblema da Welwitschia 2032
    const bannerGroup = new THREE.Group();
    bannerGroup.position.set(0, 0, -14.8);
    const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.6, 12), titaniumMat);
    poleL.position.set(-2.2, 2.3, 0);
    const poleR = poleL.clone();
    poleR.position.set(2.2, 2.3, 0);
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 2.4, 0.16),
      new THREE.MeshStandardMaterial({ map: S.createWelwitschiaEmblemTexture(), roughness: 0.28, metalness: 0.35 })
    );
    signBoard.position.set(0, 3.2, 0);
    signBoard.castShadow = true;
    bannerGroup.add(poleL, poleR, signBoard);
    scene.add(bannerGroup);

    // 3. CÚPULA GEODÉSICA BIOMÓRFICA COM VIDROS PANORÂMICOS
    const domeGroup = new THREE.Group();
    domeGroup.position.set(8.8, 0, -7.8);

    const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.5, 28), hullWhiteMat);
    domeBase.position.y = 0.25;
    domeBase.castShadow = true;
    domeBase.receiveShadow = true;

    // Vidro duplo panorâmico que permite ver todo o exterior lunar
    const glassDome = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshPhysicalMaterial({
        color: 0xb8f7ff,
        transparent: true,
        opacity: 0.35,
        roughness: 0.06,
        metalness: 0.12,
        side: THREE.DoubleSide
      })
    );
    glassDome.position.y = 0.45;

    const domeTruss = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.54, 1),
      new THREE.MeshBasicMaterial({ color: 0x4fe3ff, wireframe: true, transparent: true, opacity: 0.45 })
    );
    domeTruss.position.y = 0.45;

    const growLight = new THREE.PointLight(0xff33cc, 2.4, 14);
    growLight.position.set(0, 2.6, 0);

    domeGroup.add(domeBase, glassDome, domeTruss, growLight);

    // Plantas perenes Welwitschia mirabilis animadas
    const welwitschiaLeaves = [];
    [-1.2, 0, 1.2].forEach((ox, idx) => {
      const plantGroup = new THREE.Group();
      plantGroup.position.set(ox, 0.48, (idx % 2 === 0 ? 0.6 : -0.6));

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.36, 0.28, 12),
        new THREE.MeshStandardMaterial({ color: 0x5a3f24, roughness: 0.92 })
      );
      plantGroup.add(stem);

      for (let f = 0; f < 4; f++) {
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(1.55, 0.035, 0.24),
          new THREE.MeshStandardMaterial({
            color: f % 2 === 0 ? 0x48c73e : 0x72e03a,
            emissive: 0x144010,
            roughness: 0.55
          })
        );
        leaf.rotation.y = (f * Math.PI) / 2 + 0.32;
        leaf.position.y = 0.18;
        plantGroup.add(leaf);
        welwitschiaLeaves.push({ mesh: leaf, phase: f + idx });
      }
      domeGroup.add(plantGroup);
    });
    scene.add(domeGroup);

    // Antena Parabólica de Alto Ganho apontada para a Terra
    const dishGroup = new THREE.Group();
    dishGroup.position.set(-8.8, 0, -8.2);
    const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.8, 12), titaniumMat);
    dishMast.position.y = 1.4;
    dishMast.castShadow = true;

    const dishBowl = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.45),
      kaptonMat
    );
    dishBowl.position.set(0, 2.9, 0);
    dishBowl.rotation.x = 0.95;
    dishBowl.rotation.y = -0.4;
    dishBowl.castShadow = true;

    dishGroup.add(dishMast, dishBowl);
    scene.add(dishGroup);

    // 4. PONTOS DE DESLOCAÇÃO (WAYPOINTS) — INTERIOR & EXTERIOR LUNAR
    const waypoints = [
      { x: 0, z: 0, label: 'Centro da Base' },
      { x: -3.5, z: -4.2, label: 'Consolas Principais' },
      { x: 4.5, z: -5.2, label: 'Estufa Welwitschia' },
      { x: -7.5, z: -1.5, label: 'Painéis Solares (Exterior)' },
      { x: 0, z: 14.5, label: 'Miradouro Exterior Lunar' }
    ];

    waypoints.forEach(wp => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.48, 0.72, 32),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.82 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(wp.x, 0.08, wp.z);
      ring.userData = { type: 'move', x: wp.x, z: wp.z, label: wp.label };
      scene.add(ring);
      interactables.push(ring);
    });

    // 5. PAINÉIS SOLARES VERTICAIS INTERATIVOS
    const solarPanels = [];
    for (let i = 0; i < 4; i++) {
      const pGroup = new THREE.Group();
      pGroup.position.set(-11.8, 0, -6.5 + i * 4.4);

      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.8, 12), titaniumMat);
      stand.position.y = 0.9;
      stand.castShadow = true;

      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 3.6), solarMat.clone());
      panel.position.y = 2.1;
      panel.rotation.z = -0.45;
      panel.castShadow = true;
      panel.userData = { type: 'solar', index: i };

      pGroup.add(stand, panel);
      scene.add(pGroup);
      solarPanels.push(panel);
      interactables.push(panel);
    }

    // 6. OS 4 MÓDULOS DA BASE COM ECRÃS HOLOGRÁFICOS INTERATIVOS
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
      const dist = 8.4;
      const mx = Math.sin(rad) * dist;
      const mz = -Math.cos(rad) * dist;
      modulePositions.push(new THREE.Vector3(mx, 0, mz));

      const mGroup = new THREE.Group();
      mGroup.position.set(mx, 0, mz);
      mGroup.rotation.y = -rad;

      const mBase = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.7, 24), kaptonMat);
      mBase.position.y = 0.35;
      mBase.castShadow = true;
      mBase.receiveShadow = true;

      const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.6), hullWhiteMat);
      consoleBox.position.set(0, 1.1, 0);
      consoleBox.castShadow = true;

      const holoData = S.createHoloScreenCanvas(mod.name, mod.color);
      const holoPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 1.38),
        new THREE.MeshBasicMaterial({ map: holoData.texture, transparent: true, side: THREE.DoubleSide })
      );
      holoPlane.position.set(0, 2.25, 0.16);
      holoPlane.userData = { type: 'module', index: i };

      const modLight = new THREE.PointLight(mod.hex, 1.2, 7.5);
      modLight.position.set(0, 2.3, 0.65);

      mGroup.add(mBase, consoleBox, holoPlane, modLight);
      scene.add(mGroup);

      moduleScreens.push(holoData);
      interactables.push(holoPlane);
    });

    // 7. BOTÕES 3D FLUTUANTES (INICIAR MISSÃO / JOGAR DE NOVO / BALIZA DE FUGA)
    function make3DButton(label, bgHex, w = 2.3, h = 0.68) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 160;
      const g = c.getContext('2d');
      g.fillStyle = bgHex;
      g.fillRect(0, 0, 512, 160);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 8;
      g.strokeRect(6, 6, 500, 148);
      g.fillStyle = '#ffffff';
      g.font = 'bold 36px sans-serif';
      g.textAlign = 'center';
      g.fillText(label, 256, 96);

      const tex = new THREE.CanvasTexture(c);
      return new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 0.12),
        new THREE.MeshBasicMaterial({ map: tex })
      );
    }

    const startBtn = make3DButton('INICIAR MISSÃO', '#18a84c', 2.3, 0.68);
    startBtn.position.set(0, 1.55, -3.2);
    startBtn.userData = { type: 'start' };
    scene.add(startBtn);
    interactables.push(startBtn);

    const restartBtn = make3DButton('JOGAR DE NOVO', '#2a5cff', 2.2, 0.65);
    restartBtn.position.set(0, -50, 0);
    restartBtn.visible = false;
    restartBtn.userData = { type: 'restart' };
    scene.add(restartBtn);
    interactables.push(restartBtn);

    const leakBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a })
    );
    leakBeacon.position.set(0, -50, 0);
    leakBeacon.visible = false;
    leakBeacon.userData = { type: 'leak' };
    scene.add(leakBeacon);
    interactables.push(leakBeacon);

    // Retículo / Mira Central VR
    const reticleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.015, 0.028, 32),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, depthTest: false })
    );
    reticleRing.position.z = -1.5;
    reticleRing.raycast = () => {};
    camera.add(reticleRing);

    // 8. CALIBRAÇÃO MATEMÁTICA DE HEAD-TRACKING WEBVR (CÓDIGO DO EDGAR)
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° no eixo X
    const targetQuat = new THREE.Quaternion();

    function calculateVRQuaternion(alphaDeg, betaDeg, gammaDeg, orientDeg) {
      const alpha = THREE.MathUtils.degToRad(alphaDeg);
      const beta = THREE.MathUtils.degToRad(betaDeg);
      const gamma = THREE.MathUtils.degToRad(gammaDeg);
      const orient = THREE.MathUtils.degToRad(orientDeg);

      euler.set(beta, alpha, -gamma, 'YXZ');
      q0.setFromEuler(euler);
      q0.multiply(q1);
      q0.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -orient));
      targetQuat.copy(q0);
      return targetQuat;
    }

    function calculateManualQuaternion(pitch, yaw) {
      euler.set(pitch, yaw, 0, 'YXZ');
      targetQuat.setFromEuler(euler);
      return targetQuat;
    }

    // Atualização de animações internas da base
    function updateBase(elapsed) {
      welwitschiaLeaves.forEach(l => {
        l.mesh.rotation.z = Math.sin(elapsed * 1.8 + l.phase) * 0.06;
      });

      if (leakBeacon.visible) {
        const sc = 1 + Math.sin(elapsed * 9) * 0.35;
        leakBeacon.scale.set(sc, sc, sc);
      }
    }

    return {
      interactables,
      moduleScreens,
      modulePositions,
      solarPanels,
      startBtn,
      restartBtn,
      leakBeacon,
      reticleRing,
      calculateVRQuaternion,
      calculateManualQuaternion,
      updateBase
    };
  }

  return { createBase };
})();
