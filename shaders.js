// shaders.js — Texturas PBR Procedurais, Shaders Atmosféricos e UI Holográfica
window.WelwitschiaShaders = (() => {
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

  // Gera par Albedo + Bump/Normal procedural para o regolito lunar
  function createLunarRegolithTextures() {
    const size = 512;
    const colCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    colCanvas.width = bumpCanvas.width = size;
    colCanvas.height = bumpCanvas.height = size;

    const cCtx = colCanvas.getContext('2d');
    const bCtx = bumpCanvas.getContext('2d');

    const cImg = cCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const n1 = fbm(x * 0.04, y * 0.04, 4);
        const n2 = fbm(x * 0.18, y * 0.18, 3);
        const grit = hash(x, y) * 0.18;
        const h = Math.min(1, Math.max(0, n1 * 0.55 + n2 * 0.3 + grit));

        // Tom cinza-mineral quente sob luz solar intensa
        const base = 115 + h * 95;
        cImg.data[idx] = base * 1.02;
        cImg.data[idx + 1] = base * 1.00;
        cImg.data[idx + 2] = base * 0.96;
        cImg.data[idx + 3] = 255;

        const bVal = h * 255;
        bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bVal;
        bImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    // Adiciona micro-crateras
    for (let i = 0; i < 160; i++) {
      const cx = Math.random() * size, cy = Math.random() * size;
      const r = 2 + Math.random() * 14;
      const grad = bCtx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      grad.addColorStop(0, 'rgba(20,20,20,0.55)');
      grad.addColorStop(0.75, 'rgba(240,240,240,0.35)');
      grad.addColorStop(1, 'rgba(128,128,128,0)');
      bCtx.fillStyle = grad;
      bCtx.beginPath();
      bCtx.arc(cx, cy, r, 0, Math.PI * 2);
      bCtx.fill();
    }

    const map = new THREE.CanvasTexture(colCanvas);
    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    [map, bumpMap].forEach(t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(48, 48);
      t.anisotropy = 4;
    });
    return { map, bumpMap };
  }

  // Folha térmica dourada Kapton (estilo módulos lunares NASA)
  function createKaptonGoldTexture() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#d4941e';
    g.fillRect(0, 0, size, size);

    for (let i = 0; i < 450; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const w = 6 + Math.random() * 24, h = 4 + Math.random() * 18;
      g.fillStyle = i % 2 === 0 ? 'rgba(255, 224, 115, 0.25)' : 'rgba(120, 65, 5, 0.28)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w, y + (Math.random() - 0.5) * 10);
      g.lineTo(x + w * 0.5, y + h);
      g.closePath();
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Painel Solar Fotovoltaico Azul-Cobalto Vivo com células e barramentos prateados
  function createSolarPanelTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');

    const bg = g.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#0a2472');
    bg.addColorStop(0.5, '#1246b5');
    bg.addColorStop(1, '#071952');
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);

    const step = 64;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        g.strokeStyle = '#6ec6ff';
        g.lineWidth = 2;
        g.strokeRect(x + 2, y + 2, step - 4, step - 4);
        // Linhas finas de captação
        g.strokeStyle = 'rgba(180, 225, 255, 0.28)';
        g.lineWidth = 1;
        for (let k = 12; k < step; k += 12) {
          g.beginPath();
          g.moveTo(x + k, y + 2);
          g.lineTo(x + k, y + step - 2);
          g.stroke();
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  // Textura da Terra com destaque para África / Angola e nuvens vivas
  function createEarthTexture() {
    const w = 512, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');

    // Oceano azul profundo vivo
    const ocean = g.createLinearGradient(0, 0, 0, h);
    ocean.addColorStop(0, '#1e64c8');
    ocean.addColorStop(0.5, '#0f4c9c');
    ocean.addColorStop(1, '#1e64c8');
    g.fillStyle = ocean;
    g.fillRect(0, 0, w, h);

    // Continentes estilizados (com África bem visível no centro)
    g.fillStyle = '#388e3c';
    // África
    g.beginPath();
    g.ellipse(w * 0.52, h * 0.54, 34, 52, -0.15, 0, Math.PI * 2);
    g.fill();
    // Deserto do Namibe / Sahara em tons dourados
    g.fillStyle = '#d4a359';
    g.beginPath();
    g.ellipse(w * 0.51, h * 0.38, 26, 15, 0, 0, Math.PI * 2);
    g.ellipse(w * 0.52, h * 0.72, 12, 16, 0, 0, Math.PI * 2);
    g.fill();

    // Europa / Ásia / Américas
    g.fillStyle = '#2e7d32';
    g.beginPath();
    g.ellipse(w * 0.65, h * 0.30, 55, 25, 0.1, 0, Math.PI * 2);
    g.ellipse(w * 0.25, h * 0.45, 28, 48, 0.2, 0, Math.PI * 2);
    g.fill();

    // Calotas polares
    g.fillStyle = '#f4f8ff';
    g.fillRect(0, 0, w, 16);
    g.fillRect(0, h - 16, w, 16);

    // Nuvens atmosféricas
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255, 255, 255, ${0.18 + Math.random() * 0.32})`;
      g.beginPath();
      g.ellipse(Math.random() * w, 20 + Math.random() * (h - 40), 12 + Math.random() * 35, 3 + Math.random() * 7, 0.1, 0, Math.PI * 2);
      g.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  // Shader Fresnel para o brilho azul atmosférico da Terra
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
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
          gl_FragColor = vec4(0.32, 0.68, 1.0, 1.0) * intensity * 1.4;
        }
      `
    });
  }

  // Emblema Oficial da Missão: WELWITSCHIA LUNAR — ANGOLA / ARTEMIS
  function createMissionEmblemTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');

    // Fundo escudo espacial
    g.fillStyle = '#07112b';
    g.fillRect(0, 0, 512, 512);

    // Anel exterior dourado e vermelho/preto (cores de Angola)
    g.lineWidth = 18;
    g.strokeStyle = '#ce1126'; // Vermelho Angola
    g.beginPath(); g.arc(256, 256, 226, Math.PI, Math.PI * 2); g.stroke();
    g.strokeStyle = '#111111'; // Preto Angola
    g.beginPath(); g.arc(256, 256, 226, 0, Math.PI); g.stroke();

    g.lineWidth = 6;
    g.strokeStyle = '#ffcb05'; // Dourado Estrela/Sol
    g.beginPath(); g.arc(256, 256, 214, 0, Math.PI * 2); g.stroke();

    // Superfície lunar na base do emblema
    g.fillStyle = '#8b95a8';
    g.beginPath(); g.arc(256, 460, 230, Math.PI, Math.PI * 2); g.fill();

    // Planta Welwitschia estilizada em verde vivo brotando na Lua
    g.strokeStyle = '#5ce65c';
    g.lineWidth = 14;
    g.lineCap = 'round';
    [-1, 1].forEach(dir => {
      g.beginPath();
      g.moveTo(256, 275);
      g.bezierCurveTo(256 + dir * 70, 220, 256 + dir * 130, 260, 256 + dir * 155, 310);
      g.stroke();
    });

    // Trajetória Artemis (A) rumo às estrelas
    g.strokeStyle = '#00e5ff';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(175, 295);
    g.lineTo(256, 125);
    g.lineTo(337, 295);
    g.stroke();

    // Textos
    g.fillStyle = '#ffffff';
    g.font = 'bold 30px sans-serif';
    g.textAlign = 'center';
    g.fillText('WELWITSCHIA LUNAR', 256, 95);
    g.fillStyle = '#ffcb05';
    g.font = 'bold 22px sans-serif';
    g.fillText('ANGOLA • ARTEMIS 2026', 256, 415);

    return new THREE.CanvasTexture(c);
  }

  // Gera textura dinâmica para os ecrãs holográficos dos 4 módulos
  function createHoloScreenCanvas(title, colorHex) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 320;
    const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);

    function render(level, statusText) {
      g.clearRect(0, 0, 512, 320);
      // Fundo holográfico translúcido
      g.fillStyle = 'rgba(6, 18, 44, 0.86)';
      g.fillRect(8, 8, 496, 304);

      g.strokeStyle = colorHex;
      g.lineWidth = 6;
      g.strokeRect(8, 8, 496, 304);

      // Cabeçalho
      g.fillStyle = colorHex;
      g.fillRect(8, 8, 496, 56);
      g.fillStyle = '#04091a';
      g.font = 'bold 28px sans-serif';
      g.textAlign = 'center';
      g.fillText(title.toUpperCase(), 256, 46);

      // Barras de potência (Níveis 1, 2, 3)
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

      // Estado inferior
      g.fillStyle = '#ffffff';
      g.font = 'bold 24px sans-serif';
      g.fillText(statusText || `POTÊNCIA ATIVA: NÍVEL ${level}/3`, 256, 245);
      g.fillStyle = '#a8c7fa';
      g.font = '18px sans-serif';
      g.fillText('OLHA AQUI PARA ALTERAR ENERGIA', 256, 282);

      tex.needsUpdate = true;
    }

    render(0, 'SISTEMA EM ESPERA');
    return { texture: tex, update: render };
  }

  return {
    fbm,
    createLunarRegolithTextures,
    createKaptonGoldTexture,
    createSolarPanelTexture,
    createEarthTexture,
    createAtmosphereMaterial,
    createMissionEmblemTexture,
    createHoloScreenCanvas
  };
})();
