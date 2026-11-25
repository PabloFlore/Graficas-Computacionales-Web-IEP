import * as THREE from 'three';
import { crearEstructura } from './piramide.js';
import { setSeed } from '../util/rng.js';
import { crearPato } from './pato.js';
import { crearExplosion } from './explosion.js';
import { crearSistemaColeccionables } from './coleccionables.js';
import { crearSistemaObstaculos } from './obstaculos.js';
import { crearSistemaPowerups } from './powerups.js';
import {
  sonidoSalto, sonidoRecoger, sonidoMina, sonidoGameOver,
  sonidoEscudo, sonidoPowerup, sonidoVictoria,
  iniciarMusica, detenerMusica,
} from './sonidos.js';

const SPAWNS_BATALLA = { a: { x: 0, z: 8 }, b: { x: 0, z: -8 } };

const INICIO_POR_ESCENARIO = {
  piramide: { x: 0, z: 10 },
  torre:    { x: 3, z: 0 },
  islas:    { x: -10, z: 4 },
  arena:    { x: 10, z: -2 },
  batalla:  SPAWNS_BATALLA.a,
};

const TRAMPOLINES_TORRE = [[1, 2], [2, -1]];
const TRAMPOLIN_CICLO = 5;
const TRAMPOLIN_ACTIVO = 3;

const CELDAS_PROTEGIDAS = [
  ...Object.values(INICIO_POR_ESCENARIO).map(({ x, z }) => [x, z]),
  [0, 0],
  [SPAWNS_BATALLA.b.x, SPAWNS_BATALLA.b.z],
  ...TRAMPOLINES_TORRE,
];

const FONDO_POR_ESCENARIO = {
  piramide: '#6cc0f0',
  torre:    '#ff9d3d',
  islas:    '#b8d4e0',
  arena:    '#7ec87a',
  batalla:  '#2f8fd0',
};

const RANGO_POR_ESCENARIO = {
  piramide: 10,
  torre: 5,
  islas: 14,
  arena: 11,
  batalla: 10,
};

const NIVEL_MAXIMO_POR_ESCENARIO = { piramide: 11, torre: 14, islas: 11, arena: 5, batalla: 999 };
const MAX_SUBIDA_POR_ESCENARIO   = { piramide: 1, torre: 1, islas: 2, arena: 1, batalla: 0 };
const RANGO_SPAWN_POR_ESCENARIO  = { piramide: 10, torre: 5, islas: 5, arena: 10, batalla: 10 };

const ITEMS_POR_CUADRANTE = {
  piramide: { facil: 3, normal: 2, dificil: 1 },
  torre:    { facil: 6, normal: 5, dificil: 4 },
  islas:    { facil: 6, normal: 5, dificil: 4 },
  arena:    { facil: 5, normal: 4, dificil: 3 },
  batalla:  { facil: 5, normal: 4, dificil: 3 },
};

const INTERVALO_SHRINK = { facil: 20, normal: 15, dificil: 10 };
const ISLAS_LATERALES = [[-13, 0], [13, 0]];

const INTERVALO_MINAS  = { facil: 2.0, normal: 1.2, dificil: 0.6 };
const CAP_MINAS_PCT    = { facil: 0.25, normal: 0.45, dificil: 0.65 };
const INTERVALO_ITEMS          = 1.5;
const INTERVALO_AGUA           = { carrera: 9, rey: 6 };
const BAJADA_AGUA_MUERTE       = 3;
const CUADRANTES = [[1,1],[-1,1],[-1,-1],[1,-1]];

function lerp(a, b, t) { return a + (b - a) * t; }

