/**
 * ============================================================================
 *  WELWITSCHIA LUNAR — scene.js
 *  Terreno lunar, Rover VIPER, astronautas animados, cúpula Welwitschia,
 *  Terra no céu, poeira, holofotes de objectivo, sombras e render estéreo.
 * ============================================================================
 */
import * as THREE from './vendor/three.module.js';
import {
  fbm,
  createRegolithMaterial,
  createKaptonMaterial,
  createEarthMaterial,
  createHologramMaterial,
  createDomeMaterial,
  createSkyMaterial,
  createSolarPanelMaterial,
  createSuitMaterial,
  createRockMaterial,
  createHullMaterial,
  createFlagTexture,
  createGlowTexture,
  createDustTexture,
  createStarTexture,
  createLabelSprite,
} from './shaders.js';

const TAU = Math.PI * 2;
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _size = new THREE.Vector2();
const _euler = new THREE.Euler();
const _zee = new THREE.Vector3(0, 0, 1);
const _q0 = new THREE.Quaternion();
const _qDevice = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const rand = (a, b) => a + Math.random() * (b - a);

/** Quaternião de orientação do dispositivo (alpha/beta/gamma + rotação do ecrã). */
function deviceQuaternion(alpha, beta, gamma, orient) {
  _euler.set(beta, alpha, -gamma, 'YXZ');
  const q = new THREE.Quaternion().setFromEuler(_euler);
  q.multiply(_qDevice);
  q.multiply(_q0.setFromAxisAngle(_zee, -orient));
  return q;
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/* ------------------------------------------------------------------ */
/*  Construtores geométricos rápidos                                   */
/* ------------------------------------------------------------------ */
function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, material, seg = 16, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sphere(r, material, x = 0, y = 0, z = 0, seg = 18) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1)), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function shadowize(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

/* ================================================================== */
/*  MUNDO                                                              */
/* ================================================================== */
export class LunarWorld {
  constructor(canvas) {
    this.canvas = canvas;
    this.lowPower =
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      (navigator.hardwareConcurrency || 8) <= 4;

    this.stereo = false;
    this.ipd = 0.064;
    this.gyroEnabled = false;
    this.hasDevice = false;
    this.deviceRel = new THREE.Quaternion();
    this.calib = null;
    this.baseQuat = new THREE.Quaternion();
    this.dragging = false;
    this.enabled = false;
    this.time = 0;
    this.shake = 0;
    this.storm = 0;
    this.stormTarget = 0;
    this.walkPhase = 0;
    this.stepTimer = 0;
    this.fovTarget = 68;
    this.fov = 68;
    this.interactables = [];
    this.holograms = [];
    this.beacons = new Map();
    this.bursts = [];
    this.objectiveStates = {};
    this.domeTarget = 0;
    this.domeProgress = 0;
    this.solarAligned = false;
    this.antennaAligned = false;
    this.drillActive = false;
    this.drillProgress = 0;
    this.sampleCollected = false;
    this.sampleAnim = 0;
    this.onStep = null;
    this.onTap = null;

    this.sunDir = new THREE.Vector3(-0.82, 0.22, 0.52).normalize();
    this.earthDir = new THREE.Vector3(-0.5, 0.38, -0.76).normalize();

    this.craters = [
      { x: -58, z: -64, r: 38, depth: 3.0 },
      { x: 42, z: -54, r: 24, depth: 2.2 },
      { x: -26, z: 32, r: 16, depth: 1.4 },
      { x: 78, z: 18, r: 26, depth: 2.0 },
      { x: 18, z: 46, r: 12, depth: 0.9 },
      { x: -44, z: 4, r: 9, depth: 0.6 },
    ];

    this.pads = [
      { x: 0, z: 0, r: 6.0, r2: 11.0, h: 0 },
      { x: 10, z: -8, r: 5.7, r2: 8.8, h: this._rawHeight(10, -8) },
      { x: 5, z: 5.5, r: 2.2, r2: 4.6, h: this._rawHeight(5, 5.5) },
      { x: -11, z: -2, r: 2.1, r2: 4.2, h: this._rawHeight(-11, -2) },
      { x: 2, z: -13, r: 2.1, r2: 4.2, h: this._rawHeight(2, -13) },
      { x: 14, z: -12, r: 2.5, r2: 4.8, h: this._rawHeight(14, -12) },
    ];

    this.yaw = -0.5;
    this.pitch = 0.03;
    this.player = new THREE.Vector3(0, this.heightAt(0, 9), 9);
    this.moveInput = new THREE.Vector2();
    this.keys = new Set();

    this._initRenderer();
    this._initScene();
    this._initLights();
    this._initEnvironment();
    this._initSky();
    this._initEarth();
    this._initTerrain();
    this._initRocks();
    this._initBaseCamp();
    this._initRover();
    this._initAstronauts();
    this._initDome();
    this._initDeployables();
    this._initBeacons();
    this._initDust();
    this._bindEvents();
    this.resize();
    this.updateCamera();
  }

  /* ---------------------------------------------------------------- */
  /*  Altimetria                                                       */
  /* ---------------------------------------------------------------- */
  _rawHeight(x, z) {
    let h = (fbm(x * 0.021 + 13, z * 0.021 - 8, 811, 4, 2.05, 0.55) - 0.5) * 3.2;
    h += (fbm(x * 0.09 + 2, z * 0.09 + 5, 821, 3) - 0.5) * 0.55;
    h += (fbm(x * 0.31, z * 0.31, 831, 2) - 0.5) * 0.12;
    for (const c of this.craters) {
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const t = d / c.r;
      if (t < 1.7) {
        if (t < 1) h -= c.depth * (1 - t * t) * 0.85;
        h += Math.exp(-Math.pow((d - c.r) / (c.r * 0.22), 2)) * c.depth * 0.5;
      }
    }
    return h;
  }

  heightAt(x, z) {
    let h = this._rawHeight(x, z);
    for (const p of this.pads) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r2) {
        const w = 1 - THREE.MathUtils.smoothstep(d, p.r, p.r2);
        h = h * (1 - w) + p.h * w;
      }
    }
    return h;
  }

  /* ---------------------------------------------------------------- */
  /*  Infra-estrutura three.js                                         */
  /* ---------------------------------------------------------------- */
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x01020a);
    this.scene.fog = new THREE.FogExp2(0x08080f, 0.0018);

    this.camera = new THREE.PerspectiveCamera(68, 1, 0.08, 5000);
    this.camera.rotation.order = 'YXZ';
    this.eyeL = new THREE.PerspectiveCamera(68, 1, 0.08, 5000);
    this.eyeR = new THREE.PerspectiveCamera(68, 1, 0.08, 5000);

    this.materials = {
      regolith: createRegolithMaterial({ size: this.lowPower ? 384 : 512, repeat: 30 }),
      kapton: createKaptonMaterial(),
      suit: createSuitMaterial(),
      rock: createRockMaterial(),
      hull: createHullMaterial(0xcfd3d6),
      hullDark: createHullMaterial(0x2b3038),
      solar: createSolarPanelMaterial(),
      dome: createDomeMaterial(),
      earth: createEarthMaterial(),
      softDark: new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.82, metalness: 0.25 }),
      accent: new THREE.MeshStandardMaterial({
        color: 0xffb62e,
        roughness: 0.35,
        metalness: 0.75,
        emissive: 0x3a2200,
        emissiveIntensity: 0.6,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0x9fd8ff,
        roughness: 0.08,
        metalness: 0.0,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      }),
      green: new THREE.MeshStandardMaterial({
        color: 0x2f8a52,
        roughness: 0.62,
        emissive: 0x0b2d18,
        emissiveIntensity: 0.8,
        side: THREE.DoubleSide,
      }),
      ice: new THREE.MeshStandardMaterial({
        color: 0xbfe9ff,
        roughness: 0.16,
        metalness: 0.0,
        transparent: true,
        opacity: 0.55,
        emissive: 0x123040,
        emissiveIntensity: 0.6,
      }),
    };
  }

  _initLights() {
    this.hemi = new THREE.HemisphereLight(0x53627f, 0x0b0805, 0.35);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff0d2, 3.4);
    this.sun.position.copy(this.sunDir).multiplyScalar(120);
    this.sun.castShadow = true;
    const shadowMap = this.lowPower ? 1024 : 2048;
    this.sun.shadow.mapSize.set(shadowMap, shadowMap);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.camera.left = -34;
    this.sun.shadow.camera.right = 34;
    this.sun.shadow.camera.top = 34;
    this.sun.shadow.camera.bottom = -34;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.035;
    this.sun.target.position.set(0, 0, 0);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // luz azulada vinda da Terra (preenchimento frio)
    this.earthFill = new THREE.DirectionalLight(0x7aa2ff, 0.22);
    this.earthFill.position.set(-30, 18, -40);
    this.scene.add(this.earthFill);
  }

  _initEnvironment() {
    const w = 256;
    const h = 128;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#02040c');
    g.addColorStop(0.55, '#0a1020');
    g.addColorStop(1, '#020306');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Sol
    const su = 0.5 + Math.atan2(this.sunDir.z, this.sunDir.x) / TAU;
    const sv = 0.5 - Math.asin(this.sunDir.y) / Math.PI;
    const sx = su * w;
    const sy = sv * h;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 44);
    sg.addColorStop(0, 'rgba(255,255,245,1)');
    sg.addColorStop(0.18, 'rgba(255,232,190,0.75)');
    sg.addColorStop(1, 'rgba(255,210,150,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 50, sy - 50, 100, 100);

    // brilho da Terra
    const eu = 0.5 + Math.atan2(this.earthDir.z, this.earthDir.x) / TAU;
    const ev = 0.5 - Math.asin(this.earthDir.y) / Math.PI;
    const eg = ctx.createRadialGradient(eu * w, ev * h, 0, eu * w, ev * h, 26);
    eg.addColorStop(0, 'rgba(140,190,255,0.65)');
    eg.addColorStop(0.35, 'rgba(70,120,220,0.25)');
    eg.addColorStop(1, 'rgba(30,60,160,0)');
    ctx.fillStyle = eg;
    ctx.fillRect(eu * w - 30, ev * h - 30, 60, 60);

    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(220,235,255,${0.15 + Math.random() * 0.5})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromEquirectangular(tex).texture;
    this.scene.environmentIntensity = 0.75;
    tex.dispose();
    pmrem.dispose();
  }

  _initSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1900, 40, 22),
      createSkyMaterial(this.sunDir)
    );
    sky.frustumCulled = false;
    this.scene.add(sky);

    // halo do Sol
    const glowTex = createGlowTexture('rgba(255,252,238,1)', 'rgba(255,190,90,0)');
    const sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        opacity: 0.85,
      })
    );
    sunSprite.position.copy(this.sunDir).multiplyScalar(1500);
    sunSprite.scale.setScalar(320);
    sunSprite.renderOrder = -10;
    this.scene.add(sunSprite);
    this.sunSprite = sunSprite;

    // estrelas
    const count = this.lowPower ? 1100 : 1900;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      [0.78, 0.86, 1],
      [1, 1, 1],
      [1, 0.93, 0.76],
      [0.9, 0.8, 1],
    ];
    for (let i = 0; i < count; i++) {
      const u = Math.random() * TAU;
      const v = Math.acos(rand(-1, 1));
      const r = 1600;
      positions[i * 3] = Math.sin(v) * Math.cos(u) * r;
      positions[i * 3 + 1] = Math.cos(v) * r;
      positions[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r;
      const col = palette[(Math.random() * palette.length) | 0];
      const b = 0.55 + Math.random() * 0.45;
      colors[i * 3] = col[0] * b;
      colors[i * 3 + 1] = col[1] * b;
      colors[i * 3 + 2] = col[2] * b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 2.2,
      map: createStarTexture(),
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: false,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const stars = new THREE.Points(geo, mat);
    stars.frustumCulled = false;
    this.scene.add(stars);
    this.stars = stars;
  }

  _initEarth() {
    const g = new THREE.Group();
    const earth = sphere(24, this.materials.earth, 0, 0, 0, 48);
    earth.castShadow = false;
    earth.receiveShadow = false;
    g.add(earth);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createGlowTexture('rgba(150,200,255,0.9)', 'rgba(30,80,190,0)'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.5,
        toneMapped: false,
      })
    );
    glow.scale.setScalar(108);
    g.add(glow);

    g.position.copy(this.earthDir).multiplyScalar(720);
    this.scene.add(g);
    this.earthGroup = g;
    this.earthMesh = earth;
  }

  _initTerrain() {
    const size = 260;
    const segs = this.lowPower ? 150 : 200;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.heightAt(x, z);
      pos.setY(i, h);
      const n = fbm(x * 0.075, z * 0.075, 1201, 3);
      const shade = Math.max(0.5, Math.min(1.18, 0.78 + n * 0.36 + h * 0.03));
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade * 0.985;
      colors[i * 3 + 2] = shade * 0.95;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.materials.regolith);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.terrain = mesh;
  }

  _initRocks() {
    const count = this.lowPower ? 110 : 170;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mesh = new THREE.InstancedMesh(geo, this.materials.rock, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();

    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 8) {
      guard++;
      const a = Math.random() * TAU;
      const r = 9 + Math.random() * 105;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x - 10, z + 8) < 7) continue;
      const s = 0.1 + Math.pow(Math.random(), 2.2) * 1.15;
      dummy.position.set(x, this.heightAt(x, z) + s * 0.28, z);
      dummy.rotation.set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU);
      dummy.scale.set(s * rand(0.8, 1.5), s * rand(0.45, 0.95), s * rand(0.8, 1.5));
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    mesh.count = placed;
    this.scene.add(mesh);

    // dois matacões heróicos para leitura do sítio
    const hero = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 1), this.materials.rock);
    hero.position.set(-15, this.heightAt(-15, 10) + 0.6, 10);
    hero.scale.set(1.5, 1.0, 1.2);
    hero.rotation.set(0.4, 1.1, 0.2);
    shadowize(hero);
    this.scene.add(hero);

    const hero2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), this.materials.rock);
    hero2.position.set(18, this.heightAt(18, -15) + 0.35, -15);
    hero2.scale.set(1.1, 0.7, 1.4);
    hero2.rotation.set(0.2, 2.4, -0.15);
    shadowize(hero2);
    this.scene.add(hero2);
  }

  _initBaseCamp() {
    const group = new THREE.Group();
    const y0 = this.heightAt(0, 0);
    group.position.set(0, y0 + 0.015, 0);

    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x54e6ff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    for (const rr of [5.0, 3.4, 1.8]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(rr, rr + 0.045, 72), gridMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      group.add(ring);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.5), gridMat);
      tick.rotation.x = -Math.PI / 2;
      tick.rotation.z = -a;
      tick.position.set(Math.cos(a) * 4.2, 0.012, Math.sin(a) * 4.2);
      group.add(tick);
    }

    const postMat = this.materials.hullDark;
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x9ffcff, toneMapped: false });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.2;
      const x = Math.cos(a) * 5.35;
      const z = Math.sin(a) * 5.35;
      const post = cyl(0.035, 0.055, 0.5, postMat, 6, x, 0.25, z);
      const tip = sphere(0.055, tipMat, x, 0.52, z, 8);
      tip.castShadow = false;
      group.add(post, tip);
    }

    // caixas de equipamento
    const crateA = box(0.95, 0.75, 0.8, this.materials.kapton, -3.2, 0.38, 4.0);
    crateA.rotation.y = 0.22;
    const crateB = box(0.7, 0.55, 0.62, this.materials.hull, -4.15, 0.28, 3.15);
    crateB.rotation.y = -0.35;
    const crateC = box(0.55, 0.4, 0.5, this.materials.kapton, -3.7, 0.95, 3.7);
    crateC.rotation.y = 0.6;
    group.add(crateA, crateB, crateC);

    // mastro de comunicação de emergência
    const mast = cyl(0.05, 0.08, 2.4, this.materials.hull, 8, -1.9, 1.2, 1.6);
    const beacon = sphere(0.08, new THREE.MeshBasicMaterial({ color: 0xff5040, toneMapped: false }), -1.9, 2.44, 1.6, 8);
    const panel = box(0.62, 0.42, 0.05, this.materials.solar, -1.55, 1.75, 1.6);
    panel.rotation.y = 0.5;
    group.add(mast, beacon, panel);
    this.baseBeacon = beacon;

    // bandeira Welwitschia
    const flagGroup = new THREE.Group();
    flagGroup.position.set(2.9, 0, 4.6);
    flagGroup.rotation.y = -0.65;
    const pole = cyl(0.045, 0.06, 3.25, this.materials.hull, 8, 0, 1.62, 0);
    const finial = sphere(0.09, this.materials.accent, 0, 3.28, 0, 10);
    const clothGeo = new THREE.PlaneGeometry(1.5, 0.94, 18, 9);
    clothGeo.translate(0.76, 0, 0);
    const flagMat = new THREE.MeshStandardMaterial({
      map: createFlagTexture(),
      side: THREE.DoubleSide,
      roughness: 0.88,
      metalness: 0.04,
      emissive: 0x0a1424,
      emissiveIntensity: 0.35,
    });
    const cloth = new THREE.Mesh(clothGeo, flagMat);
    cloth.position.set(0, 2.66, 0);
    cloth.castShadow = true;
    flagGroup.add(pole, finial, cloth);
    group.add(flagGroup);
    this.flag = { mesh: cloth, base: Float32Array.from(clothGeo.attributes.position.array) };

    // amostra de solo em exposição (científica, decorativa)
    const tray = box(0.8, 0.06, 0.55, this.materials.hull, 1.2, 0.72, 2.3);
    const trayLegs = [box(0.05, 0.7, 0.05, this.materials.hullDark, 0.9, 0.35, 2.1), box(0.05, 0.7, 0.05, this.materials.hullDark, 1.5, 0.35, 2.5)];
    group.add(tray, ...trayLegs);

    this.scene.add(group);
    this.baseGroup = group;
  }

  _initRover() {
    const root = new THREE.Group();
    const M = this.materials;

    root.add(box(1.15, 0.36, 1.75, M.hull, 0, 0.66, 0));
    root.add(box(1.0, 0.24, 1.5, M.hullDark, 0, 0.45, 0));
    const foilL = box(0.035, 0.3, 1.35, M.kapton, 0.59, 0.66, 0);
    const foilR = box(0.035, 0.3, 1.35, M.kapton, -0.59, 0.66, 0);
    root.add(foilL, foilR);

    const deck = box(1.02, 0.05, 1.2, M.solar, 0, 0.87, -0.06);
    deck.rotation.x = -0.08;
    root.add(deck);

    // mastro com cabeça de câmaras
    root.add(cyl(0.042, 0.055, 1.0, M.hull, 8, 0, 1.34, 0.3));
    const head = new THREE.Group();
    head.position.set(0, 1.86, 0.3);
    head.add(box(0.32, 0.2, 0.24, M.hull, 0, 0, 0));
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x101820,
      roughness: 0.1,
      metalness: 0.4,
      emissive: 0x225577,
      emissiveIntensity: 1.1,
    });
    head.add(cyl(0.055, 0.055, 0.06, lensMat, 16, -0.08, 0, 0.13));
    head.add(cyl(0.045, 0.045, 0.06, lensMat, 16, 0.09, 0, 0.13));
    root.add(head);

    const beacon = sphere(0.055, new THREE.MeshBasicMaterial({ color: 0xffa62e, toneMapped: false }), 0.18, 1.98, 0.3, 8);
    root.add(beacon);

    // antena de baixo ganho
    const dishGeo = new THREE.SphereGeometry(0.26, 18, 10, 0, TAU, 0, Math.PI / 2.6);
    const dish = new THREE.Mesh(dishGeo, M.hull);
    dish.position.set(-0.34, 1.02, -0.62);
    dish.rotation.set(-1.1, 0.4, 0.2);
    dish.castShadow = true;
    root.add(dish);

    // broca frontal
    root.add(box(0.18, 0.34, 0.18, M.softDark, 0.34, 0.34, 0.92));
    root.add(cyl(0.035, 0.06, 0.55, M.hull, 8, 0.34, 0.02, 0.92));

    // faróis
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false });
    root.add(sphere(0.05, lampMat, 0.38, 0.66, 0.9, 8));
    root.add(sphere(0.05, lampMat, -0.38, 0.66, 0.9, 8));

    // rodas
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 20);
    wheelGeo.rotateZ(Math.PI / 2);
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.92, metalness: 0.1 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8862a, roughness: 0.34, metalness: 0.85 });
    const wheels = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const w = new THREE.Mesh(wheelGeo, tyreMat);
        w.position.set(sx * 0.68, 0.32, sz * 0.6);
        w.castShadow = true;
        w.receiveShadow = true;
        const hub = cyl(0.12, 0.12, 0.22, hubMat, 12, 0, 0, 0);
        hub.rotation.z = Math.PI / 2;
        w.add(hub);
        root.add(w);
        wheels.push(w);
        const arm = cyl(0.035, 0.035, 0.36, M.hullDark, 6, sx * 0.44, 0.34, sz * 0.6);
        arm.rotation.z = Math.PI / 2;
        root.add(arm);
      }
    }

    const label = createLabelSprite('ROVER VIPER', { color: '#7ff0ff', sub: 'EXPLORAÇÃO' });
    label.position.set(0, 2.55, 0.3);
    label.scale.set(2.3, 0.65, 1);
    root.add(label);

    this.scene.add(root);
    shadowize(root);
    this.rover = {
      root,
      wheels,
      head,
      beacon,
      t: 0.35,
      speed: 0.012,
      radiusX: 17,
      radiusZ: 12,
      anchor: new THREE.Vector3(0, 1, 0),
    };
    this.interactables.push({ id: 'rover', anchor: this.rover.anchor, range: 9, cone: 0.82, label: 'ROVER VIPER' });
  }

  /* ---------------------------------------------------------------- */
  /*  Astronautas                                                     */
  /* ---------------------------------------------------------------- */
  _makeAstronaut({ suitTint = 0xffffff, accented = true } = {}) {
    const M = this.materials;
    const g = new THREE.Group();
    const suit = M.suit.clone();
    suit.color = new THREE.Color(suitTint);
    const gold = new THREE.MeshStandardMaterial({
      color: 0xffb62e,
      roughness: 0.1,
      metalness: 0.95,
      emissive: 0x3a2400,
      emissiveIntensity: 0.45,
      envMapIntensity: 1.4,
    });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.32, 5, 12), suit);
    torso.position.set(0, 1.24, 0);
    torso.scale.z = 0.8;
    g.add(torso);

    const hips = box(0.38, 0.2, 0.28, suit, 0, 0.95, 0);
    g.add(hips);

    const helmet = sphere(0.225, suit, 0, 1.77, 0, 20);
    const visor = sphere(0.175, gold, 0, 1.77, 0.1, 20);
    visor.scale.set(1.05, 0.8, 0.55);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.018, 6, 24), M.accent);
    ring.position.set(0, 1.77, 0.03);
    ring.rotation.x = Math.PI / 2;
    g.add(helmet, visor, ring);

    const pack = box(0.42, 0.52, 0.24, M.hull, 0, 1.3, -0.26);
    const packTop = box(0.3, 0.08, 0.16, M.kapton, 0, 1.58, -0.27);
    g.add(pack, packTop);
    if (accented) {
      const stripe = box(0.43, 0.055, 0.25, M.accent, 0, 1.46, -0.26);
      g.add(stripe);
    }

    const panel = box(0.24, 0.16, 0.04, M.softDark, 0, 1.26, 0.21);
    g.add(panel);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x62ffd0, toneMapped: false });
    for (let i = 0; i < 3; i++) {
      const dot = sphere(0.018, dotMat, -0.06 + i * 0.06, 1.28, 0.235, 6);
      dot.castShadow = false;
      g.add(dot);
    }

    const armGeo = new THREE.CapsuleGeometry(0.07, 0.3, 4, 8);
    const legGeo = new THREE.CapsuleGeometry(0.088, 0.46, 4, 8);
    const boots = [];

    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.32, 1.48, 0);
      const arm = new THREE.Mesh(armGeo, suit);
      arm.position.y = -0.24;
      arm.castShadow = true;
      const glove = sphere(0.075, M.accent, 0, -0.48, 0.02, 10);
      pivot.add(arm, glove);
      pivot.rotation.z = side * 0.1;
      g.add(pivot);
      return pivot;
    };

    const makeLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.13, 0.92, 0);
      const leg = new THREE.Mesh(legGeo, suit);
      leg.position.y = -0.35;
      leg.castShadow = true;
      const boot = box(0.17, 0.16, 0.3, M.softDark, 0, -0.68, 0.05);
      pivot.add(leg, boot);
      g.add(pivot);
      boots.push(pivot);
      return pivot;
    };

    const leftArm = makeArm(1);
    const rightArm = makeArm(-1);
    const leftLeg = makeLeg(1);
    const rightLeg = makeLeg(-1);

    shadowize(g);
    g.userData = {
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      torso,
      phase: Math.random() * TAU,
      orbit: null,
      mode: 'idle',
      baseY: 0,
    };
    return g;
  }

  _initAstronauts() {
    this.astronauts = [];

    const walker = this._makeAstronaut({ suitTint: 0xf2f2ee });
    walker.userData.mode = 'walk';
    walker.userData.orbit = { cx: 10, cz: -8, r: 8.6, speed: 0.11, a: 2.3 };
    const wx = 10 + Math.cos(2.3) * 8.6;
    const wz = -8 + Math.sin(2.3) * 8.6;
    walker.position.set(wx, this.heightAt(wx, wz), wz);
    this.scene.add(walker);
    this.astronauts.push(walker);

    const inspector = this._makeAstronaut({ suitTint: 0xe8e6df });
    inspector.position.set(-6.1, this.heightAt(-6.1, 6.0), 6.0);
    inspector.rotation.y = 2.35;
    inspector.userData.torso.rotation.x = 0.26;
    inspector.userData.leftArm.rotation.x = -0.55;
    inspector.userData.rightArm.rotation.x = -0.35;
    this.scene.add(inspector);
    this.astronauts.push(inspector);

    const radio = this._makeAstronaut({ suitTint: 0xeceae4 });
    radio.position.set(0.4, this.heightAt(0.4, -10.6), -10.6);
    radio.rotation.y = -0.2;
    radio.userData.leftArm.rotation.x = -1.15;
    radio.userData.rightArm.rotation.x = -0.9;
    this.scene.add(radio);
    this.astronauts.push(radio);
  }

  /* ---------------------------------------------------------------- */
  /*  Cúpula Welwitschia                                               */
  /* ---------------------------------------------------------------- */
  _buildLeafGeometry(dir = 1) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(
        new THREE.Vector3(
          dir * (t * t * 3.7 + Math.sin(t * 4.0) * 0.45),
          0.06 + Math.sin(t * Math.PI) * 0.24,
          t * 4.3
        )
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const SEG = 64;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t).normalize();
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const w =
        0.9 *
        (0.3 + 0.85 * Math.sin(Math.PI * Math.min(1, t * 1.02))) *
        (1 - 0.22 * t);
      const ripple = Math.sin(t * 22.0) * 0.035;
      positions.push(
        p.x + side.x * w * 0.5, p.y + ripple, p.z + side.z * w * 0.5,
        p.x - side.x * w * 0.5, p.y + ripple, p.z - side.z * w * 0.5
      );
      uvs.push(0, t, 1, t);
      if (i < SEG) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  _initDome() {
    const cx = 10;
    const cz = -8;
    const gy = this.heightAt(cx, cz);
    const M = this.materials;
    const g = new THREE.Group();
    g.position.set(cx, gy, cz);

    g.add(cyl(5.72, 5.98, 0.9, M.hullDark, 48, 0, -0.15, 0));
    const deck = cyl(5.5, 5.5, 0.2, M.hull, 48, 0, 0.35, 0);
    g.add(deck);

    const soilMat = new THREE.MeshStandardMaterial({ color: 0x2a3826, roughness: 1.0, metalness: 0.0 });
    const soil = new THREE.Mesh(new THREE.CircleGeometry(5.15, 48), soilMat);
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.46;
    soil.receiveShadow = true;
    g.add(soil);

    // concha de vidro biomimética
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(5, 48, 24, 0, TAU, 0, Math.PI / 2),
      M.dome
    );
    shell.position.y = 0.45;
    shell.scale.y = 0.012;
    shell.renderOrder = 5;
    g.add(shell);

    // nervuras
    const ribs = new THREE.Group();
    ribs.position.y = 0.45;
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0xd9efe3,
      metalness: 0.68,
      roughness: 0.3,
      emissive: 0x0b2a1e,
      emissiveIntensity: 0.7,
    });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const pts = [];
      for (let j = 0; j <= 10; j++) {
        const ph = (j / 10) * (Math.PI / 2);
        pts.push(
          new THREE.Vector3(
            Math.cos(a) * Math.sin(ph) * 5.03,
            Math.cos(ph) * 5.03,
            Math.sin(a) * Math.sin(ph) * 5.03
          )
        );
      }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.035, 5, false), ribMat);
      tube.castShadow = true;
      ribs.add(tube);
    }
    for (const h of [2.5, 4.33]) {
      const rr = Math.sqrt(Math.max(0.01, 25 - h * h));
      const torus = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.028, 5, 64), ribMat);
      torus.rotation.x = Math.PI / 2;
      torus.position.y = h;
      torus.castShadow = true;
      ribs.add(torus);
    }
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.09, 8, 72), M.accent);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.02;
    ribs.add(baseRing);
    ribs.scale.y = 0.012;
    g.add(ribs);

    // portal de entrada
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.07, 8, 28, Math.PI), ribMat);
    arch.position.set(0, 1.25, 5.0);
    arch.castShadow = true;
    g.add(arch);
    const postL = cyl(0.07, 0.09, 1.3, ribMat, 8, -0.92, 0.65, 5.0);
    const postR = cyl(0.07, 0.09, 1.3, ribMat, 8, 0.92, 0.65, 5.0);
    g.add(postL, postR);

    // interior vivo (escondido antes da implantação)
    const interior = new THREE.Group();
    interior.position.y = 0.45;
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x584431, roughness: 0.96 });
    const trunk = cyl(0.3, 0.46, 0.6, barkMat, 12, 0, 0.3, 0);
    interior.add(trunk);
    const leafA = new THREE.Mesh(this._buildLeafGeometry(1), M.green);
    const leafB = new THREE.Mesh(this._buildLeafGeometry(-1), M.green);
    leafA.position.y = 0.58;
    leafB.position.y = 0.58;
    leafA.scale.setScalar(0.01);
    leafB.scale.setScalar(0.01);
    leafA.castShadow = true;
    leafB.castShadow = true;
    interior.add(leafA, leafB);

    const rackCount = 6;
    for (let i = 0; i < rackCount; i++) {
      const a = (i / rackCount) * TAU + 0.4;
      const rx = Math.cos(a) * 3.35;
      const rz = Math.sin(a) * 3.35;
      const rack = box(0.95, 0.55, 0.5, M.hullDark, rx, 0.28, rz);
      rack.rotation.y = -a;
      interior.add(rack);
      const crop = box(0.8, 0.04, 0.38, M.green, rx, 0.58, rz);
      crop.rotation.y = -a;
      interior.add(crop);
      for (let k = 0; k < 3; k++) {
        const plant = sphere(0.07, M.green, rx + rand(-0.3, 0.3), 0.63 + rand(0, 0.12), rz + rand(-0.15, 0.15), 6);
        interior.add(plant);
      }
    }

    const holoMat = createHologramMaterial(0x7dffcf, 0.7);
    this.holograms.push(holoMat);
    const dataRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.022, 6, 64), holoMat);
    dataRing.rotation.x = Math.PI / 2;
    dataRing.position.y = 2.2;
    interior.add(dataRing);
    const dataRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.018, 6, 48), holoMat);
    dataRing2.rotation.x = Math.PI / 2;
    dataRing2.position.y = 2.55;
    interior.add(dataRing2);
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), holoMat);
    diamond.position.y = 2.85;
    interior.add(diamond);

    const light = new THREE.PointLight(0x7dffcf, 0, 24, 2);
    light.position.set(0, 2.8, 0);
    interior.add(light);

    interior.visible = false;
    g.add(interior);

    const label = createLabelSprite('CÚPULA WELWITSCHIA', { color: '#8dffd8', sub: 'HABITAT BIOMIMÉTICO' });
    label.position.set(0, 7.4, 0);
    label.scale.set(4.6, 1.3, 1);
    label.visible = false;
    g.add(label);

    const holoRing = new THREE.Mesh(new THREE.TorusGeometry(5.15, 0.045, 6, 80), holoMat);
    holoRing.rotation.x = Math.PI / 2;
    holoRing.position.y = 0.55;
    g.add(holoRing);

    this.scene.add(g);
    shadowize(g);
    this.dome = {
      group: g,
      shell,
      ribs,
      interior,
      leaves: [leafA, leafB],
      light,
      label,
      dataRing,
      dataRing2,
      diamond,
      progress: 0,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Equipamento implantável                                          */
  /* ---------------------------------------------------------------- */
  _initDeployables() {
    const M = this.materials;

    /* -------- amostra de regolito -------- */
    {
      const x = 1.6;
      const z = -3.4;
      const y = this.heightAt(x, z);
      const g = new THREE.Group();
      g.position.set(x, y, z);

      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), M.rock);
      rock.position.y = 0.12;
      rock.scale.set(1.2, 0.6, 1.0);
      rock.castShadow = true;
      g.add(rock);

      const canister = cyl(0.18, 0.18, 0.42, M.kapton, 14, 0, 0.45, 0);
      const cap = cyl(0.19, 0.19, 0.05, M.accent, 14, 0, 0.68, 0);
      const capGlow = sphere(0.055, new THREE.MeshBasicMaterial({ color: 0x7ff0ff, toneMapped: false }), 0, 0.72, 0, 8);
      g.add(canister, cap, capGlow);

      const scoop = box(0.5, 0.035, 0.12, M.hull, 0.35, 0.14, 0.1);
      scoop.rotation.z = -0.25;
      g.add(scoop);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x54e6ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 48), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      g.add(ring);

      this.scene.add(g);
      shadowize(g);
      this.sample = { group: g, ring, ringMat, y };
      this.interactables.push({
        id: 'sample',
        anchor: new THREE.Vector3(x, y + 0.6, z),
        range: 6,
        cone: 0.8,
        label: 'AMOSTRA DE REGOLITO',
      });
    }

    /* -------- perfuradora de gelo -------- */
    {
      const x = 5;
      const z = 5.5;
      const y = this.heightAt(x, z);
      const g = new THREE.Group();
      g.position.set(x, y, z);

      const legMat = M.hull;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.5;
        const leg = cyl(0.045, 0.055, 1.25, legMat, 6, Math.cos(a) * 0.42, 0.55, Math.sin(a) * 0.42);
        leg.rotation.z = Math.cos(a) * 0.34;
        leg.rotation.x = -Math.sin(a) * 0.34;
        g.add(leg);
      }
      g.add(cyl(0.5, 0.55, 0.12, M.hullDark, 16, 0, 1.15, 0));
      const motor = box(0.42, 0.42, 0.42, M.hull, 0, 1.45, 0);
      const motorGold = box(0.44, 0.1, 0.44, M.kapton, 0, 1.62, 0);
      const rail = box(0.1, 1.0, 0.1, M.hullDark, 0.36, 0.85, 0);
      g.add(motor, motorGold, rail);

      const bit = new THREE.Group();
      bit.position.set(0, 0.95, 0);
      const shaft = cyl(0.05, 0.06, 1.05, M.hull, 10, 0, 0.1, 0);
      const tip = cyl(0.02, 0.07, 0.22, M.accent, 10, 0, -0.5, 0);
      bit.add(shaft, tip);
      g.add(bit);

      const holeRing = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.3, 32),
        new THREE.MeshBasicMaterial({
          color: 0x8fe8ff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        })
      );
      holeRing.rotation.x = -Math.PI / 2;
      holeRing.position.y = 0.02;
      g.add(holeRing);

      // poeira da broca
      const dustCount = 70;
      const dustPos = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        dustPos[i * 3] = rand(-0.15, 0.15);
        dustPos[i * 3 + 1] = rand(-0.5, 0.2);
        dustPos[i * 3 + 2] = rand(-0.15, 0.15);
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      const dustMat = new THREE.PointsMaterial({
        size: 0.045,
        map: createDustTexture(),
        color: 0xd8cdb8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const dust = new THREE.Points(dustGeo, dustMat);
      dust.position.y = 0.05;
      dust.frustumCulled = false;
      g.add(dust);

      this.scene.add(g);
      shadowize(g);
      this.drill = { group: g, bit, dust, dustMat, dustPos, holeRing, y };
      this.interactables.push({
        id: 'drill',
        anchor: new THREE.Vector3(x, y + 0.9, z),
        range: 6,
        cone: 0.82,
        label: 'PERFURADORA DE GELO',
      });
    }

    /* -------- painel solar -------- */
    {
      const x = -11;
      const z = -2;
      const y = this.heightAt(x, z);
      const g = new THREE.Group();
      g.position.set(x, y, z);

      g.add(cyl(0.8, 0.95, 0.18, M.hullDark, 24, 0, 0.09, 0));
      g.add(cyl(0.11, 0.14, 1.2, M.hull, 10, 0, 0.7, 0));

      const pivot = new THREE.Group();
      pivot.position.y = 1.15;
      pivot.rotation.y = 0.5;
      const panelGeo = new THREE.BoxGeometry(1.35, 0.055, 0.85);
      for (let i = -1; i <= 1; i++) {
        const p = new THREE.Mesh(panelGeo, M.solar);
        p.position.set(i * 1.48, 0, 0);
        p.rotation.x = -0.72;
        p.castShadow = true;
        p.receiveShadow = true;
        pivot.add(p);
        const frame = box(1.42, 0.07, 0.9, M.hull, i * 1.48, -0.035, 0);
        frame.rotation.x = -0.72;
        pivot.add(frame);
      }
      pivot.rotation.x = 0;
      g.add(pivot);

      const statusMat = new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false });
      const status = sphere(0.07, statusMat, 0.55, 0.2, 0.55, 8);
      g.add(status);

      this.scene.add(g);
      shadowize(g);
      this.solar = { group: g, pivot, statusMat, targetYaw: pivot.rotation.y, y };
      this.interactables.push({
        id: 'solar',
        anchor: new THREE.Vector3(x, y + 1.3, z),
        range: 7,
        cone: 0.78,
        label: 'CONJUNTO SOLAR',
      });
    }

    /* -------- antena de ligação Terra -------- */
    {
      const x = 2;
      const z = -13;
      const y = this.heightAt(x, z);
      const g = new THREE.Group();
      g.position.set(x, y, z);

      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.2;
        const leg = cyl(0.04, 0.055, 1.5, M.hull, 6, Math.cos(a) * 0.38, 0.7, Math.sin(a) * 0.38);
        leg.rotation.z = Math.cos(a) * 0.24;
        leg.rotation.x = -Math.sin(a) * 0.24;
        g.add(leg);
      }
      g.add(cyl(0.16, 0.22, 0.2, M.hullDark, 12, 0, 1.42, 0));

      const dishPivot = new THREE.Group();
      dishPivot.position.y = 1.55;
      const dishGeo = new THREE.SphereGeometry(0.82, 24, 12, 0, TAU, 0, Math.PI / 2.7);
      const dish = new THREE.Mesh(dishGeo, M.hull);
      dish.material = M.hull.clone();
      dish.material.side = THREE.DoubleSide;
      dish.castShadow = true;
      const feed = cyl(0.035, 0.04, 0.55, M.kapton, 8, 0, 0.28, 0);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.025, 5, 40), M.accent);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.28;
      dishPivot.add(dish, feed, rim);
      dishPivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.25, 1, 0.1).normalize());
      g.add(dishPivot);

      const signalMat = new THREE.MeshBasicMaterial({ color: 0x54e6ff, toneMapped: false });
      const signal = sphere(0.06, signalMat, 0, 1.35, 0.26, 8);
      g.add(signal);

      this.scene.add(g);
      shadowize(g);
      this.antenna = {
        group: g,
        dishPivot,
        signalMat,
        baseQuat: dishPivot.quaternion.clone(),
        targetQuat: dishPivot.quaternion.clone(),
        y,
      };
      this.interactables.push({
        id: 'antenna',
        anchor: new THREE.Vector3(x, y + 1.6, z),
        range: 6.5,
        cone: 0.82,
        label: 'ANTENA TERRA',
      });
    }

    // estaca de levantamento topográfico
    {
      const x = 14;
      const z = -12;
      const y = this.heightAt(x, z);
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.add(cyl(0.035, 0.045, 1.45, M.hull, 8, 0, 0.72, 0));
      const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), M.accent);
      prism.position.y = 1.52;
      prism.castShadow = true;
      g.add(prism);
      const tripodA = cyl(0.02, 0.025, 0.8, M.hullDark, 5, 0.3, 0.36, 0.25);
      tripodA.rotation.z = 0.4;
      g.add(tripodA);
      this.scene.add(g);
      shadowize(g);
      this.surveyStake = g;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Balizas holográficas                                            */
  /* ---------------------------------------------------------------- */
  _initBeacons() {
    const defs = [
      { id: 'survey', label: 'LEVANTAMENTO', sub: 'BORDA DA CRATERA', x: 14, z: -12, color: 0x54e6ff, range: 11, cone: 0.55 },
      { id: 'sample', label: 'AMOSTRA', sub: 'REGOLITO', x: 1.6, z: -3.4, color: 0x54e6ff, range: 6, cone: 0.8 },
      { id: 'drill', label: 'PERFURAÇÃO', sub: 'GELO SUBSUPERFICIAL', x: 5, z: 5.5, color: 0x54e6ff, range: 6, cone: 0.82 },
      { id: 'dome', label: 'CÚPULA', sub: 'WELWITSCHIA', x: 10, z: -2.4, color: 0x7dffcf, range: 18, cone: 0.3 },
      { id: 'solar', label: 'PAINEL SOLAR', sub: 'ENERGIA', x: -11, z: -2, color: 0xffd166, range: 7, cone: 0.78 },
      { id: 'antenna', label: 'ANTENA', sub: 'LIGAÇÃO TERRA', x: 2, z: -13, color: 0x54e6ff, range: 6.5, cone: 0.82 },
    ];

    defs.forEach((def, idx) => {
      const py = this.heightAt(def.x, def.z);
      const group = new THREE.Group();
      group.position.set(def.x, py + 0.02, def.z);

      const big = def.id === 'dome';
      const ringMat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const radius = big ? 1.6 : 1.05;
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.09, 56), ringMat);
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);

      const beamMat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, big ? 0.6 : 0.3, big ? 4.2 : 6.5, 12, 1, true), beamMat);
      beam.position.y = (big ? 4.2 : 6.5) / 2;
      group.add(beam);

      const diamondMat = createHologramMaterial(def.color, 0.95);
      this.holograms.push(diamondMat);
      const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), diamondMat);
      diamond.position.y = big ? 3.1 : 2.0;
      group.add(diamond);

      const label = createLabelSprite(def.label, { color: `#${new THREE.Color(def.color).getHexString()}`, sub: def.sub });
      label.position.y = big ? 4.1 : 3.15;
      label.scale.set(2.8, 0.79, 1);
      group.add(label);

      group.visible = false;
      this.scene.add(group);
      this.beacons.set(def.id, {
        group,
        ring,
        ringMat,
        beam,
        beamMat,
        diamond,
        diamondMat,
        label,
        baseY: py,
        color: def.color,
        phase: idx * 1.7,
      });

      this.interactables.push({
        id: def.id,
        anchor: new THREE.Vector3(def.x, py + (big ? 1.5 : 1.0), def.z),
        range: def.range,
        cone: def.cone,
        label: def.label,
      });
    });
  }

  _initDust() {
    const count = this.lowPower ? 650 : 1200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rand(-32, 32);
      pos[i * 3 + 1] = rand(-2, 15);
      pos[i * 3 + 2] = rand(-32, 32);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.075,
      map: createDustTexture(),
      color: 0xd8cdb8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.position.set(0, 0, 0);
    this.scene.add(points);
    this.dust = points;
    this.dustMat = mat;
  }

  /* ================================================================ */
  /*  Actualização por frame                                          */
  /* ================================================================ */
  update(dt) {
    dt = Math.min(dt || 0.016, 0.06);
    this.time += dt;

    this._updatePlayer(dt);
    this._updateRover(dt);
    this._updateAstronauts(dt);
    this._updateDome(dt);
    this._updateDeployables(dt);
    this._updateBeacons(dt);
    this._updateDust(dt);
    this._updateBursts(dt);
    this._updateFlag(dt);
    this._updateEarth(dt);

    this.shake *= Math.exp(-2.6 * dt);
    if (this.shake < 0.002) this.shake = 0;
    this.fov = damp(this.fov, this.fovTarget, 5, dt);

    this.updateCamera(dt);
  }

  _updatePlayer(dt) {
    let ix = 0;
    let iy = 0;
    if (this.enabled) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iy += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iy -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
    }
    ix += this.moveInput.x;
    iy += this.moveInput.y;
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }

    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = sprint ? 5.4 : 3.2;
    const moving = len > 0.08;

    if (moving) {
      _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      let fx = _v1.x;
      let fz = _v1.z;
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;
      const rx = -fz;
      const rz = fx;
      const amount = len * speed * dt;
      this.player.x += (fx * iy + rx * ix) * amount;
      this.player.z += (fz * iy + rz * ix) * amount;
      this.walkPhase += dt * (sprint ? 12.5 : 9.0);
      this.stepTimer += dt * (sprint ? 1.35 : 1);
      if (this.stepTimer > 0.52) {
        this.stepTimer = 0;
        if (this.onStep) this.onStep(sprint);
      }
    } else {
      this.stepTimer = 0;
    }

    const r = Math.hypot(this.player.x, this.player.z);
    if (r > 27) {
      this.player.x = (this.player.x / r) * 27;
      this.player.z = (this.player.z / r) * 27;
    }

    const ground = this.heightAt(this.player.x, this.player.z);
    this.player.y = damp(this.player.y, ground, 14, dt);
    this.bob = moving ? Math.sin(this.walkPhase) * 0.03 : damp(this.bob, 0, 8, dt);
    this.moving = moving;
    this.fovTarget = 68 + (moving && sprint ? 3.5 : 0);
  }

  _updateRover(dt) {
    const r = this.rover;
    const a = r.t * TAU;
    const x = Math.cos(a) * r.radiusX;
    const z = Math.sin(a) * r.radiusZ;
    const y = this.heightAt(x, z);
    r.root.position.set(x, y, z);

    const tx = -Math.sin(a) * r.radiusX;
    const tz = Math.cos(a) * r.radiusZ;
    r.root.rotation.y = Math.atan2(tx, tz);

    const e = 0.8;
    const tlen = Math.hypot(tx, tz) || 1;
    const nx = tx / tlen;
    const nz = tz / tlen;
    const hF = this.heightAt(x + nx * e, z + nz * e);
    const hB = this.heightAt(x - nx * e, z - nz * e);
    const hR = this.heightAt(x - nz * e, z + nx * e);
    const hL = this.heightAt(x + nz * e, z - nx * e);
    r.root.rotation.x = damp(r.root.rotation.x, Math.atan2(hB - hF, 2 * e) * 0.5, 3, dt);
    r.root.rotation.z = damp(r.root.rotation.z, Math.atan2(hR - hL, 2 * e) * 0.5, 3, dt);

    const dist = TAU * r.speed * Math.hypot(Math.sin(a) * r.radiusX, Math.cos(a) * r.radiusZ);
    for (const w of r.wheels) w.rotation.x += (dist / 0.3) * dt;
    r.head.rotation.y = Math.sin(this.time * 0.55) * 0.7;
    const blink = 0.55 + 0.45 * Math.sin(this.time * 5.5);
    r.beacon.material.color.setRGB(1, 0.55 + blink * 0.3, 0.12);

    r.anchor.copy(r.root.position);
    r.anchor.y += 1.15;
    r.t += dt * r.speed;
  }

  _updateAstronauts(dt) {
    for (const ast of this.astronauts) {
      const u = ast.userData;
      if (u.baseY === undefined) u.baseY = this.heightAt(ast.position.x, ast.position.z);
      if (u.orbit) {
        const o = u.orbit;
        o.a += dt * o.speed;
        const x = o.cx + Math.cos(o.a) * o.r;
        const z = o.cz + Math.sin(o.a) * o.r;
        const y = this.heightAt(x, z);
        ast.position.set(x, y + Math.abs(Math.sin(this.time * 4.4 + u.phase)) * 0.035, z);
        const tx = -Math.sin(o.a) * o.r;
        const tz = Math.cos(o.a) * o.r;
        ast.rotation.y = Math.atan2(tx, tz);
        const sw = Math.sin(this.time * 4.4 + u.phase) * 0.55;
        u.leftArm.rotation.x = -sw;
        u.rightArm.rotation.x = sw;
        u.leftLeg.rotation.x = sw * 0.75;
        u.rightLeg.rotation.x = -sw * 0.75;
        u.torso.rotation.z = Math.sin(this.time * 2.2) * 0.02;
      } else {
        ast.position.y = u.baseY + Math.sin(this.time * 1.3 + u.phase) * 0.008;
        u.torso.rotation.y = Math.sin(this.time * 0.55 + u.phase) * 0.06;
        u.torso.rotation.z = Math.sin(this.time * 0.7 + u.phase) * 0.012;
      }
    }
  }

  _updateDome(dt) {
    const d = this.dome;
    if (this.domeProgress < this.domeTarget) {
      this.domeProgress = Math.min(1, this.domeProgress + dt / 3.4);
    }
    const p = clamp01(this.domeProgress);
    const eb = Math.min(1.02, Math.max(0, easeOutBack(p)));
    d.shell.scale.y = 0.012 + (eb / 1.02) * 0.988;
    d.ribs.scale.y = d.shell.scale.y;
    d.shell.material.uniforms.uOpacity.value = 0.16 + p * 0.34;
    d.interior.visible = p > 0.1;
    d.light.intensity = p * 9;
    d.label.visible = p > 0.68;
    const lp = clamp01((p - 0.22) / 0.78);
    const leafScale = 0.05 + lp * 0.95;
    for (const leaf of d.leaves) leaf.scale.set(leafScale, 1, leafScale);
    d.dataRing.rotation.z += dt * 0.35;
    d.dataRing2.rotation.z -= dt * 0.55;
    d.diamond.rotation.y += dt * 0.9;
    d.diamond.position.y = 2.85 + Math.sin(this.time * 1.4) * 0.08;
    d.progress = p;

    if (this.sampleCollected) {
      this.sampleAnim += dt;
      const s = Math.max(0.001, 1 - this.sampleAnim * 0.9);
      this.sample.group.scale.setScalar(s);
      this.sample.ringMat.opacity = Math.max(0, 0.55 - this.sampleAnim * 0.5);
      if (this.sampleAnim > 1.2) this.sample.group.visible = false;
    }
  }

  _updateDeployables(dt) {
    // painel solar
    if (this.solarAligned) {
      this.solar.targetYaw = Math.atan2(this.sunDir.x, this.sunDir.z);
      this.solar.statusMat.color.setHex(0x5dff9a);
    }
    this.solar.pivot.rotation.y = damp(this.solar.pivot.rotation.y, this.solar.targetYaw, 1.5, dt);
    this.solar.pivot.rotation.x = Math.sin(this.time * 0.4) * 0.02;

    // antena
    if (this.antennaAligned) {
      this.antenna.signalMat.color.setHex(0x5dff9a);
      _v1.copy(this.earthDir);
      this.antenna.targetQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v1);
    }
    this.antenna.dishPivot.quaternion.slerp(this.antenna.targetQuat, 1 - Math.exp(-1.6 * dt));

    // broca
    const dd = this.drill;
    if (this.drillActive) {
      dd.bit.rotation.y += dt * 17;
      dd.bit.position.y = 0.95 - Math.abs(Math.sin(this.time * 6)) * 0.05;
      dd.dustMat.opacity = damp(dd.dustMat.opacity, 0.8, 8, dt);
      const p = dd.dustPos;
      for (let i = 0; i < p.length; i += 3) {
        p[i + 1] += dt * (0.35 + (i % 7) * 0.05);
        p[i] += Math.sin(this.time * 4 + i) * dt * 0.2;
        if (p[i + 1] > 1.1) {
          p[i] = rand(-0.16, 0.16);
          p[i + 1] = -0.5;
          p[i + 2] = rand(-0.16, 0.16);
        }
      }
      dd.dust.geometry.attributes.position.needsUpdate = true;
    } else {
      dd.dustMat.opacity = damp(dd.dustMat.opacity, 0, 4, dt);
    }
    if (this.drillProgress > 0.05) {
      dd.holeRing.material.opacity = Math.min(0.7, this.drillProgress * 0.8);
    }

    // farol da base
    if (this.baseBeacon) {
      const b = 0.4 + 0.6 * Math.abs(Math.sin(this.time * 3.6));
      this.baseBeacon.material.color.setRGB(1, 0.28 + b * 0.2, 0.2 + b * 0.1);
    }
  }

  _updateBeacons(dt) {
    for (const [id, b] of this.beacons) {
      if (!b.group.visible) continue;
      const active = this.objectiveStates[id] === 'active';
      const pulse = 1 + Math.sin(this.time * 2.2 + b.phase) * (active ? 0.09 : 0.05);
      b.ring.scale.set(pulse, pulse, pulse);
      b.diamond.rotation.y += dt * 0.9;
      b.diamond.position.y = (id === 'dome' ? 3.1 : 2.0) + Math.sin(this.time * 1.6 + b.phase) * 0.12;
      b.beamMat.opacity = (active ? 0.2 : 0.1) + Math.sin(this.time * 1.8 + b.phase) * 0.035;
      b.label.position.y = (id === 'dome' ? 4.1 : 3.15) + Math.sin(this.time * 1.1 + b.phase) * 0.06;
      const dx = b.group.position.x - this.player.x;
      const dz = b.group.position.z - this.player.z;
      b.label.visible = Math.hypot(dx, dz) < 28;
    }
  }

  _updateDust(dt) {
    this.storm = damp(this.storm, this.stormTarget, 1.1, dt);
    const s = this.storm;
    this.dustMat.opacity = s * 0.62;
    this.dustMat.size = 0.075 + s * 0.16;
    this.dust.position.set(this.player.x, 0, this.player.z);
    this.dust.rotation.y += dt * (0.015 + s * 0.45);

    this.scene.fog.density = 0.0018 + s * 0.03;
    this.scene.fog.color.setRGB(0.035 + s * 0.16, 0.035 + s * 0.13, 0.055 + s * 0.08);
    this.sun.intensity = 3.4 - s * 2.0;
    this.hemi.intensity = 0.35 + s * 0.3;
    this.sunSprite.material.opacity = 0.85 * (1 - s * 0.82);
  }

  _updateBursts(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      b.ring.scale.setScalar(1 + b.t * 11);
      b.ring.material.opacity = Math.max(0, 0.85 - b.t * 0.8);
      b.light.intensity = Math.max(0, 42 - b.t * 50);
      if (b.t > 1.25) {
        this.scene.remove(b.ring);
        this.scene.remove(b.light);
        b.ring.geometry.dispose();
        b.ring.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }

  _updateFlag(dt) {
    if (!this.flag) return;
    const geom = this.flag.mesh.geometry;
    const pos = geom.attributes.position;
    const base = this.flag.base;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const wave =
        Math.sin(x * 3.6 + this.time * 2.6 + y * 2.4) * 0.075 * (x / 1.6 + 0.45) +
        Math.sin(x * 7.1 - this.time * 1.3) * 0.018;
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
  }

  _updateEarth(dt) {
    if (this.earthMesh) this.earthMesh.rotation.y += dt * 0.004;
  }

  updateCamera() {
    const bob = this.moving ? this.bob : 0;
    this.camera.position.set(this.player.x, this.player.y + 1.64 + bob, this.player.z);

    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.baseQuat.setFromEuler(_euler);
    if (this.gyroEnabled && this.hasDevice) {
      this.camera.quaternion.copy(this.deviceRel).multiply(this.baseQuat);
    } else {
      this.camera.quaternion.copy(this.baseQuat);
    }

    if (this.shake > 0.002) {
      const s = this.shake;
      this.camera.position.x += (Math.random() - 0.5) * s * 0.22;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.18;
      this.camera.position.z += (Math.random() - 0.5) * s * 0.22;
      this.camera.rotateZ((Math.random() - 0.5) * s * 0.05);
    }

    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const halfAspect = w / 2 / h;
    this.eyeL.aspect = halfAspect;
    this.eyeR.aspect = halfAspect;
    this.eyeL.updateProjectionMatrix();
    this.eyeR.updateProjectionMatrix();
    this.halfAspect = halfAspect;
  }

  _syncEye(eye, sign) {
    _v1.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    eye.position.copy(this.camera.position).addScaledVector(_v1, sign * this.ipd * 0.5);
    eye.quaternion.copy(this.camera.quaternion);
    eye.fov = this.camera.fov;
    eye.aspect = this.halfAspect;
    eye.near = this.camera.near;
    eye.far = this.camera.far;
    eye.updateProjectionMatrix();
  }

  render() {
    const w = this.width;
    const h = this.height;
    if (this.stereo) {
      const half = Math.max(1, Math.floor(w / 2));
      this.renderer.setScissorTest(true);

      this._syncEye(this.eyeL, -1);
      this.renderer.setViewport(0, 0, half, h);
      this.renderer.setScissor(0, 0, half, h);
      this.renderer.render(this.scene, this.eyeL);

      this._syncEye(this.eyeR, 1);
      this.renderer.setViewport(half, 0, w - half, h);
      this.renderer.setScissor(half, 0, w - half, h);
      this.renderer.render(this.scene, this.eyeR);

      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
    } else {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
      this.renderer.render(this.scene, this.camera);
    }
  }

  /* ================================================================ */
  /*  Entrada (rato, toque, teclado, giroscópio)                      */
  /* ================================================================ */
  _bindEvents() {
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onOrientation = this._onOrientation.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    this.canvas.addEventListener('pointerdown', this._onPointerDown, { passive: false });
    window.addEventListener('pointermove', this._onPointerMove, { passive: false });
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 300));
    window.addEventListener('deviceorientation', this._onOrientation);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.lastPX = e.clientX;
    this.lastPY = e.clientY;
    this.dragDist = 0;
    this.dragStart = performance.now();
    if (this.canvas.setPointerCapture) {
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    }
    if (e.pointerType === 'touch') e.preventDefault();
  }

  _onPointerMove(e) {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    const dx = e.clientX - this.lastPX;
    const dy = e.clientY - this.lastPY;
    this.lastPX = e.clientX;
    this.lastPY = e.clientY;
    this.dragDist += Math.hypot(dx, dy);
    const sens = e.pointerType === 'touch' ? 0.0044 : 0.0025;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens * 0.92;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.32, 1.32);
    if (e.pointerType === 'touch') e.preventDefault();
  }

  _onPointerUp(e) {
    if (!this.dragging) return;
    this.dragging = false;
    const tap = this.dragDist < 10 && performance.now() - this.dragStart < 460;
    if (tap && this.onTap) this.onTap();
  }

  _onKeyDown(e) {
    const moveKeys = [
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'ShiftLeft', 'ShiftRight',
    ];
    if (moveKeys.includes(e.code)) {
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _onOrientation(e) {
    if (!this.stereo || e.alpha === null || e.alpha === undefined) return;
    let orient = 0;
    if (screen.orientation && typeof screen.orientation.angle === 'number') {
      orient = screen.orientation.angle;
    } else if (typeof window.orientation === 'number') {
      orient = window.orientation;
    }
    const q = deviceQuaternion(
      THREE.MathUtils.degToRad(e.alpha),
      THREE.MathUtils.degToRad(e.beta || 0),
      THREE.MathUtils.degToRad(e.gamma || 0),
      THREE.MathUtils.degToRad(orient)
    );
    this.deviceQuat = q;
    this.hasDevice = true;
    if (!this.calib) this.calib = q.clone();
    this.deviceRel.copy(this.calib).invert().multiply(q);
  }

  setMoveInput(x, y) {
    this.moveInput.set(x || 0, y || 0);
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!on) {
      this.keys.clear();
      this.moveInput.set(0, 0);
      this.dragging = false;
    }
  }

  recenter() {
    if (this.deviceQuat) this.calib = this.deviceQuat.clone();
    else this.calib = null;
    this.deviceRel.identity();
    this.hasDevice = false;
    _euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.pitch = THREE.MathUtils.clamp(_euler.x, -1.32, 1.32);
    this.yaw = _euler.y;
  }

  async enableGyro() {
    if (this.gyroEnabled) return true;
    try {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') return false;
      }
    } catch (_) {
      return false;
    }
    this.gyroEnabled = true;
    this.calib = null;
    this.hasDevice = false;
    return true;
  }

  async setStereo(on) {
    this.stereo = !!on;
    document.body.classList.toggle('vr', this.stereo);
    if (this.stereo) {
      this.recenter();
      await this.enableGyro();
    } else {
      this.gyroEnabled = false;
    }
    this.resize();
    return this.stereo;
  }

  pick() {
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    let best = null;
    for (const it of this.interactables) {
      _v2.copy(it.anchor).sub(this.camera.position);
      const dist = _v2.length();
      if (dist > it.range) continue;
      _v2.normalize();
      const dot = _v2.dot(_v1);
      if (dot < it.cone) continue;
      const score = dot * 2.4 - dist / it.range;
      if (!best || score > best.score) {
        best = { id: it.id, label: it.label, distance: dist, score };
      }
    }
    return best;
  }

  distanceTo(id) {
    const it = this.interactables.find((i) => i.id === id);
    if (!it) return Infinity;
    return Math.hypot(it.anchor.x - this.player.x, it.anchor.z - this.player.z);
  }

  getAnchor(id) {
    const it = this.interactables.find((i) => i.id === id);
    return it ? it.anchor : null;
  }

  setObjectiveState(id, state) {
    this.objectiveStates[id] = state;
    const b = this.beacons.get(id);
    if (!b) return;
    const show = state === 'active' || state === 'pending';
    b.group.visible = show;
    if (!show) return;
    const color = state === 'active' ? 0xffd166 : b.color;
    b.ringMat.color.setHex(color);
    b.beamMat.color.setHex(color);
    b.diamondMat.uniforms.uColor.value.setHex(color);
    b.label.visible = true;
  }

  deployDome() {
    this.domeTarget = 1;
  }

  collectSample() {
    if (this.sampleCollected) return;
    this.sampleCollected = true;
    this.sampleAnim = 0.0001;
  }

  setDrill(active, progress = 0) {
    this.drillActive = !!active;
    this.drillProgress = clamp01(progress);
    this.drill.holeRing.material.opacity = this.drillProgress > 0.9 ? 0.7 : this.drillProgress * 0.5;
  }

  setSolarAligned(on) {
    this.solarAligned = !!on;
    if (on) this.solar.statusMat.color.setHex(0x5dff9a);
  }

  setAntennaAligned(on) {
    this.antennaAligned = !!on;
  }

  setStorm(level) {
    this.stormTarget = clamp01(level);
  }

  shakeCamera(amount) {
    this.shake = Math.max(this.shake, amount);
  }

  impactBurst(pos) {
    const x = pos && typeof pos.x === 'number' ? pos.x : 0;
    const z = pos && typeof pos.z === 'number' ? pos.z : 0;
    const y = this.heightAt(x, z);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.95, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffbf6a,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.14, z);
    this.scene.add(ring);
    const light = new THREE.PointLight(0xffa040, 40, 45, 2);
    light.position.set(x, y + 3.5, z);
    this.scene.add(light);
    this.bursts.push({ ring, light, t: 0 });
    this.shake = Math.max(this.shake, 0.55);
  }

  getHeading() {
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    let deg = (Math.atan2(_v1.x, -_v1.z) * 180) / Math.PI;
    deg = (deg + 360) % 360;
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return { deg, cardinal: cardinals[Math.round(deg / 45) % 8] };
  }

  getMinimapData() {
    const objectives = [];
    for (const [id, b] of this.beacons) {
      const state = this.objectiveStates[id];
      if (!state || state === 'hidden' || state === 'done') continue;
      objectives.push({
        id,
        x: b.group.position.x,
        z: b.group.position.z,
        active: state === 'active',
      });
    }
    return {
      player: { x: this.player.x, z: this.player.z, heading: this.getHeading().deg },
      rover: { x: this.rover.root.position.x, z: this.rover.root.position.z },
      dome: { x: 10, z: -8 },
      objectives,
      boundary: 27,
    };
  }

  getDomeProgress() {
    return this.domeProgress;
  }
}
