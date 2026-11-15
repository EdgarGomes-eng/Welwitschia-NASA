// scene.js — Cenário Lunar 3D Fotorrealista do Polo Sul da Lua (Programa Artemis / Welwitschia 2032)
// Otimizado para Web Mobile VR, Giroscópio 360° e 60 FPS com Sombras Nítidas e Física Visual PBR
window.WelwitschiaScene = (() => {
  const S = window.WelwitschiaShaders;

  function initScene(container, stage) {
    // 1. CENA & VÁCUO ESPACIAL ABSOLUTO (Sem atmosfera, fundo negro profundo)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // 2. CÂMERA DE PERSPECTIVA
    const camera = new THREE.PerspectiveCamera(82, window.innerWidth / window.innerHeight, 0.1, 700);
    camera.position.set(0, 1.65, 0);
    scene.add(camera);

    // 3. RENDERIZADOR WEBGL DE ALTA PERFORMANCE COM FILMIC TONE MAPPING
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

    // 4. ILUMINAÇÃO ASTRONÓMICA DO POLO SUL LUNAR (Sol rasante a 5°-8° com sombras longas e nítidas)
    const sunLight = new THREE.DirectionalLight(0xfffaee, 3.2);
    sunLight.position.set(-48, 14, 22);
    sunLight.castShadow = true;

    // Resolução e frustum de sombra calibrados
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 4;
    sunLight.shadow.camera.far = 160;

    const sf = 38;
    sunLight.shadow.camera.left = -sf;
    sunLight.shadow.camera.right = sf;
    sunLight.shadow.camera.top = sf;
    sunLight.shadow.camera.bottom = -sf;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    // Luz de ricochete do regolito lunar (vácuo não tem luz de céu azul)
    const ambientLight = new THREE.AmbientLight(0x0a0d16, 0.14);
    scene.add(ambientLight);

    // Luz secundária hemisférica (reflexo de terra e solo)
    const hemiLight = new THREE.HemisphereLight(0x406090, 0x151820, 0.38);
    scene.add(hemiLight);

    // 5. CAMPO DE 3.500 ESTRELAS CIENTÍFICAS SEM CINTILAÇÃO (BufferGeometry Points)
    const starCount = 3500;
    const starRadius = 420;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);

    const cWhite = new THREE.Color(0xffffff);
    const cBlueWhite = new THREE.Color(0xd0e2ff); // Estrelas quentes Classe O/B
    const cPaleYellow = new THREE.Color(0xfff1cf); // Estrelas Classe G (como o Sol)
    const cWarmRed = new THREE.Color(0xffd4c0);   // Gigantes frias

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(Math.max(-0.95, Math.min(0.95, 2.0 * v - 1.0)));

      const r = starRadius + (Math.random() - 0.5) * 40;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 8; // Mantém estrelas no céu visível
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const rc = Math.random();
      let chosen = cWhite;
      if (rc < 0.28) chosen = cBlueWhite;
      else if (rc < 0.60) chosen = cWhite;
      else if (rc < 0.88) chosen = cPaleYellow;
      else chosen = cWarmRed;

      const mag = Math.pow(Math.random(), 1.6) * 0.75 + 0.25;
      starCol[i * 3] = chosen.r * mag;
      starCol[i * 3 + 1] = chosen.g * mag;
      starCol[i * 3 + 2] = chosen.b * mag;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));

    const starPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false })
    );
    scene.add(starPoints);

    // 6. PLANETA TERRA NA PERSPECTIVA LUNAR COM TERMINADOR SOLAR E HALO FRESNEL
    const earthGroup = new THREE.Group();
    earthGroup.position.set(-105, 52, -230); // ~8.5° no horizonte

    const earthRadius = 18.0;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 48, 48);
    const dayTex = S.createEarthDayTexture();
    const nightTex = S.createEarthNightTexture();

    const sunDir = new THREE.Vector3().subVectors(sunLight.position, earthGroup.position).normalize();

    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTex },
        nightTexture: { value: nightTex },
        sunDirection: { value: sunDir }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform vec3 sunDirection;
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vec3 n = normalize(vNormal);
          float NdotL = dot(n, normalize(sunDirection));
          float dayWeight = smoothstep(-0.12, 0.22, NdotL);
          vec4 dayColor = texture2D(dayTexture, vUv);
          vec4 nightColor = texture2D(nightTexture, vUv);
          vec3 finalCol = mix(nightColor.rgb * 0.95, dayColor.rgb * 1.3, dayWeight);
          gl_FragColor = vec4(finalCol, 1.0);
        }
      `
    });

    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.rotation.z = 0.41; // Inclinação axial da Terra (23.44°)
    earthMesh.rotation.y = 1.35;
    earthGroup.add(earthMesh);

    // Halo Atmosférico Rayleigh Azul
    const atmoMesh = new THREE.Mesh(
      new THREE.SphereGeometry(earthRadius * 1.035, 40, 40),
      S.createAtmosphereMaterial()
    );
    earthGroup.add(atmoMesh);
    scene.add(earthGroup);

    // 7. RELEVO LUNAR MULTI-CAMADAS COM CRATERAS PROCEDURAIS E PLATÔ DA BASE
    const terrainSize = 260;
    const terrainSegs = 150;
    const groundGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs);
    groundGeo.rotateX(-Math.PI / 2);
    const posAttr = groundGeo.attributes.position;

    // Definição das crateras principais ao redor da base
    const craters = [
      { x: -35, z: -42, r: 16, depth: 4.8 },
      { x: 42, z: -38, r: 21, depth: 5.5 },
      { x: 55, z: 48, r: 26, depth: 6.8 },
      { x: -52, z: 45, r: 19, depth: 5.2 },
      { x: -75, z: -10, r: 32, depth: 8.5 },
      { x: 18, z: 62, r: 14, depth: 3.8 }
    ];

    const getTerrainHeight = (x, z) => {
      const dist = Math.hypot(x, z);
      // Platô plano suave de 20m de raio para a Estação Welwitschia
      const baseBlend = Math.min(1, Math.max(0, (dist - 14) / 32));

      let h = (S.fbm(x * 0.024, z * 0.024, 4) - 0.5) * 11.5 * baseBlend;
      h += (S.simplex2D(x * 0.08, z * 0.08) * 0.6) * baseBlend;

      // Cordilheira distante na borda da cratera Shackleton
      if (dist > 78) {
        h += Math.pow((dist - 78) / 45, 1.8) * 22;
      }

      // Morfologia das crateras (depressão côncava e borda ejetada elevada)
      for (let i = 0; i < craters.length; i++) {
        const c = craters[i];
        const cd = Math.hypot(x - c.x, z - c.z);
        const ratio = cd / c.r;
        if (ratio < 1.45) {
          if (ratio < 1.0) {
            h -= (1.0 - ratio * ratio) * c.depth * baseBlend;
          }
          // Borda elevada
          h += Math.exp(-Math.pow((ratio - 1.04) / 0.18, 2)) * (c.depth * 0.32) * baseBlend;
        }
      }
      return h;
    };

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, getTerrainHeight(vx, vz));
    }
    groundGeo.computeVertexNormals();

    const { map: regMap, bumpMap: regBump, normalMap: regNorm, roughnessMap: regRough } = S.createLunarRegolithTextures();

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x484d53,
      map: regMap,
      bumpMap: regBump,
      bumpScale: 0.42,
      normalMap: regNorm,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: regRough,
      roughness: 0.92,
      metalness: 0.04
    });

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 8. DEPÓSITOS DE GELO DE ÁGUA LUNAR (H2O) NO FUNDO DAS CRATERAS SOMBREADAS
    const iceTexture = S.createIceDepositTexture();
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      map: iceTexture,
      roughness: 0.16,
      metalness: 0.35,
      emissive: 0x0f2b48,
      emissiveIntensity: 0.38,
      transparent: true,
      opacity: 0.90
    });

    craters.forEach(c => {
      const iceRadius = c.r * 0.42;
      const iceGeo = new THREE.CircleGeometry(iceRadius, 24);
      iceGeo.rotateX(-Math.PI / 2);
      const iceMesh = new THREE.Mesh(iceGeo, iceMat);
      const floorY = getTerrainHeight(c.x, c.z) + 0.12;
      iceMesh.position.set(c.x, floorY, c.z);
      iceMesh.receiveShadow = true;
      scene.add(iceMesh);
    });

    // 9. ROCHAS BASÁLTICAS FACETADAS COM PERTURBAÇÃO DE VÉRTICES (GEOLOGIA REAL)
    const rockCount = 260;
    const baseRockGeo = new THREE.IcosahedronGeometry(0.7, 1);
    const rPos = baseRockGeo.attributes.position;
    const rv = new THREE.Vector3();
    for (let i = 0; i < rPos.count; i++) {
      rv.fromBufferAttribute(rPos, i);
      const disp = 1.0 + S.simplex2D(rv.x * 2.8, rv.y * 2.8 + rv.z * 2.0) * 0.35;
      rv.multiplyScalar(disp);
      rPos.setXYZ(i, rv.x, rv.y, rv.z);
    }
    baseRockGeo.computeVertexNormals();

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x2e3238, // Basalto escuro lunar
      roughness: 0.94,
      metalness: 0.08,
      flatShading: true
    });

    const rocks = new THREE.InstancedMesh(baseRockGeo, rockMat, rockCount);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    const rockDummy = new THREE.Object3D();

    for (let i = 0; i < rockCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 14 + Math.pow(Math.random(), 0.72) * 92;
      const rx = Math.cos(ang) * dist;
      const rz = Math.sin(ang) * dist;
      const ry = getTerrainHeight(rx, rz);

      const sc = 0.28 + Math.pow(Math.random(), 2.2) * 2.4;
      rockDummy.position.set(rx, ry + sc * 0.35, rz);
      rockDummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rockDummy.scale.set(sc * 1.3, sc * 0.72, sc * 1.1);
      rockDummy.updateMatrix();
      rocks.setMatrixAt(i, rockDummy.matrix);
    }
    scene.add(rocks);

    // 10. MATERIAIS AVANÇADOS DA BASE LUNAR (MLI Kapton, Titânio e Compósitos)
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

    // Plataforma Sinterizada Central da Base
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
    scene.add(padGroup);

    // Faixas de pouso e balizas LED perimetrais
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

    // 11. CÚPULA GEODÉSICA BIOMÓRFICA COM ESTUFA WELWITSCHIA E LUZ DE CULTIVO
    const domeGroup = new THREE.Group();
    domeGroup.position.set(8.8, 0, -7.8);

    const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.5, 28), hullWhiteMat);
    domeBase.position.y = 0.25;
    domeBase.castShadow = true;
    domeBase.receiveShadow = true;

    // Cúpula de vidro duplo transparente com reflexo especular
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

    // Estrutura externa em treliça de titânio (Icosaedro)
    const domeTruss = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.54, 1),
      new THREE.MeshBasicMaterial({ color: 0x4fe3ff, wireframe: true, transparent: true, opacity: 0.45 })
    );
    domeTruss.position.y = 0.45;

    // Luz de cultivo biológico (magenta bio-growth)
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

    // 12. PONTOS DE DESLOCAÇÃO (WAYPOINTS)
    const interactables = [];
    const waypoints = [
      { x: 0, z: 0, label: 'Centro da Base' },
      { x: -3.5, z: -4.2, label: 'Consolas Principais' },
      { x: 4.5, z: -5.2, label: 'Estufa Welwitschia' },
      { x: -7.5, z: -1.5, label: 'Painéis Solares' }
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

    // 13. PAINÉIS SOLARES VERTICAIS INTERATIVOS
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

    // 14. OS 4 MÓDULOS DA BASE COM ECRÃS HOLOGRÁFICOS INTERATIVOS
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

      // Base com blindagem térmica MLI dourada
      const mBase = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.7, 24), kaptonMat);
      mBase.position.y = 0.35;
      mBase.castShadow = true;
      mBase.receiveShadow = true;

      // Consola mecânica de bordo
      const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.6), hullWhiteMat);
      consoleBox.position.set(0, 1.1, 0);
      consoleBox.castShadow = true;

      // Tela holográfica flutuante
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

    // 15. ROVER LUNAR TRIPULADO NASA ARTEMIS / LTV COM 6 RODAS ARTICULADAS
    const roverGroup = new THREE.Group();

    // Chassi estrutural em fibra de carbono
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.46, 2.4), darkFrameMat);
    chassis.position.y = 0.72;
    chassis.castShadow = true;

    // Carenagem MLI dourada
    const mliDeck = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.22, 2.2), kaptonMat);
    mliDeck.position.set(0, 0.98, 0);
    mliDeck.castShadow = true;

    // Mastro frontal Mastcam estereoscópico
    const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.95, 10), titaniumMat);
    mastPole.position.set(0, 1.45, 0.82);
    const mastHead = new THREE.Group();
    mastHead.position.set(0, 1.95, 0.85);

    const camBox = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.28), hullWhiteMat);
    const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 12), darkFrameMat);
    lensL.rotation.x = Math.PI / 2;
    lensL.position.set(-0.15, 0, 0.15);
    const lensR = lensL.clone();
    lensR.position.x = 0.15;
    const ledEye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.04), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    ledEye.position.set(0, 0.06, 0.15);
    mastHead.add(camBox, lensL, lensR, ledEye);

    // Faróis frontais de longo alcance com cone volumétrico
    const roverSpot = new THREE.SpotLight(0xf0f8ff, 4.2, 32, 0.65, 0.35);
    roverSpot.position.set(0, 1.15, 1.15);
    roverSpot.target.position.set(0, 0.2, 8.5);
    roverGroup.add(roverSpot, roverSpot.target);

    // 6 Rodas com banda de rodagem (treads/grousers)
    const wheels = [];
    const wheelPositions = [
      [-0.85, 0.85], [0.85, 0.85],   // Dianteiras
      [-0.88, 0.0],  [0.88, 0.0],    // Centrais
      [-0.85, -0.85], [0.85, -0.85]  // Traseiras
    ];

    wheelPositions.forEach(([wx, wz]) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wx, 0.38, wz);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18), darkFrameMat);
      rim.rotation.z = Math.PI / 2;
      rim.castShadow = true;

      // Aro de titânio
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.29, 12), titaniumMat);
      hub.rotation.z = Math.PI / 2;

      wheelGroup.add(rim, hub);
      roverGroup.add(wheelGroup);
      wheels.push(wheelGroup);
    });

    roverGroup.add(chassis, mliDeck, mastPole, mastHead);
    scene.add(roverGroup);

    // 16. ASTRONAUTAS TRIPULADOS COM FÍSICA LUNAR SUAVE (1/6 G)
    const astronauts = [];
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      metalness: 0.98,
      roughness: 0.04,
      emissive: 0x3d2400,
      emissiveIntensity: 0.45
    });

    [[-4.2, -5.2, 0.6], [4.5, -5.8, -0.7]].forEach(([ax, az, rotY], idx) => {
      const aGroup = new THREE.Group();
      aGroup.position.set(ax, 0, az);
      aGroup.rotation.y = rotY;

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.68, 0.34), hullWhiteMat);
      torso.position.y = 1.08;
      torso.castShadow = true;

      // Mochila de suporte de vida (PLSS)
      const plss = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.24), kaptonMat);
      plss.position.set(0, 1.1, -0.26);

      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 18), hullWhiteMat);
      helmet.position.y = 1.62;
      helmet.castShadow = true;

      const visor = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 14, 0, Math.PI), visorMat);
      visor.position.set(0, 1.62, 0.08);

      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.74, 0.2), hullWhiteMat);
      legL.position.set(-0.14, 0.37, 0);
      const legR = legL.clone();
      legR.position.set(0.14, 0.37, 0);

      aGroup.add(torso, plss, helmet, visor, legL, legR);
      scene.add(aGroup);
      astronauts.push({ group: aGroup, phase: idx * 2.8 });
    });

    // 17. BOTÕES 3D FLUTUANTES (INICIAR MISSÃO / JOGAR DE NOVO / BALIZA)
    function make3DButton(label, bgHex, w = 2.2, h = 0.65) {
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

    // 18. GESTÃO DE ORIENTAÇÃO MOBILE (RETRATO VS PAISAGEM VR)
    let vrLandscapeActive = false;

    function isDevicePortrait() {
      if (window.matchMedia) {
        return window.matchMedia('(orientation: portrait)').matches;
      }
      return window.innerHeight > window.innerWidth;
    }

    function syncStageOrientation() {
      let w = document.documentElement.clientWidth || window.innerWidth;
      let h = document.documentElement.clientHeight || window.innerHeight;

      if (vrLandscapeActive && isDevicePortrait()) {
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

    const targetCamPos = new THREE.Vector3(0, 1.65, 0);
    function moveTo(x, z) {
      targetCamPos.set(x, 1.65, z);
    }

    function renderFrame() {
      camera.position.lerp(targetCamPos, 0.06);
      renderer.render(scene, camera);
    }

    // 19. ATUALIZAÇÃO CONTÍNUA DE ANIMAÇÕES E FÍSICA VISUAL
    function updateAnimations(elapsed, sunAngle) {
      const sn = Math.sin(sunAngle);
      // Sol rasante orbital no Polo Sul
      sunLight.position.set(-48 * Math.cos(sunAngle), Math.max(sn * 28, -3), 20);
      sunLight.intensity = 3.2 * Math.max(0, Math.min(1, sn * 3.5)) + 0.05;
      hemiLight.intensity = 0.14 + 0.38 * Math.max(0, Math.min(1, (sn + 0.15) * 2.5));

      // Atualiza direção do sol no shader da Terra
      const sDir = new THREE.Vector3().subVectors(sunLight.position, earthGroup.position).normalize();
      if (earthMat.uniforms.sunDirection) {
        earthMat.uniforms.sunDirection.value.copy(sDir);
      }
      earthMesh.rotation.y = elapsed * 0.025;

      // Patrulha do Rover Lunar adaptado ao relevo do solo
      const rAngle = elapsed * 0.13;
      const rDist = 17.5;
      const rx = Math.cos(rAngle) * rDist;
      const rz = Math.sin(rAngle) * rDist;
      const ry = getTerrainHeight(rx, rz);
      roverGroup.position.set(rx, ry, rz);
      roverGroup.rotation.y = -rAngle + Math.PI / 2;

      // Rotação física das rodas com a velocidade
      wheels.forEach(w => {
        w.children.forEach(c => { c.rotation.x += 0.045; });
      });

      // Mastro da câmara faz varrimento exploratório suave
      mastHead.rotation.y = Math.sin(elapsed * 1.2) * 0.45;

      // Movimentação suave dos astronautas (salto rítmico em gravidade lunar)
      astronauts.forEach(a => {
        a.group.position.y = Math.abs(Math.sin(elapsed * 1.5 + a.phase)) * 0.16;
        a.group.rotation.x = Math.sin(elapsed * 1.5 + a.phase) * 0.05;
      });

      // Folhas da Welwitschia ondulando suavemente no ar da estufa
      welwitschiaLeaves.forEach(l => {
        l.mesh.rotation.z = Math.sin(elapsed * 1.8 + l.phase) * 0.06;
      });

      // Alarme de fuga piscando
      if (leakBeacon.visible) {
        const sc = 1 + Math.sin(elapsed * 9) * 0.35;
        leakBeacon.scale.set(sc, sc, sc);
      }
    }

    window.addEventListener('resize', syncStageOrientation);
    window.addEventListener('orientationchange', () => {
      setTimeout(syncStageOrientation, 80);
      setTimeout(syncStageOrientation, 300);
    });
    document.addEventListener('fullscreenchange', () => setTimeout(syncStageOrientation, 100));

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
      moveTo,
      updateAnimations,
      renderFrame,
      syncStageOrientation,
      isForcedLandscape: () => stage.classList.contains('force-landscape'),
      setVRLandscape: (enabled) => {
        vrLandscapeActive = enabled;
        syncStageOrientation();
      }
    };
  }

  return { initScene };
})();