export async function iniciarEscena({ alMoverJugador, alGanar, alPerder } = {}) {
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
  // Luz focal (puntual) que sigue al pato: ilumina el entorno inmediato
  const luzFocal = new THREE.PointLight(0xfff4d6, 1.1, 32, 1.6);
  luzFocal.position.set(0, 10, 6);
  scene.add(luzFocal);

  /* ---------- Estructura inicial ---------- */
  let estructura = crearEstructura(scene, 'piramide', 'normal', CELDAS_PROTEGIDAS);
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
  let modoFPS = true;

  /* ---------- Racha ---------- */
  const RACHA_TIMEOUT = 4;   // segundos sin recoger antes de perder la racha
  let rachaRestante = 0;

  /* ---------- Power-ups ---------- */
  let powerups = null;
  let powerupTick = 0;
  const INTERVALO_POWERUP = 12;  // intento de aparición
  let escudoActivo  = false;
  let plumaRestante = 0;         // doble salto
  let imanRestante  = 0;         // imán de puntos
  let squashT = 0;               // animación de aterrizaje

  /* ---------- Saciedad ---------- */
  const SACIEDAD_MAX_POR_MODO = { carrera: 30, rey: 40 };
  let saciedadMax = SACIEDAD_MAX_POR_MODO.carrera;
  let saciedad      = 0;
  let satisfecho    = false;
  let nubeCima      = null;
  let nubeCimaBaseY = 0;
  let nubeCimaT     = 0;

  /* ---------- Lago (solo pirámide) ---------- */
  let aguaT      = 0;
  let nivelAgua  = 0;
  let planoAgua  = null;
  let modoActual = 'carrera';

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

  /* ---------- Aro de escudo (visible al tener el power-up) ---------- */
  const escudoMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.08, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0x3ad1ff, transparent: true, opacity: 0.6 })
  );
  escudoMesh.rotation.x = Math.PI / 2;
  escudoMesh.position.y = 1;
  escudoMesh.visible = false;
  bob.add(escudoMesh);

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
  let duracionSaltoActual = DURACION_SALTO;
  let saltoLentoPendiente = false;
  let alturaSaltoDesde = 0;
  let impulsoSalto = 0;

  /* ---------- Explosión actual ---------- */
  let explosionActual = null;

  /* ---------- Coleccionables ---------- */
  let coleccionables = crearSistemaColeccionables(
    scene,
    alturaFn,
    RANGO_SPAWN_POR_ESCENARIO[escenarioActual],
    (ix, iz) => yMundo(ix, iz)
  );

  /* ---------- Obstáculos: tortugas y hierba ---------- */
  function puedeOcuparObstaculo(ix, iz) {
    if (alturaFn(ix, iz) <= 0) return false;
    if (escenarioActual === 'piramide' && iz < 0) return false;
    const inicio = INICIO_POR_ESCENARIO[escenarioActual];
    if (inicio && ix === inicio.x && iz === inicio.z) return false;
    if (escenarioActual === 'batalla' && ix === SPAWNS_BATALLA.b.x && iz === SPAWNS_BATALLA.b.z) return false;
    if (ix === 0 && iz === 0) return false;
    if (escenarioActual === 'torre' && TRAMPOLINES_TORRE.some(([tx, tz]) => tx === ix && tz === iz)) return false;
    if (estructura.esMina(ix, iz) || estructura.estaCaido(ix, iz)) return false;
    if (coleccionables.tieneItem(ix, iz)) return false;
    return true;
  }

  let obstaculos = crearSistemaObstaculos(
    scene,
    alturaFn,
    RANGO_SPAWN_POR_ESCENARIO[escenarioActual],
    (ix, iz) => yMundo(ix, iz),
    puedeOcuparObstaculo
  );

  powerups = crearSistemaPowerups(
    scene,
    alturaFn,
    RANGO_SPAWN_POR_ESCENARIO[escenarioActual],
    (ix, iz) => yMundo(ix, iz),
    puedeOcuparObstaculo
  );

  /* ---------- Ticks de minas, items y shrink (batalla) ---------- */
  let minaTick = 0;
  let itemTick  = 0;
  let shrinkTick = 0;
  let rangoActivo = 10;
  let spawnActual = null; // override de posición inicial para batalla

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

  /* ---------- Juice: estilos + HUD de power-ups ---------- */
  if (!document.getElementById('estilos-juice')) {
    const s = document.createElement('style');
    s.id = 'estilos-juice';
    s.textContent = `
      @keyframes flotarPuntos {
        0%   { transform: translate(-50%, 0) scale(0.8); opacity: 0; }
        15%  { transform: translate(-50%, -6px) scale(1.12); opacity: 1; }
        100% { transform: translate(-50%, -50px) scale(1); opacity: 0; }
      }
      .puntos-flotantes {
        position: fixed; pointer-events: none; z-index: 60;
        font: 700 22px/1 system-ui, sans-serif; color: #fff; white-space: nowrap;
        text-shadow: 0 2px 6px rgba(0,0,0,.6);
        animation: flotarPuntos 0.9s ease-out forwards;
      }
      .puntos-flotantes--bonus { color: #ffe14d; }
      .jugador-etiqueta {
        position: fixed; transform: translate(-50%, -100%); pointer-events: none; z-index: 50;
        font: 700 12px/1.6 system-ui, sans-serif; color: #fff; white-space: nowrap;
        background: rgba(0,0,0,0.45); padding: 1px 7px; border-radius: 6px;
        text-shadow: 0 1px 3px rgba(0,0,0,0.9); display: none;
      }
      .jugador-etiqueta--local { color: #ffe14d; }
      #hud-powerups {
        position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
        display: flex; gap: 10px; z-index: 40; pointer-events: none;
      }
      .pw-badge {
        display: flex; align-items: center; gap: 6px;
        background: rgba(0,0,0,.45); color: #fff;
        font: 600 14px/1 system-ui, sans-serif;
        padding: 7px 12px; border-radius: 999px;
      }
      .pw-badge .ico { font-size: 18px; }
    `;
    document.head.appendChild(s);
  }

  const divPowerups = document.createElement('div');
  divPowerups.id = 'hud-powerups';
  document.body.appendChild(divPowerups);

  function actualizarPowerupHUD() {
    const b = [];
    if (escudoActivo)     b.push('<div class="pw-badge"><span class="ico">🛟</span>Escudo</div>');
    if (plumaRestante > 0) b.push(`<div class="pw-badge"><span class="ico">🪽</span>${Math.ceil(plumaRestante)}s</div>`);
    if (imanRestante > 0)  b.push(`<div class="pw-badge"><span class="ico">🧲</span>${Math.ceil(imanRestante)}s</div>`);
    divPowerups.innerHTML = b.join('');
  }

  function mostrarPuntosFlotantes(texto, mundoPos, bonus = false) {
    const v = mundoPos.clone().project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    const sx = rect.left + (v.x * 0.5 + 0.5) * rect.width;
    const sy = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
    const el = document.createElement('div');
    el.className = 'puntos-flotantes' + (bonus ? ' puntos-flotantes--bonus' : '');
    el.textContent = texto;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

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

  /* ---------- Lago que sube ---------- */
  function crearPlanoAgua() {
    const geo = new THREE.PlaneGeometry(160, 160);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2f8fd0,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = -0.2;
    m.visible = escenarioActual === 'piramide';
    scene.add(m);
    return m;
  }

  /* ---------- Trampolines de La Torre ---------- */
  const geoTrampolin = new THREE.CylinderGeometry(0.72, 0.72, 0.14, 12);
  let trampolines = [];
  let trampolinT = 0;

  function crearTrampolinesTorre() {
    limpiarTrampolines();
    if (escenarioActual !== 'torre') return;
    TRAMPOLINES_TORRE.forEach(([ix, iz]) => {
      const mat = new THREE.MeshPhongMaterial({ color: 0xffd45e, flatShading: true });
      const m = new THREE.Mesh(geoTrampolin, mat);
      m.position.set(ix * 2, yMundo(ix, iz) + 1.1, iz * 2);
      scene.add(m);
      trampolines.push(m);
    });
    trampolinT = 0;
  }

  function limpiarTrampolines() {
    trampolines.forEach((m) => { scene.remove(m); m.material.dispose(); });
    trampolines.length = 0;
  }

  function actualizarTrampolines(delta) {
    if (trampolines.length === 0) return;
    trampolinT = (trampolinT + delta) % TRAMPOLIN_CICLO;
    const activo = trampolinT < TRAMPOLIN_ACTIVO;
    trampolines.forEach((m) => {
      m.material.color.setHex(activo ? 0xffd45e : 0x7a7a7a);
      m.scale.y = activo ? 1 + Math.sin(trampolinT * 8) * 0.15 : 0.6;
    });
  }

  function trampolinActivoEn(ix, iz) {
    return escenarioActual === 'torre'
      && trampolinT < TRAMPOLIN_ACTIVO
      && TRAMPOLINES_TORRE.some(([tx, tz]) => tx === ix && tz === iz);
  }

  /* ---------- Saciedad ---------- */
  function actualizarBarraSaciedad() {
    const el = document.getElementById('hud-saciedad-relleno');
    if (el) el.style.width = `${(saciedad / saciedadMax) * 100}%`;
  }

  function actualizarBarraAgua() {
    const total = NIVEL_MAXIMO_POR_ESCENARIO.piramide;
    const el = document.getElementById('hud-saciedad-relleno');
    if (el) el.style.width = `${Math.min(100, (nivelAgua / total) * 100)}%`;
    const txt = document.getElementById('hud-agua-nivel');
    if (txt) txt.textContent = nivelAgua;
    const cont = txt ? txt.closest('.hud__flotante') : null;
    if (cont) cont.hidden = escenarioActual !== 'piramide';
  }

  function actualizarSaciedad(pts) {
    if (satisfecho) return;
    saciedad = Math.min(saciedadMax, saciedad + pts);
    actualizarBarraSaciedad();
    if (saciedad >= saciedadMax) {
      satisfecho = true;
      if (nubeCima) nubeCima.visible = true;
      const el = document.getElementById('hud-saciedad-relleno');
      if (el) el.classList.add('saciedad__relleno--llena');
    }
  }

  /* ---------- Game Over ---------- */
  function mostrarGameOver() {
    detenerMusica();
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
    detenerMusica();
    sonidoVictoria();

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

  /* ---------- Victoria en batalla (rival eliminado) ---------- */
  function mostrarVictoriaBatalla() {
    cronometroActivo = false;
    detenerMusica();
    sonidoVictoria();
    const overlay = document.getElementById('victoria');
    if (!overlay) return;
    const scoreEl = document.getElementById('victoria-score');
    const tiempoEl = document.getElementById('victoria-tiempo');
    const tituloEl = overlay.querySelector('.victoria__titulo');
    if (tituloEl) tituloEl.textContent = '¡Ganaste la batalla!';
    if (scoreEl)  scoreEl.textContent  = score;
    if (tiempoEl) tiempoEl.textContent = formatearTiempo(cronometroT);
    const mejorEl = document.getElementById('victoria-mejor');
    if (mejorEl) mejorEl.textContent = score;
    overlay.hidden = false;
  }

  /* ---------- Respawn ---------- */
  function respawnJugador() {
    muerto = false;
    const inicio = spawnActual || INICIO_POR_ESCENARIO[escenarioActual] || { x: 0, z: 9 };
    celdaX = inicio.x;
    celdaZ = inicio.z;
    saltando = false;
    saltoT = 0;
    duracionSaltoActual = DURACION_SALTO;
    saltoLentoPendiente = false;
    impulsoSalto = 0;
    jugador.position.set(celdaX * 2, yMundo(celdaX, celdaZ), celdaZ * 2);
    alturaSaltoDesde = alturaEfectiva(celdaX, celdaZ);
    camAngle  = escenarioActual === 'piramide' ? Math.PI / 2 : Math.atan2(inicio.z, inicio.x);
    camTarget = camAngle;
    camLookX  = celdaX * 2;
    camLookZ  = celdaZ * 2;
    camLookY  = yMundo(celdaX, celdaZ);
    patoRotTarget = Math.atan2(inicio.z, -inicio.x);
    jugador.rotation.y = patoRotTarget;
    bob.visible = true;
    obstaculos.limpiar();
    obstaculos.poblar({ celdaX, celdaZ });
  }

  /* ---------- Color del cronómetro según densidad de minas ---------- */
  function actualizarCronometroColor() {
    if (!elTiempo) return;
    const cap = Math.max(1, Math.floor(estructura.tapasCount * (CAP_MINAS_PCT[dificultadActual] ?? 0.45)));
    const pct = Math.min(1, estructura.minasCount / cap);
    // Negro → amarillo → naranja → rojo
    let r, g, b;
    if (pct < 0.33) {
      const t = pct / 0.33;
      r = Math.round(lerp(26, 255, t)); g = Math.round(lerp(26, 200, t)); b = Math.round(lerp(26, 0, t));
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

    // No superar el cap de minas por dificultad (contando las avisadas)
    const cap = Math.floor(estructura.tapasCount * (CAP_MINAS_PCT[dificultadActual] ?? 0.45));
    let enCurso = estructura.minasPendientes;
    const conAviso = modoActual === 'rey';
    if (estructura.minasCount + enCurso >= cap) return;

    const nivelMax = NIVEL_MAXIMO_POR_ESCENARIO[escenarioActual];
    const rango    = RANGO_POR_ESCENARIO[escenarioActual];
    // A partir del minuto 1 se añade 1 mina extra por minuto transcurrido
    const cantidad = 1 + Math.floor(cronometroT / 60);

    for (let spawn = 0; spawn < cantidad; spawn++) {
      if (estructura.minasCount + enCurso >= cap) break;
      for (let i = 0; i < 8; i++) {
        const ix = Math.floor(Math.random() * (rango * 2 + 1)) - rango;
        const iz = Math.floor(Math.random() * (rango * 2 + 1)) - rango;
        const nivel = alturaFn(ix, iz);
        if (nivel <= 0 || nivel >= nivelMax) continue;
        if (Math.random() < nivel / nivelMax) {
          const ok = conAviso
            ? estructura.avisarMina(ix, iz)
            : estructura.convertirEnMina(ix, iz);
          if (ok) { enCurso++; break; }
        }
      }
    }
  }

  /* ---------- Spawn periódico de items ---------- */
  function itemsPorCuadrante() {
    return ITEMS_POR_CUADRANTE[escenarioActual]?.[dificultadActual] ?? 2;
  }

  function spawnIslasLaterales() {
    if (escenarioActual !== 'islas') return;
    ISLAS_LATERALES.forEach(([ix, iz]) => coleccionables.spawn(ix, iz));
  }

  function preSpawnItems() {
    for (const [qx, qz] of CUADRANTES) {
      for (let i = 0; i < itemsPorCuadrante(); i++) {
        coleccionables.spawnEnCuadrante(qx, qz);
      }
    }
    spawnIslasLaterales();
  }

  function tickItems(delta) {
    if (escenarioActual === 'piramide') return;
    itemTick += delta;
    if (itemTick < INTERVALO_ITEMS) return;
    itemTick = 0;
    for (const [qx, qz] of CUADRANTES) {
      const faltantes = itemsPorCuadrante()
        - coleccionables.itemsEnCuadrante(qx, qz, RANGO_SPAWN_POR_ESCENARIO[escenarioActual]);
      for (let i = 0; i < faltantes; i++) coleccionables.spawnEnCuadrante(qx, qz);
    }
    spawnIslasLaterales();
  }

  /* ---------- Contracción del anillo (batalla) ---------- */
  function tickShrink(delta) {
    if (rangoActivo <= 0) return;
    shrinkTick += delta;
    const intervalo = INTERVALO_SHRINK[dificultadActual] ?? 15;
    if (shrinkTick < intervalo) return;
    shrinkTick = 0;

    const r = rangoActivo;
    for (let ix = -r; ix <= r; ix++) {
      for (let iz = -r; iz <= r; iz++) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) === r) {
          estructura.desprenderCubo(ix, iz);
        }
      }
    }
    rangoActivo--;
  }

  /* ---------- Colisión con mina / agua ---------- */
  // causa: 'mina' | 'agua' | 'cubo'
  function perderVida(causa, x, z) {
    if (causa === 'mina') estructura.eliminarCubo(x, z);

    function retrocederAgua() {
      if (escenarioActual !== 'piramide') return;
      const intervalo = INTERVALO_AGUA[modoActual] || INTERVALO_AGUA.carrera;
      nivelAgua = Math.max(0, Math.min(nivelAgua - BAJADA_AGUA_MUERTE, 4));
      aguaT = nivelAgua * intervalo;
      actualizarBarraAgua();
    }

    // El escudo absorbe el golpe: no cuesta vida y reaparece en la salida.
    if (escudoActivo) {
      escudoActivo = false;
      escudoMesh.visible = false;
      actualizarPowerupHUD();
      sonidoEscudo();
      if (causa === 'agua') retrocederAgua();
      respawnJugador();
      return;
    }

    vidas--;
    actualizarVidas();
    sonidoMina();
    muerto = true;
    racha = 0;
    rachaRestante = 0;
    bob.visible = false;
    explosionActual = crearExplosion(scene, jugador.position.clone());
    if (causa === 'agua') retrocederAgua();

    if (vidas <= 0) {
      sonidoGameOver();
      if (escenarioActual === 'batalla' && typeof alPerder === 'function') alPerder();
      setTimeout(() => mostrarGameOver(), 900);
    } else {
      setTimeout(() => respawnJugador(), 900);
    }
  }

  /* ---------- Racha escalonada ---------- */
  function multiplicadorRacha() {
    if (racha >= 6) return 3;
    if (racha >= 3) return 2;
    return 1;
  }

  /* ---------- Recoger coleccionable en una celda ---------- */
  function recogerEnCelda(x, z) {
    const pts = coleccionables.recoger(x, z);
    if (pts === null) return false;
    racha++;
    rachaRestante = RACHA_TIMEOUT;
    const mult = multiplicadorRacha();
    const ganado = pts * mult;
    score += ganado;
    actualizarScore();
    sonidoRecoger();
    mostrarPuntosFlotantes(
      mult > 1 ? `+${ganado} x${mult}` : `+${ganado}`,
      new THREE.Vector3(x * 2, yMundo(x, z) + 2.2, z * 2),
      mult > 1
    );
    if (escenarioActual === 'piramide') {
      const intervalo = INTERVALO_AGUA[modoActual] || INTERVALO_AGUA.carrera;
      aguaT = Math.max(0, aguaT - intervalo);
      nivelAgua = Math.floor(aguaT / intervalo);
      actualizarBarraAgua();
    } else if (escenarioActual !== 'batalla') {
      actualizarSaciedad(pts);
    }
    return true;
  }

  /* ---------- Aplicar un power-up recogido ---------- */
  function aplicarPowerup(tipo, x, z) {
    sonidoPowerup();
    const pos = new THREE.Vector3(x * 2, yMundo(x, z) + 2.6, z * 2);
    if (tipo.id === 'escudo') {
      escudoActivo = true;
      escudoMesh.visible = true;
      mostrarPuntosFlotantes('🛟 Escudo', pos, true);
    } else if (tipo.id === 'pluma') {
      plumaRestante = tipo.dur;
      mostrarPuntosFlotantes('🪽 Doble salto', pos, true);
    } else if (tipo.id === 'iman') {
      imanRestante = tipo.dur;
      mostrarPuntosFlotantes('🧲 Imán', pos, true);
    }
    actualizarPowerupHUD();
  }

  /* ---------- Bonus al coronar la cima ---------- */
  function otorgarBonusVictoria() {
    const bonusCima   = 500;
    const bonusTiempo  = Math.max(0, Math.round((300 - cronometroT)) * 2);
    const bonusVidas   = vidas * 150;
    const total = bonusCima + bonusTiempo + bonusVidas;
    score += total;
    actualizarScore();
    mostrarPuntosFlotantes(`¡Cima! +${total}`, new THREE.Vector3(0, yMundo(0, 0) + 3, 0), true);
  }

  function procesarAterrizaje(x, z) {
    squashT = 1; // animación de aterrizaje

    // Power-up en la celda
    const tipoPw = powerups.recoger(x, z);
    if (tipoPw) aplicarPowerup(tipoPw, x, z);

    // Coleccionable en la celda
    recogerEnCelda(x, z);

    // Imán: también recoge los coleccionables de las 4 celdas vecinas
    if (imanRestante > 0) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        recogerEnCelda(x + dx, z + dz);
      }
    }

    if (obstaculos.consumirHierba(x, z)) saltoLentoPendiente = true;

    if (trampolinActivoEn(x, z)) impulsoSalto = 1;

    if (!muerto && alturaEfectiva(x, z) < alturaSaltoDesde) obstaculos.invertirTortugas();

    if (estructura.esMina(x, z)) {
      perderVida('mina', x, z);
      return;
    }

    if (!muerto) {
      const inicio = INICIO_POR_ESCENARIO[escenarioActual];
      if (!(x === inicio.x && z === inicio.z)) estructura.registrarPaso(x, z);
    }

    actualizarHUD();

    /* Victoria: en pirámide basta la cima; en los otros hace falta la nube; en batalla no hay cima */
    const enCima = escenarioActual !== 'batalla' && alturaEfectiva(x, z) >= NIVEL_MAXIMO_POR_ESCENARIO[escenarioActual];
    if (enCima && (escenarioActual === 'piramide' || satisfecho)) {
      otorgarBonusVictoria();
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
    if (event.key === 'v' || event.key === 'V') {
      if (vistaJuego.classList.contains('activa')) modoFPS = !modoFPS;
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

    if (estructura.estaCaido(nx, nz)) return;

    if (obstaculos.estaBloqueada(nx, nz)) return;

    // La mitad trasera (z < 0) queda fuera de alcance en La Pirámide
    if (escenarioActual === 'piramide' && nz < 0) return;

    if (alturaFn(nx, nz) <= 0) return;

    const bonoPluma = plumaRestante > 0 ? 1 : 0;
    const maxSubida = impulsoSalto > 0 ? 3 : ((MAX_SUBIDA_POR_ESCENARIO[escenarioActual] ?? 1) + bonoPluma);
    if (alturaEfectiva(nx, nz) - alturaEfectiva(celdaX, celdaZ) > maxSubida) return;

    if (dx ===  1) patoRotTarget =  0;
    if (dx === -1) patoRotTarget =  Math.PI;
    if (dz === -1) patoRotTarget =  Math.PI / 2;
    if (dz ===  1) patoRotTarget = -Math.PI / 2;

    alturaSaltoDesde = alturaEfectiva(celdaX, celdaZ);
    saltoDesde = { x: celdaX * 2, y: jugador.position.y, z: celdaZ * 2 };
    saltoHasta = { x: nx * 2, y: yMundo(nx, nz), z: nz * 2 };
    celdaX = nx;
    celdaZ = nz;

    // En la pirámide la cámara queda fija para no perder la referencia del centro
    if (escenarioActual !== 'piramide' && Math.abs(celdaX) + Math.abs(celdaZ) > 0.1) {
      camTarget = Math.atan2(celdaZ, celdaX);
    }

    duracionSaltoActual = saltoLentoPendiente ? DURACION_SALTO * 1.65 : DURACION_SALTO;
    saltoLentoPendiente = false;
    impulsoSalto = 0;
    saltando = true;
    saltoT = 0;
    sonidoSalto();
    iniciarMusica();

    if (!cronometroActivo) cronometroActivo = true;
  });

  /* ---------- Reintentar (game over) y botones de victoria ---------- */
  document.addEventListener('click', (e) => {
    if (e.target.closest('#boton-reintentar')) {
      const overlay = document.getElementById('game-over');
      if (overlay) overlay.classList.add('oculto');
      reiniciar(escenarioActual, patoColor, patoOjoColor, dificultadActual, modoActual);
    }
    if (e.target.closest('#btn-victoria-nuevo')) {
      const overlay = document.getElementById('victoria');
      if (overlay) overlay.hidden = true;
      reiniciar(escenarioActual, patoColor, patoOjoColor, dificultadActual, modoActual);
    }
    if (e.target.closest('#btn-victoria-menu')) {
      const overlay = document.getElementById('victoria');
      if (overlay) overlay.hidden = true;
    }
  });

  nubeCima = crearNubeCima();
  planoAgua = crearPlanoAgua();
  crearTrampolinesTorre();
  preSpawnItems();
  actualizarBarraAgua();
  actualizarPowerupHUD();
  powerupTick = INTERVALO_POWERUP - 6;

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

    if (modoFPS) {
      // Cámara cercana: encima y detrás del pato, siguiendo su dirección
      const detras = 3;
      const alto   = 5;
      const bx = -Math.cos(jugador.rotation.y) * detras;
      const bz =  Math.sin(jugador.rotation.y) * detras;
      const tx = jugador.position.x + bx;
      const ty = jugador.position.y + alto;
      const tz = jugador.position.z + bz;
      camera.position.x += (tx - camera.position.x) * Math.min(1, delta * 8);
      camera.position.y += (ty - camera.position.y) * Math.min(1, delta * 8);
      camera.position.z += (tz - camera.position.z) * Math.min(1, delta * 8);
      camera.lookAt(jugador.position.x, jugador.position.y + 1, jugador.position.z);
    } else {
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
    }

    const estaActivo = vistaJuego.classList.contains('activa');
    if (!estaActivo) { renderer.render(scene, camera); return; }

    if (saltando) {
      saltoT = Math.min(1, saltoT + delta / duracionSaltoActual);
      const t = saltoT;
      jugador.position.x = lerp(saltoDesde.x, saltoHasta.x, t);
      jugador.position.z = lerp(saltoDesde.z, saltoHasta.z, t);
      jugador.position.y = lerp(saltoDesde.y, saltoHasta.y, t) + ALTURA_ARCO * Math.sin(t * Math.PI);

      if (t >= 1) {
        saltando = false;
        jugador.position.set(celdaX * 2, saltoHasta.y, celdaZ * 2);
        if (typeof alMoverJugador === 'function') {
          alMoverJugador({ x: jugador.position.x, y: jugador.position.y, z: jugador.position.z, rotationY: jugador.rotation.y });
        }
        procesarAterrizaje(celdaX, celdaZ);
      }
    }

    if (cronometroActivo && !muerto) {
      cronometroT += delta;
      if (elTiempo) elTiempo.textContent = formatearTiempo(cronometroT);
    }

    if (cronometroActivo) {
      if (modoActual !== 'carrera') tickMinas(delta);
      tickItems(delta);
      if (escenarioActual === 'batalla') tickShrink(delta);
      actualizarCronometroColor();

      // Aparición periódica de power-ups (máx. 2 en el tablero)
      powerupTick += delta;
      if (powerupTick >= INTERVALO_POWERUP) {
        powerupTick = 0;
        if (powerups.cantidad < 2) powerups.spawnAleatorio();
      }
    }

    // Temporizadores de power-ups y de la racha
    if (cronometroActivo && !muerto) {
      let hudSucio = false;
      if (plumaRestante > 0) { plumaRestante = Math.max(0, plumaRestante - delta); hudSucio = true; }
      if (imanRestante  > 0) { imanRestante  = Math.max(0, imanRestante  - delta); hudSucio = true; }
      if (hudSucio) actualizarPowerupHUD();
      if (rachaRestante > 0) {
        rachaRestante = Math.max(0, rachaRestante - delta);
        if (rachaRestante === 0) racha = 0;
      }
    }

    if (cronometroActivo && escenarioActual === 'piramide' && planoAgua) {
      const intervalo = INTERVALO_AGUA[modoActual] || INTERVALO_AGUA.carrera;
      aguaT += delta;
      nivelAgua = Math.floor(aguaT / intervalo);
      planoAgua.visible = true;
      planoAgua.position.y = nivelAgua * 2 - 1 + 0.8 + Math.sin(cronometroT * 1.5) * 0.08;
      actualizarBarraAgua();

      if (!muerto && alturaEfectiva(celdaX, celdaZ) <= nivelAgua) {
        perderVida('agua');
      }
    }

    if (!muerto && !saltando && estructura.estaCaido(celdaX, celdaZ)) {
      perderVida('cubo');
    }

    coleccionables.animar(delta);
    powerups.animar(delta);
    actualizarTrampolines(delta);

    // Luz focal sigue al pato
    luzFocal.position.set(jugador.position.x, jugador.position.y + 6, jugador.position.z + 4);

    // Squash de aterrizaje
    if (squashT > 0) {
      squashT = Math.max(0, squashT - delta * 4);
      const s = squashT;
      pato.scale.set(1.4 * (1 + 0.15 * s), 1.4 * (1 - 0.3 * s), 1.4 * (1 + 0.15 * s));
    }

    // Aro de escudo
    if (escudoMesh.visible) {
      escudoMesh.rotation.z += delta * 2.5;
      const p = 1 + Math.sin(performance.now() * 0.006) * 0.08;
      escudoMesh.scale.setScalar(p);
    }
    obstaculos.animar(delta, {
      celdaX: saltando ? Math.round(saltoDesde.x / 2) : celdaX,
      celdaZ: saltando ? Math.round(saltoDesde.z / 2) : celdaZ,
      destinoX: saltando ? Math.round(saltoHasta.x / 2) : celdaX,
      destinoZ: saltando ? Math.round(saltoHasta.z / 2) : celdaZ,
      saltando,
    });
    estructura.animarMinas(delta);

    if (nubeCima && nubeCima.visible) {
      nubeCimaT += delta;
      nubeCima.position.y = nubeCimaBaseY + Math.sin(nubeCimaT * 1.2) * 0.4;
      nubeCima.rotation.y += delta * 0.3;
    }

    renderer.render(scene, camera);
    actualizarStats(delta);

    // Dificultad automática progresiva
    if (dificultadAuto && cronometroActivo && !muerto) {
      const nivelMax = NIVEL_MAXIMO_POR_ESCENARIO[escenarioActual] ?? 11;
      const pct = alturaEfectiva(celdaX, celdaZ) / nivelMax;
      const nuevaDif = pct < 0.33 ? 'facil' : pct < 0.66 ? 'normal' : 'dificil';
      if (nuevaDif !== dificultadAnteriorAuto) {
        dificultadActual = nuevaDif;
        dificultadAnteriorAuto = nuevaDif;
        obstaculos.configurar(dificultadActual);
      }
    }

    // Etiquetas de nombres sobre los patos
    remotos.forEach((avatar, id) => {
      const etiq = etiquetasRemotas.get(id);
      if (etiq) proyectarEtiqueta(etiq, avatar.position, 2.8);
    });
    if (etiquetaLocal) proyectarEtiqueta(etiquetaLocal, jugador.position, 2.2);
  }

  /* ---------- Jugadores remotos ---------- */
  const remotos        = new Map();
  const etiquetasRemotas = new Map();
  let etiquetaLocal    = null;
  let dificultadAuto   = false;
  let dificultadAnteriorAuto = '';

  function colorPorId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 360;
    return new THREE.Color(`hsl(${hash}, 80%, 55%)`);
  }

  function crearEtiqueta(nombre, esLocal = false) {
    const div = document.createElement('div');
    div.className = 'jugador-etiqueta' + (esLocal ? ' jugador-etiqueta--local' : '');
    div.textContent = nombre || '?';
    document.body.appendChild(div);
    return div;
  }

  function proyectarEtiqueta(div, pos3d, offsetY = 0.9) {
    const v = new THREE.Vector3(pos3d.x, pos3d.y + offsetY, pos3d.z).project(camera);
    if (v.z > 1) { div.style.display = 'none'; return; }
    div.style.display = '';
    div.style.left = ((v.x + 1) / 2 * window.innerWidth) + 'px';
    div.style.top  = (-(v.y - 1) / 2 * window.innerHeight) + 'px';
  }

  function agregarJugadorRemoto(remoto) {
    if (!remoto || remotos.has(remoto.id)) return;
    const colorCuerpo = remoto.colorCuerpo ?? colorPorId(remoto.id).getHex();
    const colorOjo    = remoto.colorOjo    ?? 0x1a1a2e;
    const patoRemoto = crearPato(colorCuerpo, colorOjo);
    patoRemoto.position.y = 1;
    patoRemoto.scale.setScalar(1.4);
    const container = new THREE.Group();
    container.add(patoRemoto);
    container.position.set(remoto.x || 0, remoto.y || 0, remoto.z || 0);
    scene.add(container);
    remotos.set(remoto.id, container);
    etiquetasRemotas.set(remoto.id, crearEtiqueta(remoto.nombre));
  }

  function moverJugadorRemoto(remoto) {
    const avatar = remotos.get(remoto.id);
    if (!avatar) return;
    avatar.position.set(remoto.x, remoto.y, remoto.z);
    if (remoto.rotationY != null) avatar.rotation.y = remoto.rotationY;
  }

  function quitarJugadorRemoto(id) {
    const avatar = remotos.get(id);
    if (avatar) { scene.remove(avatar); remotos.delete(id); }
    const etiq = etiquetasRemotas.get(id);
    if (etiq) { etiq.remove(); etiquetasRemotas.delete(id); }
  }

  function setNombreJugador(nombre) {
    if (!etiquetaLocal) etiquetaLocal = crearEtiqueta(nombre, true);
    else etiquetaLocal.textContent = nombre;
  }

  /* ---------- Control de escenario ---------- */
  function reiniciar(tipo = 'piramide', colorHex = patoColor, colorOjo = patoOjoColor, dificultad = dificultadActual, modo = 'carrera', semilla = Date.now(), spawn = null) {
    estructura.limpiar();
    coleccionables.limpiar();
    obstaculos.limpiar();
    if (powerups) powerups.limpiar();
    limpiarTrampolines();
    detenerMusica();
    if (explosionActual) { explosionActual = null; }

    escenarioActual     = tipo;
    patoColor           = colorHex;
    patoOjoColor        = colorOjo;
    dificultadAuto      = dificultad === 'auto';
    dificultadActual    = dificultadAuto ? 'facil' : (dificultad || 'normal');
    dificultadAnteriorAuto = dificultadActual;
    modoActual          = modo || 'carrera';

    setSeed(semilla);
    estructura = crearEstructura(scene, tipo, dificultadActual, CELDAS_PROTEGIDAS);
    alturaFn = estructura.alturaFn;
    elevacion = estructura.elevacion || 0;
    crearTrampolinesTorre();

    coleccionables = crearSistemaColeccionables(
      scene,
      alturaFn,
      RANGO_SPAWN_POR_ESCENARIO[tipo] || 5,
      (ix, iz) => yMundo(ix, iz)
    );
    obstaculos = crearSistemaObstaculos(
      scene,
      alturaFn,
      RANGO_SPAWN_POR_ESCENARIO[tipo] || 5,
      (ix, iz) => yMundo(ix, iz),
      puedeOcuparObstaculo
    );
    obstaculos.configurar(dificultadActual);
    powerups = crearSistemaPowerups(
      scene,
      alturaFn,
      RANGO_SPAWN_POR_ESCENARIO[tipo] || 5,
      (ix, iz) => yMundo(ix, iz),
      puedeOcuparObstaculo
    );
    minaTick = 0;
    itemTick  = 0;
    shrinkTick = 0;
    rangoActivo = 10;
    powerupTick = INTERVALO_POWERUP - 6; // primer power-up a los ~6s
    escudoActivo  = false;
    plumaRestante = 0;
    imanRestante  = 0;
    rachaRestante = 0;
    squashT = 0;
    escudoMesh.visible = false;

    saciedadMax = SACIEDAD_MAX_POR_MODO[modoActual] ?? SACIEDAD_MAX_POR_MODO.carrera;
    saciedad   = 0;
    satisfecho = false;
    nubeCimaT  = 0;
    if (nubeCima) { scene.remove(nubeCima); nubeCima = null; }

    spawnActual = spawn || null;
    const inicio = spawnActual || INICIO_POR_ESCENARIO[tipo] || { x: 0, z: 9 };
    celdaX = inicio.x;
    celdaZ = inicio.z;
    saltando = false;
    saltoT = 0;
    duracionSaltoActual = DURACION_SALTO;
    saltoLentoPendiente = false;
    impulsoSalto = 0;
    muerto = false;
    vidas = 3;
    score = 0;
    racha = 0;
    cronometroT = 0;
    cronometroActivo = false;

    aguaT = 0;
    nivelAgua = 0;
    if (planoAgua) {
      planoAgua.visible = (tipo === 'piramide');
      planoAgua.position.y = -0.2;
    }

    if (elTiempo) { elTiempo.textContent = '00:00'; elTiempo.style.color = ''; }

    bob.remove(pato);
    pato = crearPato(patoColor, patoOjoColor);
    pato.position.y = 1;
    pato.scale.setScalar(1.4);
    bob.add(pato);
    bob.visible = true;

    jugador.position.set(celdaX * 2, yMundo(celdaX, celdaZ), celdaZ * 2);
    alturaSaltoDesde = alturaEfectiva(celdaX, celdaZ);

    camAngle  = escenarioActual === 'piramide' ? Math.PI / 2 : Math.atan2(inicio.z, inicio.x);
    camTarget = camAngle;
    camLookX  = celdaX * 2;
    camLookZ  = celdaZ * 2;
    camLookY  = yMundo(celdaX, celdaZ);
    patoRotTarget = Math.atan2(inicio.z, -inicio.x);
    jugador.rotation.y = patoRotTarget;

    const esMulti = dificultadAuto; // multiplayer usa dificultad 'auto'
    modoFPS = !esMulti && tipo !== 'arena' && tipo !== 'batalla';
    if (tipo === 'arena' || tipo === 'batalla') {
      camera.position.set(0, 36, 28);
      camera.lookAt(0, 0, 0);
    } else if (esMulti) {
      // Cámara lejana para multijugador en cualquier escenario
      camera.position.set(22, 28, 22);
      camera.lookAt(0, 8, 0);
    } else {
      camera.position.set(
        celdaX * 2 - Math.cos(patoRotTarget) * 3,
        yMundo(celdaX, celdaZ) + 5,
        celdaZ * 2 + Math.sin(patoRotTarget) * 3
      );
    }

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
    obstaculos.poblar({ celdaX, celdaZ });
    actualizarBarraAgua();
    actualizarBarraSaciedad();
    actualizarPowerupHUD();
    const elBar = document.getElementById('hud-saciedad-relleno');
    if (elBar) elBar.classList.remove('saciedad__relleno--llena');
  }

  function pausarCronometro()   { cronometroActivo = false; detenerMusica(); }
  function reanudarCronometro() {
    if (cronometroT > 0 && !muerto) { cronometroActivo = true; iniciarMusica(); }
  }

  return {
    scene,
    jugador,
    agregarJugadorRemoto,
    moverJugadorRemoto,
    quitarJugadorRemoto,
    mostrarVictoriaBatalla,
    reiniciar,
    pausarCronometro,
    reanudarCronometro,
    setNombreJugador,
  };
}
