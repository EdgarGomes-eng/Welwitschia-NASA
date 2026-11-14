<!doctype html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#050814">
  <link rel="manifest" href="./manifest.json">
  <title>Welwitschia Lunar — Imersão VR em Primeira Pessoa</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; font-family: 'Segoe UI', system-ui, sans-serif; }
    
    #canvas-container {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      touch-action: none;
    }

    /* Moldura sutil do visor do capacete de astronauta para imersão periférica */
    #helmet-visor {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      display: none;
      background: radial-gradient(
        ellipse 82% 78% at 50% 50%,
        transparent 62%,
        rgba(8, 18, 42, 0.35) 82%,
        rgba(3, 7, 18, 0.92) 100%
      );
      box-shadow: inset 0 0 65px rgba(0, 229, 255, 0.18);
    }

    #vr-overlay {
      position: fixed; inset: 0; z-index: 20;
      background: radial-gradient(circle at center, rgba(14, 28, 68, 0.88) 0%, rgba(2, 4, 12, 0.98) 100%);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 24px; color: #fff; transition: opacity 0.4s ease;
    }
    #vr-overlay.hidden { opacity: 0; pointer-events: none; }
    .badge {
      background: rgba(255, 184, 77, 0.16); border: 1px solid #ffb84d; color: #ffd27a;
      padding: 6px 14px; border-radius: 99px; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 14px;
    }
    h1 { font-size: clamp(26px, 5vw, 42px); font-weight: 800; letter-spacing: 1px; color: #fff; text-shadow: 0 0 24px rgba(79, 227, 255, 0.5); }
    .subtitle { color: #b8d4ff; font-size: 15px; max-width: 480px; margin: 12px 0 26px; line-height: 1.5; }
    button {
      border: none; border-radius: 14px; padding: 16px 32px; font-size: 16px; font-weight: 700;
      cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    button:active { transform: scale(0.96); }
    #btn-enter {
      background: linear-gradient(135deg, #00d2ff 0%, #2a5cff 100%); color: #fff;
      box-shadow: 0 8px 30px rgba(42, 92, 255, 0.55);
    }
    #top-controls {
      position: fixed; top: 12px; right: 12px; z-index: 15; display: none; gap: 8px;
    }
    .mini-btn {
      background: rgba(10, 15, 30, 0.78); color: #fff; border: 1px solid rgba(255,255,255,0.28);
      padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 600;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
</head>
<body>
  <div id="canvas-container"></div>
  <div id="helmet-visor"></div>

  <div id="vr-overlay">
    <div class="badge">NASA Space Apps Challenge 2026 • Angola</div>
    <h1>WELWITSCHIA LUNAR</h1>
    <p class="subtitle">Experiência Imersiva em Primeira Pessoa (FOV 98°). Vira a cabeça ou desliza o ecrã para explorar a base lunar e gerir os sistemas em tempo real!</p>
    <button id="btn-enter" type="button">🚀 Entrar no Capacete Espacial (VR 360°)</button>
  </div>

  <div id="top-controls">
    <button id="btn-mute" class="mini-btn" type="button">🔊 Som</button>
    <button id="btn-exit" class="mini-btn" type="button">Menu</button>
  </div>

  <script src="./shaders.js"></script>
  <script src="./scene.js"></script>
  <script src="./game.js"></script>
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  </script>
</body>
</html>
