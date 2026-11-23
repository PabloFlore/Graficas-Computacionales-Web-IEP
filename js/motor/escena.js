import * as THREE from 'three';
import { crearEstructura } from './piramide.js';
import { crearPato } from './pato.js';
import { crearExplosion } from './explosion.js';
import { crearSistemaColeccionables } from './coleccionables.js';

const INICIO_POR_ESCENARIO = {
  piramide: { x: 0, z: 10 },
  torre:    { x: 5, z: 0 },
  islas:    { x: -10, z: 4 },
};

const FONDO_POR_ESCENARIO = {
  piramide: '#6cc0f0',
  torre:    '#ff9d3d',
  islas:    '#b8d4e0',
};

const RANGO_POR_ESCENARIO = {
  piramide: 10,
  torre: 5,
  islas: 14,
};

const NIVEL_MAXIMO_POR_ESCENARIO = { piramide: 11, torre: 14, islas: 11 };

const INTERVALO_MINAS  = { facil: 2.0, normal: 1.2, dificil: 0.6 };
const CAP_MINAS_PCT    = { facil: 0.25, normal: 0.45, dificil: 0.65 };
const INTERVALO_ITEMS          = 1.5;
const MIN_ITEMS_POR_CUADRANTE  = 5;
const CUADRANTES = [[1,1],[-1,1],[-1,-1],[1,-1]];

function lerp(a, b, t) { return a + (b - a) * t; }

