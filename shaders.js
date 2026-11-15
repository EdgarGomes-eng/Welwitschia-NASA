// shaders.js — Texturas PBR Procedurais de Alta Resolução, Shaders Astronómicos e UI Holográfica
// 100% Offline-First: Sem dependências externas de imagens, otimizado para Web Mobile VR & 360°
window.WelwitschiaShaders = (() => {
  // --- FUNÇÕES MATEMÁTICAS & RUÍDO PROCEDURAL ---
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };

  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return hash(xi, yi) * (1 - u) * (1 - v) +
           hash(xi + 1, yi) * u * (1 - v) +
           hash(xi, yi + 1) * (1 - u) * v +
           hash(xi + 1, yi + 1) * u * v;
  };

  const fbm = (x, y, octaves = 4) => {
    let val = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += amp * noise(x * freq, y * freq);
      freq *= 2.02;
      amp *= 0.5;
    }
    return val;
  };

  // Simplex 2D implementation para perturbação de rochas e relevo orgânico
  const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
  const grad3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];
  const p = [
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
    8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
    35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
    134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
    55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
    18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,
    250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
    189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,
    172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
    228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
    107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
    138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
  ];
  const perm = new Array(512);
  const permMod12 = new Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }

  function simplex2D(xin, yin) {
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = xin - X0, y0 = yin - Y0;

    let i1 = 0, j1 = 0;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255, jj = j & 255;
    const gi0 = permMod12[ii + perm[jj]];
    const gi1 = permMod12[ii + i1 + perm[jj + j1]];
    const gi2 = permMod12[ii + 1 + perm[jj + 1]];

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2); }
    return 70.0 * (n0 + n1 + n2);
  }

  // --- TEXTURAS PROCEDURAIS DO REGOLITO LUNAR (MULTI-CAMADAS PBR) ---
  function createHighResRegolithBumpMap() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const grain = (Math.random() - 0.5) * 55;
      const val = Math.min(255, Math.max(0, 128 + grain));
      data[i] = data[i + 1] = data[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);

    // Micro-crateras de impacto distribuídas
    for (let c = 0; c < 380; c++) {
      const cx = Math.random() * size, cy = Math.random() * size;
      const cr = 2 + Math.random() * 11;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      grad.addColorStop(0, '#282828');
      grad.addColorStop(0.65, '#5a5a5a');
      grad.addColorStop(0.9, '#a8a8a8');
      grad.addColorStop(1, '#808080');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    return tex;
  }

  function createHighResRegolithNormalMap() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Vetor Normal base apontando para Z: RGB(128, 128, 255)
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const nx = (Math.random() - 0.5) * 40;
      const ny = (Math.random() - 0.5) * 40;
      data[i] = Math.min(255, Math.max(0, 128 + nx));
      data[i + 1] = Math.min(255, Math.max(0, 128 + ny));
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    // Gradientes normais de micro-crateras para sombras nítidas sob luz rasante
    for (let c = 0; c < 280; c++) {
      const cx = Math.random() * size, cy = Math.random() * size;
      const cr = 3 + Math.random() * 12;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      grad.addColorStop(0, '#5050ff');
      grad.addColorStop(0.5, '#7070ff');
      grad.addColorStop(0.9, '#a090ff');
      grad.addColorStop(1, '#8080ff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    return tex;
  }

  function createHighResRegolithRoughnessMap() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e2e2e2';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = 220 + (Math.random() - 0.5) * 45;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(30, 30);
    return tex;
  }

  function createLunarRegolithTextures() {
    const size = 512;
    const colCanvas = document.createElement('canvas');
    colCanvas.width = colCanvas.height = size;
    const cCtx = colCanvas.getContext('2d');
    const cImg = cCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const n1 = fbm(x * 0.04, y * 0.04, 4);
        const n2 = fbm(x * 0.18, y * 0.18, 3);
        const grit = hash(x, y) * 0.18;
        const h = Math.min(1, Math.max(0, n1 * 0.55 + n2 * 0.3 + grit));
        const base = 108 + h * 90;
        cImg.data[idx] = base * 1.02;
        cImg.data[idx + 1] = base * 1.00;
        cImg.data[idx + 2] = base * 0.97;
        cImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);

    const map = new THREE.CanvasTexture(colCanvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(40, 40);
    map.anisotropy = 4;

    const bumpMap = createHighResRegolithBumpMap();
    const normalMap = createHighResRegolithNormalMap();
    const roughnessMap = createHighResRegolithRoughnessMap();

    return { map, bumpMap, normalMap, roughnessMap };
  }

  // --- DEPÓSITOS DE GELO CRISTALINO NAS CRATERAS SOMBREADAS ---
  function createIceDepositTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#c7e6ff');
    grad.addColorStop(0.5, '#90c8fe');
    grad.addColorStop(1, '#60a5fa');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Fraturas de gelo lunar
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 45; i++) {
      ctx.beginPath();
      let x = Math.random() * size, y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (Math.random() - 0.5) * 80;
        y += (Math.random() - 0.5) * 80;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  // --- FOLHA TÉRMICA DOURADA MLI (MULTI-LAYER INSULATION KAPTON) ---
  function createKaptonGoldTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');

    g.fillStyle = '#c58b1a';
    g.fillRect(0, 0, size, size);

    // Amassados e dobras típicas da manta térmica MLI
    for (let i = 0; i < 750; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const w = 8 + Math.random() * 32, h = 6 + Math.random() * 24;
      g.fillStyle = i % 2 === 0 ? 'rgba(255, 232, 135, 0.35)' : 'rgba(110, 55, 5, 0.32)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w, y + (Math.random() - 0.5) * 12);
      g.lineTo(x + w * 0.5, y + h);
      g.closePath();
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // --- PAINÉIS SOLARES FOTOVOLTAICOS ARTEMIS ---
  function createSolarPanelTexture(dusty = false) {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');

    const bg = g.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, dusty ? '#273444' : '#081c4e');
    bg.addColorStop(0.5, dusty ? '#2f3e52' : '#0e368a');
    bg.addColorStop(1, dusty ? '#1d2733' : '#06153d');
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);

    const step = 64;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        g.strokeStyle = dusty ? '#627284' : '#d4af37';
        g.lineWidth = 2;
        g.strokeRect(x + 2, y + 2, step - 4, step - 4);

        g.strokeStyle = dusty ? 'rgba(160, 175, 195, 0.25)' : 'rgba(180, 225, 255, 0.32)';
        g.lineWidth = 1;
        for (let k = 12; k < step; k += 12) {
          g.beginPath();
          g.moveTo(x + k, y + 2);
          g.lineTo(x + k, y + step - 2);
          g.stroke();
        }
      }
    }

    if (dusty) {
      g.fillStyle = 'rgba(125, 130, 140, 0.55)';
      g.fillRect(0, 0, size, size);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  // --- PLANETA TERRA NA PERSPECTIVA LUNAR (DIURNO + NOTURNO COM LUZES DE CIDADES) ---
  function createEarthDayTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 1. Oceanos azuis profundos
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
    oceanGrad.addColorStop(0, '#092540');
    oceanGrad.addColorStop(0.3, '#104e7c');
    oceanGrad.addColorStop(0.7, '#0c3858');
    oceanGrad.addColorStop(1, '#061d31');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // Plataformas continentais rasas (turquesa)
    ctx.fillStyle = 'rgba(32, 178, 170, 0.32)';
    const drawShallows = (cx, cy, w, h) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    drawShallows(520, 260, 110, 135);
    drawShallows(720, 180, 155, 120);
    drawShallows(260, 190, 105, 100);
    drawShallows(330, 350, 85, 125);

    // Continentes procedurais estilizados
    const drawContinent = (cx, cy, w, h, seed) => {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.12) {
        const rOffset = Math.sin(a * 5 + seed) * 18 + Math.cos(a * 9 + seed) * 10;
        const rx = (w / 2 + rOffset) * Math.cos(a);
        const ry = (h / 2 + rOffset) * Math.sin(a);
        const px = cx + rx;
        const py = cy + ry;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    };

    // África & Angola
    ctx.fillStyle = '#2d5a27';
    drawContinent(520, 260, 185, 235, 1.2);
    ctx.fillStyle = '#bfa15f'; // Deserto do Namibe e Saara
    drawContinent(515, 210, 135, 85, 2.1);
    drawContinent(535, 330, 60, 65, 1.8);

    // Eurásia
    ctx.fillStyle = '#345e39';
    drawContinent(720, 180, 265, 205, 2.7);

    // Américas
    ctx.fillStyle = '#2b522c';
    drawContinent(260, 190, 175, 165, 3.5);
    drawContinent(330, 350, 135, 215, 4.1);

    // Austrália
    ctx.fillStyle = '#a0522d';
    drawContinent(840, 370, 105, 80, 5.3);

    // Calotas Polares
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 1024, 38);
    ctx.fillRect(0, 474, 1024, 38);

    // Faixas de nuvens realistas
    ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
    for (let y = 45; y < 465; y += 38) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 25) {
        const ny = y + Math.sin(x * 0.02 + y * 0.05) * 22 + Math.cos(x * 0.045) * 15;
        ctx.lineTo(x, ny);
      }
      ctx.lineTo(1024, y + 22);
      ctx.lineTo(0, y + 22);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function createEarthNightTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#020409';
    ctx.fillRect(0, 0, 1024, 512);

    // Luzes de cidades noturnas
    const drawCityLights = (cx, cy, count, radius) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 0.5) * radius;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const intensity = Math.random() * 0.8 + 0.2;
        ctx.fillStyle = `rgba(255, 215, 125, ${intensity})`;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    };

    drawCityLights(500, 170, 220, 52); // Europa
    drawCityLights(270, 180, 260, 62); // América do Norte
    drawCityLights(780, 210, 300, 72); // Ásia
    drawCityLights(530, 360, 90, 32);  // África Austral / Angola
    drawCityLights(340, 370, 95, 36);  // América do Sul

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function createAtmosphereMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.70 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.6);
          vec3 atmoColor = vec3(0.22, 0.62, 1.0);
          gl_FragColor = vec4(atmoColor, intensity * 0.82);
        }
      `
    });
  }

  // Compatibilidade com texturas legadas
  function createEarthTexture() {
    return createEarthDayTexture();
  }

  // --- EMBLEMA DA ESTAÇÃO WELWITSCHIA ARTEMIS 2032 ---
  function createWelwitschiaEmblemTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 492, 236);

    // Silhueta estilizada das duas folhas perenes da Welwitschia
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(256, 175);
    ctx.bezierCurveTo(200, 142, 120, 162, 80, 122);
    ctx.bezierCurveTo(110, 102, 180, 112, 240, 152);
    ctx.moveTo(256, 175);
    ctx.bezierCurveTo(312, 142, 392, 162, 432, 122);
    ctx.bezierCurveTo(402, 102, 332, 112, 272, 152);
    ctx.fill();

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText('ESTAÇÃO WELWITSCHIA 2032', 256, 62);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('CRATERA SHACKLETON • POLO SUL LUNAR', 256, 218);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  function createMissionEmblemTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');

    g.fillStyle = '#060d24';
    g.fillRect(0, 0, 512, 512);

    g.lineWidth = 18;
    g.strokeStyle = '#ce1126';
    g.beginPath(); g.arc(256, 256, 226, Math.PI, Math.PI * 2); g.stroke();
    g.strokeStyle = '#111111';
    g.beginPath(); g.arc(256, 256, 226, 0, Math.PI); g.stroke();

    g.lineWidth = 6;
    g.strokeStyle = '#ffcb05';
    g.beginPath(); g.arc(256, 256, 214, 0, Math.PI * 2); g.stroke();

    g.fillStyle = '#7a859b';
    g.beginPath(); g.arc(256, 460, 230, Math.PI, Math.PI * 2); g.fill();

    g.strokeStyle = '#5ce65c';
    g.lineWidth = 14;
    g.lineCap = 'round';
    [-1, 1].forEach(dir => {
      g.beginPath();
      g.moveTo(256, 275);
      g.bezierCurveTo(256 + dir * 70, 220, 256 + dir * 130, 260, 256 + dir * 155, 310);
      g.stroke();
    });

    g.strokeStyle = '#00e5ff';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(175, 295);
    g.lineTo(256, 125);
    g.lineTo(337, 295);
    g.stroke();

    g.fillStyle = '#ffffff';
    g.font = 'bold 30px sans-serif';
    g.textAlign = 'center';
    g.fillText('WELWITSCHIA LUNAR', 256, 95);
    g.fillStyle = '#ffcb05';
    g.font = 'bold 22px sans-serif';
    g.fillText('ANGOLA • ARTEMIS 2032', 256, 415);

    return new THREE.CanvasTexture(c);
  }

  // --- ECRÃS HOLOGRÁFICOS INTERATIVOS DOS MÓDULOS ---
  function createHoloScreenCanvas(title, colorHex) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 320;
    const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);

    function render(level, statusText) {
      g.clearRect(0, 0, 512, 320);
      g.fillStyle = 'rgba(5, 14, 36, 0.92)';
      g.fillRect(8, 8, 496, 304);

      g.strokeStyle = colorHex;
      g.lineWidth = 6;
      g.strokeRect(8, 8, 496, 304);

      g.fillStyle = colorHex;
      g.fillRect(8, 8, 496, 56);
      g.fillStyle = '#04091a';
      g.font = 'bold 28px sans-serif';
      g.textAlign = 'center';
      g.fillText(title.toUpperCase(), 256, 46);

      for (let i = 0; i < 3; i++) {
        const bx = 56 + i * 140;
        g.fillStyle = i < level ? colorHex : 'rgba(255,255,255,0.12)';
        g.fillRect(bx, 95, 118, 95);
        g.strokeStyle = colorHex;
        g.lineWidth = 3;
        g.strokeRect(bx, 95, 118, 95);

        g.fillStyle = i < level ? '#04091a' : '#8aa4cc';
        g.font = 'bold 26px sans-serif';
        g.fillText(`NV ${i + 1}`, bx + 59, 152);
      }

      g.fillStyle = '#ffffff';
      g.font = 'bold 24px sans-serif';
      g.fillText(statusText || `POTÊNCIA ATIVA: NÍVEL ${level}/3`, 256, 245);
      g.fillStyle = '#a8c7fa';
      g.font = '18px sans-serif';
      g.fillText('OLHA OU TOCA PARA ALTERAR ENERGIA', 256, 282);

      tex.needsUpdate = true;
    }

    render(0, 'SISTEMA EM ESPERA');
    return { texture: tex, update: render };
  }

  return {
    fbm,
    simplex2D,
    createHighResRegolithBumpMap,
    createHighResRegolithNormalMap,
    createHighResRegolithRoughnessMap,
    createLunarRegolithTextures,
    createIceDepositTexture,
    createKaptonGoldTexture,
    createSolarPanelTexture,
    createEarthDayTexture,
    createEarthNightTexture,
    createEarthTexture,
    createAtmosphereMaterial,
    createWelwitschiaEmblemTexture,
    createMissionEmblemTexture,
    createHoloScreenCanvas
  };
})();
