/**
 * ============================================================================
 *  WELWITSCHIA LUNAR — lunar-exterior.js
 *  Módulo de Gráficos Exteriores do Polo Sul Lunar (Código do Alberto)
 *  - Terreno PBR com crateras, regolito multi-camadas e depósitos de gelo
 *  - Iluminação polar rasante (5°-8°) de alto contraste com sombras longas
 *  - Campo estelar científico de 3.500 estrelas sem cintilação
 *  - Planeta Terra com terminador solar dinâmico e halo Fresnel
 *  - Rochas basálticas facetadas geradas com perturbação via ruído Simplex
 *  - Rover autónomo tripulado NASA Artemis / LTV com 6 rodas articuladas
 * ============================================================================
 */
window.WelwitschiaExterior = (() => {
  const S = window.WelwitschiaShaders;

  function createExterior(scene) {
    // 1. ILUMINAÇÃO ASTRONÓMICA DO POLO SUL LUNAR
    const sunLight = new THREE.DirectionalLight(0xfffaee, 3.2);
    sunLight.position.set(-48, 14, 22);
    sunLight.castShadow = true;

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

    // Luz de ricochete do regolito no vácuo
    const ambientLight = new THREE.AmbientLight(0x0a0d16, 0.14);
    scene.add(ambientLight);

    // Reflexo hemisférico suave
    const hemiLight = new THREE.HemisphereLight(0x406090, 0x151820, 0.38);
    scene.add(hemiLight);

    // 2. CAMPO ESTELAR COM 3.500 ESTRELAS CIENTÍFICAS FIXAS
    const starCount = 3500;
    const starRadius = 420;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);

    const cWhite = new THREE.Color(0xffffff);
    const cBlueWhite = new THREE.Color(0xd0e2ff);
    const cPaleYellow = new THREE.Color(0xfff1cf);
    const cWarmRed = new THREE.Color(0xffd4c0);

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(Math.max(-0.95, Math.min(0.95, 2.0 * v - 1.0)));

      const r = starRadius + (Math.random() - 0.5) * 40;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 8;
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

    // 3. PLANETA TERRA COM TERMINADOR SOLAR E HALO FRESNEL
    const earthGroup = new THREE.Group();
    earthGroup.position.set(-105, 52, -230); // ~8.5° de elevação no horizonte

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
    earthMesh.rotation.z = 0.41; // 23.44° de inclinação axial
    earthMesh.rotation.y = 1.35;
    earthGroup.add(earthMesh);

    const atmoMesh = new THREE.Mesh(
      new THREE.SphereGeometry(earthRadius * 1.035, 40, 40),
      S.createAtmosphereMaterial()
    );
    earthGroup.add(atmoMesh);
    scene.add(earthGroup);

    // 4. RELEVO LUNAR MULTI-CAMADAS COM CRATERAS PROCEDURAIS
    const terrainSize = 260;
    const terrainSegs = 150;
    const groundGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs);
    groundGeo.rotateX(-Math.PI / 2);
    const posAttr = groundGeo.attributes.position;

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
      const baseBlend = Math.min(1, Math.max(0, (dist - 14) / 32));

      let h = (S.fbm(x * 0.024, z * 0.024, 4) - 0.5) * 11.5 * baseBlend;
      h += (S.simplex2D(x * 0.08, z * 0.08) * 0.6) * baseBlend;

      if (dist > 78) {
        h += Math.pow((dist - 78) / 45, 1.8) * 22;
      }

      for (let i = 0; i < craters.length; i++) {
        const c = craters[i];
        const cd = Math.hypot(x - c.x, z - c.z);
        const ratio = cd / c.r;
        if (ratio < 1.45) {
          if (ratio < 1.0) {
            h -= (1.0 - ratio * ratio) * c.depth * baseBlend;
          }
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

    // 5. DEPÓSITOS DE GELO DE ÁGUA CRISTALINO NAS CRATERAS SOMBREADAS
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

    // 6. ROCHAS BASÁLTICAS FACETADAS COM RUÍDO SIMPLEX
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
      color: 0x2e3238,
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

    // 7. ROVER AUTÓNOMO NASA ARTEMIS / LTV COM 6 RODAS
    const kaptonMat = new THREE.MeshStandardMaterial({
      map: S.createKaptonGoldTexture(),
      metalness: 0.92,
      roughness: 0.22
    });
    const darkFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1b2029,
      metalness: 0.82,
      roughness: 0.38
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

    const roverGroup = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.46, 2.4), darkFrameMat);
    chassis.position.y = 0.72;
    chassis.castShadow = true;

    const mliDeck = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.22, 2.2), kaptonMat);
    mliDeck.position.set(0, 0.98, 0);
    mliDeck.castShadow = true;

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

    const roverSpot = new THREE.SpotLight(0xf0f8ff, 4.2, 32, 0.65, 0.35);
    roverSpot.position.set(0, 1.15, 1.15);
    roverSpot.target.position.set(0, 0.2, 8.5);
    roverGroup.add(roverSpot, roverSpot.target);

    const wheels = [];
    const wheelPositions = [
      [-0.85, 0.85], [0.85, 0.85],
      [-0.88, 0.0],  [0.88, 0.0],
      [-0.85, -0.85], [0.85, -0.85]
    ];

    wheelPositions.forEach(([wx, wz]) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wx, 0.38, wz);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18), darkFrameMat);
      rim.rotation.z = Math.PI / 2;
      rim.castShadow = true;

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.29, 12), titaniumMat);
      hub.rotation.z = Math.PI / 2;

      wheelGroup.add(rim, hub);
      roverGroup.add(wheelGroup);
      wheels.push(wheelGroup);
    });

    roverGroup.add(chassis, mliDeck, mastPole, mastHead);
    scene.add(roverGroup);

    // 8. FUNÇÃO DE ATUALIZAÇÃO CONTÍNUA DO EXTERIOR
    function updateExterior(elapsed, sunAngle) {
      const sn = Math.sin(sunAngle);
      sunLight.position.set(-48 * Math.cos(sunAngle), Math.max(sn * 28, -3), 20);
      sunLight.intensity = 3.2 * Math.max(0, Math.min(1, sn * 3.5)) + 0.05;
      hemiLight.intensity = 0.14 + 0.38 * Math.max(0, Math.min(1, (sn + 0.15) * 2.5));

      const sDir = new THREE.Vector3().subVectors(sunLight.position, earthGroup.position).normalize();
      if (earthMat.uniforms.sunDirection) {
        earthMat.uniforms.sunDirection.value.copy(sDir);
      }
      earthMesh.rotation.y = elapsed * 0.025;

      // Patrulha circular do Rover adaptando ao terreno
      const rAngle = elapsed * 0.13;
      const rDist = 17.5;
      const rx = Math.cos(rAngle) * rDist;
      const rz = Math.sin(rAngle) * rDist;
      const ry = getTerrainHeight(rx, rz);
      roverGroup.position.set(rx, ry, rz);
      roverGroup.rotation.y = -rAngle + Math.PI / 2;

      wheels.forEach(w => {
        w.children.forEach(c => { c.rotation.x += 0.045; });
      });

      mastHead.rotation.y = Math.sin(elapsed * 1.2) * 0.45;
    }

    return {
      sunLight,
      earthGroup,
      earthMesh,
      roverGroup,
      getTerrainHeight,
      updateExterior
    };
  }

  return { createExterior };
})();