export async function iniciarEscena({ alMoverJugador, alGanar } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const vistaJuego = document.getElementById('vista-juego');
  vistaJuego.insertBefore(renderer.domElement, vistaJuego.firstChild);

  /* ---------- Luces ---------- */
  const luzAmbiental = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(luzAmbiental);
  const sol = new THREE.DirectionalLight(0xffffff, 1.2);
  sol.position.set(10, 12, 10);
  scene.add(sol);

  /* ---------- Estructura inicial ---------- */
  let estructura = crearEstructura(scene, 'piramide');
  let alturaFn = estructura.alturaFn;
  let escenarioActual = 'piramide';
  let elevacion = estructura.elevacion || 0;

  /* Altura visible real: en pirámide se limita al nivel máximo revelado */
  function alturaEfectiva(ix, iz) {
    if (escenarioActual !== 'piramide') return alturaFn(ix, iz);
    return Math.min(alturaFn(ix, iz), estructura.nivelMaxVisible);
  }

  function yMundo(ix, iz) { return alturaEfectiva(ix, iz) * 2 - 1 + elevacion * 2; }

  /* ---------- Jugador ---------- */
  let celdaX = 0;
  let celdaZ = 5;

  let camAngle  = Math.atan2(celdaZ, celdaX);
  let camTarget = camAngle;
  let patoRotTarget = Math.PI / 2;

  // Punto de seguimiento suavizado — ignora el arco vertical del salto
  let camLookX = celdaX * 2;
  let camLookZ = celdaZ * 2;
  let camLookY = yMundo(celdaX, celdaZ);

  /* ---------- Estado del juego ---------- */
  let vidas = 3;
  let score = 0;
  let racha = 0;
  let muerto = false;
  let patoColor = 0xffd45e;
  let patoOjoColor = 0x1a1a2e;
  let dificultadActual = 'normal';

  /* ---------- Saciedad ---------- */
  const SACIEDAD_MAX = 30;
  let saciedad      = 0;
  let satisfecho    = false;
  let nubeCima      = null;
  let nubeCimaBaseY = 0;
  let nubeCimaT     = 0;

  /* ---------- Jugador (grupo) ---------- */
  const jugador = new THREE.Group();
  const bob = new THREE.Group();
  jugador.add(bob);
  scene.add(jugador);
  jugador.position.set(celdaX * 2, yMundo(celdaX, celdaZ), celdaZ * 2);

  /* ---------- Pato ---------- */
  let pato = crearPato(patoColor, patoOjoColor);
  pato.position.y = 1;
  pato.scale.setScalar(1.4);
  bob.add(pato);

  /* ---------- Animación de bob ---------- */
  const reloj = new THREE.Clock();
  const mixers = [];

  const mixerBob = new THREE.AnimationMixer(bob);
  mixers.push(mixerBob);
  const pistaBob = new THREE.NumberKeyframeTrack('.position[y]', [0, 0.5, 1.0], [0.5, 0.58, 0.5]);
  const clipBob = new THREE.AnimationClip('espera', 1.0, [pistaBob]);
  mixerBob.clipAction(clipBob).setLoop(THREE.LoopRepeat).play();

  /* ---------- Salto en arco ---------- */
  let saltando = false;
  let saltoT = 0;
  const DURACION_SALTO = 0.45;
  const ALTURA_ARCO = 2.4;
  let saltoDesde = { x: 0, y: 0, z: 0 };
  let saltoHasta = { x: 0, y: 0, z: 0 };

  /* ---------- Explosión actual ---------- */
  let explosionActual = null;

  /* ---------- Coleccionables ---------- */
  let coleccionables = crearSistemaColeccionables(scene, alturaFn, RANGO_POR_ESCENARIO[escenarioActual]);

  /* ---------- Ticks de minas e items ---------- */
  let minaTick = 0;
  let itemTick  = 0;

  /* nubeCima se crea después de que las funciones auxiliares estén definidas */

  /* ---------- Métricas de rendimiento ---------- */
  const divStats = document.createElement('div');
  divStats.id = 'perf-stats';
  divStats.style.cssText = [
    'position:fixed', 'bottom:8px', 'right:8px',
    'background:rgba(0,0,0,0.55)', 'color:#0f0', 'font:11px/1.5 monospace',
    'padding:5px 8px', 'border-radius:4px', 'pointer-events:none',
    'z-index:9999', 'display:none',
  ].join(';');
  document.body.appendChild(divStats);

  let _perfFrames = 0;
  let _perfAcum   = 0;
  let _perfFPS    = 0;

  function actualizarStats(delta) {
    _perfFrames++;
    _perfAcum += delta;
    if (_perfAcum >= 0.5) {
      _perfFPS = Math.round(_perfFrames / _perfAcum);
      _perfFrames = 0;
      _perfAcum   = 0;
      const r = renderer.info.render;
      const m = renderer.info.memory;
      divStats.textContent =
        `FPS: ${_perfFPS}\n` +
        `Draws: ${r.calls}\n` +
        `Tris: ${(r.triangles / 1000).toFixed(1)}k\n` +
        `Geoms: ${m.geometries}  Tex: ${m.textures}`;
    }
  }

  /* ---------- Cronómetro ---------- */
  let cronometroT = 0;
  let cronometroActivo = false;
  const elTiempo = document.querySelector('.cronometro__tiempo');

  function formatearTiempo(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /* ---------- HUD niveles ---------- */
  const elNivelActual = document.getElementById('hud-nivel-actual');

  function actualizarHUD() {
    const nivelMax = NIVEL_MAXIMO_POR_ESCENARIO[escenarioActual] ?? 11;
    const nivelActual = Math.min(nivelMax, alturaEfectiva(celdaX, celdaZ));
    if (elNivelActual) elNivelActual.textContent = nivelActual;
    const elTotal = document.getElementById('hud-nivel-total');
    if (elTotal) elTotal.textContent = nivelMax;
  }

  /* ---------- HUD vidas ---------- */
  function actualizarVidas() {
    document.querySelectorAll('.corazon').forEach((el, i) => {
      el.classList.toggle('corazon--perdido', i >= vidas);
    });
  }

  /* ---------- HUD score ---------- */
  function actualizarScore() {
    const el = document.getElementById('hud-score');
    if (el) el.textContent = score;
  }

  /* ---------- Nube de la cima ---------- */
  function crearNubeCima() {
    const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true });
    const g = new THREE.Group();
    [
      [0,    0,   0, 2.2, 1.0, 1.4],
      [-1.1, 0.3, 0, 1.4, 0.8, 1.0],
      [ 1.1, 0.3, 0, 1.4, 0.8, 1.0],
    ].forEach(([x, y, z, w, h, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      g.add(m);
    });
    nubeCimaBaseY = alturaFn(0, 0) * 2 - 1 + elevacion * 2 + 4;
    g.position.set(0, nubeCimaBaseY, 0);
    g.visible = false;
    scene.add(g);
    return g;
  }

  /* ---------- Saciedad ---------- */
  function actualizarBarraSaciedad() {
    const el = document.getElementById('hud-saciedad-relleno');
    if (el) el.style.width = `${(saciedad / SACIEDAD_MAX) * 100}%`;
  }

  function actualizarSaciedad(pts) {
    if (satisfecho) return;
    saciedad = Math.min(SACIEDAD_MAX, saciedad + pts);
    actualizarBarraSaciedad();
    if (saciedad >= SACIEDAD_MAX) {
      satisfecho = true;
      if (nubeCima) nubeCima.visible = true;
      const el = document.getElementById('hud-saciedad-relleno');
      if (el) el.classList.add('saciedad__relleno--llena');
    }
  }

  /* ---------- Game Over ---------- */
  function mostrarGameOver() {
    const overlay = document.getElementById('game-over');
    if (!overlay) return;
    const elScore = document.getElementById('go-score');
    const elMejor = document.getElementById('go-mejor');
    if (elScore) elScore.textContent = score;

    const keyMejor = `mejor_${escenarioActual}`;
    const mejor = parseInt(localStorage.getItem(keyMejor) || '0', 10);
    if (score > mejor) localStorage.setItem(keyMejor, score);
    if (elMejor) elMejor.textContent = Math.max(score, mejor);

    overlay.classList.remove('oculto');
  }

  /* ---------- Victoria ---------- */
  function mostrarVictoria() {
    cronometroActivo = false;

    const overlay = document.getElementById('victoria');
    if (!overlay) return;

    const keyMejor = `mejor_${escenarioActual}`;
    const mejor = parseInt(localStorage.getItem(keyMejor) || '0', 10);
    if (score > mejor) localStorage.setItem(keyMejor, score);

    const scoreEl = document.getElementById('victoria-score');
    const tiempoEl = document.getElementById('victoria-tiempo');
    const mejorEl  = document.getElementById('victoria-mejor');
    if (scoreEl)  scoreEl.textContent  = score;
    if (tiempoEl) tiempoEl.textContent = formatearTiempo(cronometroT);
    if (mejorEl)  mejorEl.textContent  = Math.max(score, mejor);

    overlay.hidden = false;

    const nombre = document.getElementById('nombre-jugador')?.value.trim() || 'Pato';
    if (typeof alGanar === 'function') alGanar({ score, tiempo: cronometroT, nombre });
  }

  /* ---------- Respawn ---------- */
  function respawnJugador() {
    muerto = false;
    const inicio = INICIO_POR_ESCENARIO[escenarioActual] || { x: 0, z: 9 };
    celdaX = inicio.x;
    celdaZ = inicio.z;
    saltando = false;
    saltoT = 0;
    jugador.position.set(celdaX * 2, yMundo(celdaX, celdaZ), celdaZ * 2);
    camAngle  = Math.atan2(inicio.z, inicio.x);
    camTarget = camAngle;
    camLookX  = celdaX * 2;
    camLookZ  = celdaZ * 2;
    camLookY  = yMundo(celdaX, celdaZ);
    patoRotTarget = Math.atan2(inicio.z, -inicio.x);
    jugador.rotation.y = patoRotTarget;
    bob.visible = true;
  }

  /* ---------- Color del cronómetro según densidad de minas ---------- */
  function actualizarCronometroColor() {
    if (!elTiempo) return;
    const cap = Math.max(1, Math.floor(estructura.tapasCount * (CAP_MINAS_PCT[dificultadActual] ?? 0.45)));
    const pct = Math.min(1, estructura.minasCount / cap);
    // Blanco → amarillo → naranja → rojo
    let r, g, b;
    if (pct < 0.33) {
      const t = pct / 0.33;
      r = 255; g = Math.round(lerp(255, 200, t)); b = Math.round(lerp(255, 0, t));
    } else if (pct < 0.66) {
      const t = (pct - 0.33) / 0.33;
      r = 255; g = Math.round(lerp(200, 100, t)); b = 0;
    } else {
      const t = (pct - 0.66) / 0.34;
      r = 255; g = Math.round(lerp(100, 30, t)); b = 0;
    }
    elTiempo.style.color = `rgb(${r},${g},${b})`;
  }

  /* ---------- Spawn periódico de minas ---------- */
  function tickMinas(delta) {
    minaTick += delta;
    // Intervalo se reduce conforme pasa el tiempo: se divide a la mitad cada 90 s
    const base = INTERVALO_MINAS[dificultadActual] ?? 1.2;
    const intervaloEfectivo = Math.max(0.3, base / (1 + cronometroT / 90));
    if (minaTick < intervaloEfectivo) return;
    minaTick = 0;

    // No superar el cap de minas por dificultad
    const cap = Math.floor(estructura.tapasCount * (CAP_MINAS_PCT[dificultadActual] ?? 0.45));
    if (estructura.minasCount >= cap) return;

    const nivelMax = NIVEL_MAXIMO_POR_ESCENARIO[escenarioActual];
    const rango    = RANGO_POR_ESCENARIO[escenarioActual];
    // A partir del minuto 1 se añade 1 mina extra por minuto transcurrido
    const cantidad = 1 + Math.floor(cronometroT / 60);

    for (let spawn = 0; spawn < cantidad; spawn++) {
      if (estructura.minasCount >= cap) break; // verificar cap en cada iteración
      for (let i = 0; i < 8; i++) {
        const ix = Math.floor(Math.random() * (rango * 2 + 1)) - rango;
        const iz = Math.floor(Math.random() * (rango * 2 + 1)) - rango;
        const nivel = alturaFn(ix, iz);
        if (nivel <= 0 || nivel >= nivelMax) continue;
        if (Math.random() < nivel / nivelMax) {
          estructura.convertirEnMina(ix, iz);
          break;
        }
      }
    }
  }

  /* ---------- Spawn periódico de items ---------- */
  function preSpawnItems() {
    for (const [qx, qz] of CUADRANTES) {
      for (let i = 0; i < MIN_ITEMS_POR_CUADRANTE; i++) {
        coleccionables.spawnEnCuadrante(qx, qz);
      }
    }
  }

  function tickItems(delta) {
    itemTick += delta;
    if (itemTick < INTERVALO_ITEMS) return;
    itemTick = 0;
    for (const [qx, qz] of CUADRANTES) {
      const faltantes = MIN_ITEMS_POR_CUADRANTE - coleccionables.itemsEnCuadrante(qx, qz);
      for (let i = 0; i < faltantes; i++) coleccionables.spawnEnCuadrante(qx, qz);
    }
  }

  /* ---------- Colisión con mina y expansión de pirámide ---------- */
  function procesarAterrizaje(x, z) {
    const pts = coleccionables.recoger(x, z);
    if (pts !== null) {
      racha++;
      const mult = racha >= 3 ? 2 : 1;
      score += pts * mult;
      actualizarScore();
      actualizarSaciedad(pts);
    } else {
      racha = 0;
    }

    if (estructura.esMina(x, z)) {
      estructura.eliminarCubo(x, z);
      vidas--;
      actualizarVidas();
      muerto = true;
      bob.visible = false;

      saciedad = Math.floor(saciedad / 2);
      if (satisfecho) {
        satisfecho = false;
        if (nubeCima) nubeCima.visible = false;
        const elBar = document.getElementById('hud-saciedad-relleno');
        if (elBar) elBar.classList.remove('saciedad__relleno--llena');
      }
      actualizarBarraSaciedad();

      explosionActual = crearExplosion(scene, jugador.position.clone());

      if (vidas <= 0) {
        setTimeout(() => mostrarGameOver(), 900);
      } else {
        setTimeout(() => respawnJugador(), 900);
      }
      return;
    }

    actualizarHUD();

    /* Victoria: pato llegó al nivel máximo Y está satisfecho */
    if (alturaEfectiva(x, z) >= NIVEL_MAXIMO_POR_ESCENARIO[escenarioActual] && satisfecho) {
      mostrarVictoria();
    }
  }

  /* ---------- Control por teclado ---------- */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'F3') {
      divStats.style.display = divStats.style.display === 'none' ? 'block' : 'none';
      return;
    }
    if (!vistaJuego.classList.contains('activa')) return;
    if (saltando || muerto) return;

    let inputDX = 0, inputDZ = 0;
    const tecla = event.key;
    if (tecla === 'a' || tecla === 'ArrowLeft')  inputDX = -1;
    if (tecla === 'd' || tecla === 'ArrowRight') inputDX =  1;
    if (tecla === 'w' || tecla === 'ArrowUp')    inputDZ = -1;
    if (tecla === 's' || tecla === 'ArrowDown')  inputDZ =  1;

    if (tecla.startsWith('Arrow')) event.preventDefault();
    if (inputDX === 0 && inputDZ === 0) return;

    // Transformar input al espacio de la cámara para que W siempre sea "hacia adelante" en pantalla
    const fwdX = -Math.cos(camAngle);
    const fwdZ = -Math.sin(camAngle);
    const rgtX =  Math.sin(camAngle);
    const rgtZ = -Math.cos(camAngle);
    const worldX = -inputDZ * fwdX + inputDX * rgtX;
    const worldZ = -inputDZ * fwdZ + inputDX * rgtZ;
    const dx = Math.abs(worldX) >= Math.abs(worldZ) ? Math.round(worldX) : 0;
    const dz = Math.abs(worldZ) >  Math.abs(worldX) ? Math.round(worldZ) : 0;

    const nx = celdaX + dx;
    const nz = celdaZ + dz;

    if (alturaFn(nx, nz) <= 0) return;

    if (dx ===  1) patoRotTarget =  0;
    if (dx === -1) patoRotTarget =  Math.PI;
    if (dz === -1) patoRotTarget =  Math.PI / 2;
    if (dz ===  1) patoRotTarget = -Math.PI / 2;

    saltoDesde = { x: celdaX * 2, y: jugador.position.y, z: celdaZ * 2 };
    saltoHasta = { x: nx * 2, y: yMundo(nx, nz), z: nz * 2 };
    celdaX = nx;
    celdaZ = nz;

    // Actualizar ángulo al INICIAR el salto para respuesta inmediata
    if (Math.abs(celdaX) + Math.abs(celdaZ) > 0.1) {
      camTarget = Math.atan2(celdaZ, celdaX);
    }

    saltando = true;
    saltoT = 0;

    if (!cronometroActivo) cronometroActivo = true;
  });

  /* ---------- Reintentar (game over) y botones de victoria ---------- */
  document.addEventListener('click', (e) => {
    if (e.target.closest('#boton-reintentar')) {
      const overlay = document.getElementById('game-over');
      if (overlay) overlay.classList.add('oculto');
      reiniciar(escenarioActual, patoColor, patoOjoColor, dificultadActual);
    }
    if (e.target.closest('#btn-victoria-nuevo')) {
      const overlay = document.getElementById('victoria');
      if (overlay) overlay.hidden = true;
      reiniciar(escenarioActual, patoColor, patoOjoColor, dificultadActual);
    }
    if (e.target.closest('#btn-victoria-menu')) {
      const overlay = document.getElementById('victoria');
      if (overlay) overlay.hidden = true;
    }
  });

  nubeCima = crearNubeCima();
  preSpawnItems();

  renderer.setAnimationLoop(animate);

  /* ---------- Loop de animación ---------- */
  function animate() {
    const delta = reloj.getDelta();
    mixers.forEach((m) => m.update(delta));

    if (explosionActual) {
      const done = explosionActual.animar(delta);
      if (done) explosionActual = null;
    }

    let rotDiff = patoRotTarget - jugador.rotation.y;
    while (rotDiff >  Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    jugador.rotation.y += rotDiff * Math.min(1, delta * 12);

    // Rotación suave del ángulo de cámara
    let diff = camTarget - camAngle;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    camAngle += diff * Math.min(1, delta * 4);

    // Punto de seguimiento: XZ sigue el movimiento horizontal con lag ligero;
    // Y sigue la altura de destino (no el pico del arco) para evitar el salto visual
    const groundY = saltando ? saltoHasta.y : jugador.position.y;
    camLookX += (jugador.position.x - camLookX) * Math.min(1, delta * 8);
    camLookZ += (jugador.position.z - camLookZ) * Math.min(1, delta * 8);
    camLookY += (groundY            - camLookY) * Math.min(1, delta * 5);

    // Posición deseada de la cámara
    const camDist = 9;
    const camH    = camDist * Math.tan(35 * Math.PI / 180);
    const desX = camLookX + Math.cos(camAngle) * camDist;
    const desY = camLookY + camH;
    const desZ = camLookZ + Math.sin(camAngle) * camDist;

    // Lerp de la posición de la cámara para transición extra suave
    camera.position.x += (desX - camera.position.x) * Math.min(1, delta * 10);
    camera.position.y += (desY - camera.position.y) * Math.min(1, delta * 10);
    camera.position.z += (desZ - camera.position.z) * Math.min(1, delta * 10);

    camera.lookAt(camLookX, camLookY, camLookZ);

    const estaActivo = vistaJuego.classList.contains('activa');
    if (!estaActivo) { renderer.render(scene, camera); return; }

    if (saltando) {
      saltoT = Math.min(1, saltoT + delta / DURACION_SALTO);
      const t = saltoT;
      jugador.position.x = lerp(saltoDesde.x, saltoHasta.x, t);
      jugador.position.z = lerp(saltoDesde.z, saltoHasta.z, t);
      jugador.position.y = lerp(saltoDesde.y, saltoHasta.y, t) + ALTURA_ARCO * Math.sin(t * Math.PI);

      if (t >= 1) {
        saltando = false;
        jugador.position.set(celdaX * 2, saltoHasta.y, celdaZ * 2);
        if (typeof alMoverJugador === 'function') {
          alMoverJugador(jugador.position);
        }
        procesarAterrizaje(celdaX, celdaZ);
      }
    }

    if (cronometroActivo && !muerto) {
      cronometroT += delta;
      if (elTiempo) elTiempo.textContent = formatearTiempo(cronometroT);
    }

    if (cronometroActivo) {
      tickMinas(delta);
      tickItems(delta);
      actualizarCronometroColor();
    }
    coleccionables.animar(delta);
    estructura.animarMinas(delta);

    if (nubeCima && nubeCima.visible) {
      nubeCimaT += delta;
      nubeCima.position.y = nubeCimaBaseY + Math.sin(nubeCimaT * 1.2) * 0.4;
      nubeCima.rotation.y += delta * 0.3;
    }

    renderer.render(scene, camera);
    actualizarStats(delta);
  }

  /* ---------- Jugadores remotos ---------- */
  const remotos = new Map();

  function colorPorId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 360;
    return new THREE.Color(`hsl(${hash}, 80%, 55%)`);
  }

  function agregarJugadorRemoto(remoto) {
    if (!remoto || remotos.has(remoto.id)) return;
    const avatar = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshPhongMaterial({ color: colorPorId(remoto.id) })
    );
    avatar.position.set(remoto.x || 0, (remoto.y || 0) + 1.5, remoto.z || 0);
    scene.add(avatar);
    remotos.set(remoto.id, avatar);
  }

  function moverJugadorRemoto(remoto) {
    const avatar = remotos.get(remoto.id);
    if (avatar) avatar.position.set(remoto.x, remoto.y + 1.5, remoto.z);
  }

  function quitarJugadorRemoto(id) {
    const avatar = remotos.get(id);
    if (avatar) { scene.remove(avatar); remotos.delete(id); }
  }

  /* ---------- Control de escenario ---------- */
  function reiniciar(tipo = 'piramide', colorHex = patoColor, colorOjo = patoOjoColor, dificultad = dificultadActual) {
    estructura.limpiar();
    coleccionables.limpiar();
    if (explosionActual) { explosionActual = null; }

    escenarioActual  = tipo;
    patoColor        = colorHex;
    patoOjoColor     = colorOjo;
    dificultadActual = dificultad || 'normal';

    estructura = crearEstructura(scene, tipo, dificultadActual);
    alturaFn = estructura.alturaFn;
    elevacion = estructura.elevacion || 0;

    coleccionables = crearSistemaColeccionables(scene, alturaFn, RANGO_POR_ESCENARIO[tipo] || 5);
    minaTick = 0;
    itemTick  = 0;

    saciedad   = 0;
    satisfecho = false;
    nubeCimaT  = 0;
    if (nubeCima) { scene.remove(nubeCima); nubeCima = null; }

    const inicio = INICIO_POR_ESCENARIO[tipo] || { x: 0, z: 9 };
    celdaX = inicio.x;
    celdaZ = inicio.z;
    saltando = false;
    saltoT = 0;
    muerto = false;
    vidas = 3;
    score = 0;
    racha = 0;
    cronometroT = 0;
    cronometroActivo = false;

    if (elTiempo) { elTiempo.textContent = '00:00'; elTiempo.style.color = ''; }

    bob.remove(pato);
    pato = crearPato(patoColor, patoOjoColor);
    pato.position.y = 1;
    pato.scale.setScalar(1.4);
    bob.add(pato);
    bob.visible = true;

    jugador.position.set(celdaX * 2, yMundo(celdaX, celdaZ), celdaZ * 2);

    camAngle  = Math.atan2(inicio.z, inicio.x);
    camTarget = camAngle;
    camLookX  = celdaX * 2;
    camLookZ  = celdaZ * 2;
    camLookY  = yMundo(celdaX, celdaZ);
    patoRotTarget = Math.atan2(inicio.z, -inicio.x);
    jugador.rotation.y = patoRotTarget;

    document.body.style.background = FONDO_POR_ESCENARIO[tipo] || FONDO_POR_ESCENARIO.piramide;

    const overlayGO = document.getElementById('game-over');
    if (overlayGO) overlayGO.classList.add('oculto');
    const overlayV = document.getElementById('victoria');
    if (overlayV) overlayV.hidden = true;

    actualizarHUD();
    actualizarVidas();
    actualizarScore();

    nubeCima = crearNubeCima();
    preSpawnItems();
    actualizarBarraSaciedad();
    const elBar = document.getElementById('hud-saciedad-relleno');
    if (elBar) elBar.classList.remove('saciedad__relleno--llena');
  }

  function pausarCronometro()   { cronometroActivo = false; }
  function reanudarCronometro() { if (cronometroT > 0 && !muerto) cronometroActivo = true; }

  return {
    scene,
    jugador,
    agregarJugadorRemoto,
    moverJugadorRemoto,
    quitarJugadorRemoto,
    reiniciar,
    pausarCronometro,
    reanudarCronometro,
  };
}
