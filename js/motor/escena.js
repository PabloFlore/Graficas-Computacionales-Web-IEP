import * as THREE from 'three';
import { crearEstructura } from './piramide.js';
import { crearPato } from './pato.js';
import { crearExplosion } from './explosion.js';
import { crearSistemaColeccionables } from './coleccionables.js';
import { crearNubes } from './nubes.js';

const INICIO_POR_ESCENARIO = {
  piramide: { x: 0, z: 5 },
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

function lerp(a, b, t) { return a + (b - a) * t; }

export async function iniciarEscena({ alMoverJugador } = {}) {
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
  let sistemaDeNubes = crearNubes(scene, 'piramide');
  coleccionables.spawnEnNivel(1, estructura.nivelMaxVisible, 0.12);

  /* ---------- Celdas visitadas (para minas generativas) ---------- */
  const visitadas = new Set();

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
  const nivelesEls = document.querySelectorAll('.nivel');

  function actualizarHUD() {
    const nivelActual = Math.min(11, alturaEfectiva(celdaX, celdaZ));
    nivelesEls.forEach((el, i) => {
      el.classList.toggle('nivel--activo', i + 1 === nivelActual);
    });
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

  /* ---------- Generación dinámica de minas ---------- */
  function intentarSpawnMinas(x, z) {
    const key = `${x},${z}`;
    if (visitadas.has(key)) return;
    visitadas.add(key);

    const nivel = alturaFn(x, z);
    if (nivel < 3) return;

    const prob = 0.04 + nivel * 0.012;
    const vecinos = [
      [x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1],
      [x + 1, z + 1], [x - 1, z - 1], [x + 1, z - 1], [x - 1, z + 1],
    ];
    vecinos.forEach(([nx, nz]) => {
      const nk = `${nx},${nz}`;
      if (!visitadas.has(nk) && alturaFn(nx, nz) > 1 && Math.random() < prob) {
        estructura.convertirEnMina(nx, nz);
      }
    });
  }

  /* ---------- Colisión con mina y expansión de pirámide ---------- */
  function procesarAterrizaje(x, z) {
    const pts = coleccionables.recoger(x, z);
    if (pts !== null) {
      racha++;
      const mult = racha >= 3 ? 2 : 1;
      score += pts * mult;
      actualizarScore();
    } else {
      racha = 0;
    }

    if (estructura.esMina(x, z)) {
      vidas--;
      actualizarVidas();
      muerto = true;
      bob.visible = false;

      explosionActual = crearExplosion(scene, jugador.position.clone());

      if (vidas <= 0) {
        setTimeout(() => mostrarGameOver(), 900);
      } else {
        setTimeout(() => respawnJugador(), 900);
      }
      return;
    }

    intentarSpawnMinas(x, z);

    /* Revelar siguiente nivel de la pirámide al llegar a la cima visible */
    if (escenarioActual === 'piramide' && estructura.nivelMaxVisible < 11) {
      if (alturaFn(x, z) >= estructura.nivelMaxVisible) {
        const nextNivel = estructura.nivelMaxVisible + 1;
        estructura.revelarNivel(nextNivel);
        coleccionables.spawnEnNivel(nextNivel, nextNivel, 0.12);
      }
    }

    actualizarHUD();
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

  /* ---------- Reintentar (game over) ---------- */
  document.addEventListener('click', (e) => {
    if (e.target.closest('#boton-reintentar')) {
      const overlay = document.getElementById('game-over');
      if (overlay) overlay.classList.add('oculto');
      reiniciar(escenarioActual, patoColor);
    }
  });

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

    coleccionables.animar(delta);
    estructura.animarMinas(delta);
    sistemaDeNubes.animar(delta);
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
  function reiniciar(tipo = 'piramide', colorHex = patoColor, colorOjo = patoOjoColor) {
    estructura.limpiar();
    coleccionables.limpiar();
    visitadas.clear();
    if (explosionActual) { explosionActual = null; }

    escenarioActual = tipo;
    patoColor    = colorHex;
    patoOjoColor = colorOjo;

    estructura = crearEstructura(scene, tipo);
    alturaFn = estructura.alturaFn;
    elevacion = estructura.elevacion || 0;
    sistemaDeNubes.limpiar();
    sistemaDeNubes = crearNubes(scene, tipo);

    coleccionables = crearSistemaColeccionables(scene, alturaFn, RANGO_POR_ESCENARIO[tipo] || 5);
    if (tipo === 'piramide') {
      coleccionables.spawnEnNivel(1, estructura.nivelMaxVisible, 0.12);
    } else {
      coleccionables.spawnEnNivel(2, 11, 0.12);
    }

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

    if (elTiempo) elTiempo.textContent = '00:00';

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

    const overlay = document.getElementById('game-over');
    if (overlay) overlay.classList.add('oculto');

    actualizarHUD();
    actualizarVidas();
    actualizarScore();
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
