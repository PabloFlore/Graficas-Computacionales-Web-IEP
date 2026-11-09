import * as THREE from 'three';
import { crearGestorCarga, cargarModelos } from './modelos.js';
import {
  crearPiramide,
  destruirPiramide,
  alturaEn,
  celdasMina,
  marcarMinas,
  nuevaSemilla,
  aplicarTipoTapa,
  powerupsDelTablero,
  DIFICULTADES,
  DIFICULTAD_POR_DEFECTO,
  TOTAL_NIVELES,
  RADIO,
  MODOS,
  radioDe,
  spawnsDe,
  esCimaArcade
} from './piramide.js';
import { crearSalto, crearMezclador, crearRebote, crearGiro, crearBarrido } from './animaciones.js';
import { crearParticulas } from './particulas.js';
import { pintarHud, pintarHudArcade, mostrarFinPartida, ocultarFinPartida } from './hud.js';

const MODELOS = [
  {
    tipo: 'glb',
    ruta: 'assets/models/duck.glb',
    nombre: 'Duck',
    escala: new THREE.Vector3(0.51, 0.51, 0.51),
    posicion: new THREE.Vector3(0, 0.2, 0),
  },
  {
    tipo: 'glb',
    ruta: 'assets/models/spring.glb',
    nombre: 'Spring',
    escala: new THREE.Vector3(0.04, 0.04, 0.04),
    posicion: new THREE.Vector3(2.83, -0.46, 8.49),
  },
  {
    tipo: 'glb',
    ruta: 'assets/models/escudo.glb',
    nombre: 'Escudo',
    escala: new THREE.Vector3(0.22, 0.22, 0.22),
    posicion: new THREE.Vector3(5.66, -0.5, 5.66),
    rotacion: new THREE.Euler(0, Math.PI, 0),
  },
  {
    tipo: 'glb',
    ruta: 'assets/models/radar.glb',
    nombre: 'Radar',
    escala: new THREE.Vector3(3.2, 3.2, 3.2),
    posicion: new THREE.Vector3(8.49, -0.5, 2.83),
  },
];

/**
 * Duracion del modo arcade local. Se puede acortar para demos con el parametro
 * de la URL `?arcade=20`; sin parametro vale 90 s como la regla normal.
 */
function duracionArcadeDemo() {
  const valor = Number(new URLSearchParams(window.location.search).get('arcade'));
  return Number.isFinite(valor) && valor > 0 ? valor : 90;
}

/**
 * Permite apagar las particulas con `?particulas=0` y reduce su cantidad
 * cuando el sistema operativo pide menos movimiento.
 */
function configuracionParticulas() {
  const valor = (new URLSearchParams(window.location.search).get('particulas') || '')
    .toLowerCase();
  const desactivadas = ['0', 'off', 'false', 'no'].includes(valor);
  const reducido = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  return {
    habilitado: !desactivadas,
    escala: reducido ? 0.35 : 1
  };
}

/**
 * Devuelve las pistas de animacion de un modelo, sin importar si vienen
 * en `userData.animations` (como las guarda cargarModeloGLB) o en
 * `animations` (propiedad directa del objeto).
 */
function pistasDe(modelo) {
  if (!modelo) {
    return null;
  }

  const deUserData = modelo.userData ? modelo.userData.animations : null;
  if (Array.isArray(deUserData)) {
    return deUserData;
  }

  return Array.isArray(modelo.animations) ? modelo.animations : null;
}

export async function iniciarEscena({
  alMoverJugador,
  dificultad = DIFICULTAD_POR_DEFECTO,
  alRecogerPowerup,
  alLlegarCima,
  alPisarMina,
  alEmpujar,
  alRegistrarPuntaje
} = {}) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const vistaJuego = document.getElementById('vista-juego');
  vistaJuego.insertBefore(renderer.domElement, vistaJuego.firstChild);

  const configParticulas = configuracionParticulas();
  const particulas = crearParticulas(scene, {
    camara: camera,
    max: 480,
    ...configParticulas
  });

  /* ---------- Pirámide ---------- */
  const claveCelda = (ix, iz) => `${ix},${iz}`;
  const nivelInicial = Object.hasOwn(DIFICULTADES, dificultad) ? dificultad : DIFICULTAD_POR_DEFECTO;
  let dificultadActual = nivelInicial;
  let nivelActual = 1;
  let modoActual = MODOS.clasico;
  let radioActual = RADIO;
  let semilla = nuevaSemilla();
  let minas = celdasMina(DIFICULTADES[dificultadActual], semilla, nivelActual, modoActual);
  let cubosPiramide = crearPiramide(scene, minas, nivelActual, modoActual);

  // Recalcula las minas con la nueva probabilidad y cambia solo la tapa de
  // cada columna. Las celdas que pasan a ser mina no afectan al jugador hasta
  // que intente entrar en ellas. Los powerups se generan evitando las minas de
  // la dificultad mas alta del nivel actual.
  function aplicarDificultad(nivel) {
    if (modoActual === MODOS.arcade || !Object.hasOwn(DIFICULTADES, nivel)) {
      return;
    }

    dificultadActual = nivel;
    minas = celdasMina(DIFICULTADES[nivel], semilla, nivelActual, modoActual);
    marcarMinas(cubosPiramide, minas, nivelActual, modoActual);
    refrescarTapas();
  }

  /* ---------- Estado de partida y del jugador local ---------- */
  const VIDAS_INICIALES = 3;
  const DURACION_ATURDIMIENTO = 2;
  const DURACION_RADAR = 5;
  const DURACION_AVISO_FIN = 3.5;
  const DEMORA_REINICIO_LOCAL = 3;
  const DURACION_ARCADE = duracionArcadeDemo();
  const CUENTA_ARCADE = 3;
  const REINICIO_ARCADE = 5;
  let tiempoJuego = 0;
  let inventario = null;
  let movimientos = 0;
  let vidas = VIDAS_INICIALES;
  let aturdidoHasta = 0;
  let radarHasta = 0;
  let radarVisibleAnterior = false;
  let hudActivoAnterior = false;
  let miId = null;
  let recogidaPendiente = false;
  let cimaPendiente = false;
  let finPartidaHasta = 0;
  let reinicioLocalHasta = 0;
  // Sin servidor solo existe el jugador local; el servidor sobreescribe estos
  // valores en cuanto identifica la partida.
  let jugadoresActivos = 1;
  let jugadoresConectados = 1;
  const tomados = new Set();
  const marcadores = new Map(); // "ix,iz" -> { obj, tipo }
  let powerupsTablero = powerupsDelTablero(semilla, nivelActual, modoActual);

  let arcadeEstado = 'espera';
  let arcadeRestante = DURACION_ARCADE;
  let arcadeCuentaRestante = CUENTA_ARCADE;
  let arcadeTiempoCima = 0;
  let arcadeRonda = 0;
  let arcadeRanking = [];
  let arcadeJugadores = [];
  let arcadeServidorActivo = false;
  let arcadeFinHasta = 0;
  let arcadeHudAcumulado = 0;
  let arcadeCimaPisada = false;
  let arcadeAuraAcumulada = 0;
  let arcadeSobreCima = false;
  let ultimaRondaPuntuada = null;

  const radarActivo = () => tiempoJuego < radarHasta;
  const estaAturdido = () => tiempoJuego < aturdidoHasta;
  const arcadePuedeJugar = () => modoActual !== MODOS.arcade || arcadeEstado === 'jugando';
  const puedeActuar = () => arcadePuedeJugar()
    && !rebote && !salto?.estaEnSalto() && !estaAturdido() && vidas > 0;

  // Las minas solo se muestran mientras el radar del jugador local esta activo.
  // Las tapas se pintan neutras por defecto y solo cambian si hace falta.
  function refrescarTapas() {
    const revelar = radarActivo();
    cubosPiramide.forEach((cubo) => {
      const ix = Math.round(cubo.mesh.position.x);
      const iz = Math.round(cubo.mesh.position.z);
      if (cubo.nivel !== alturaEn(ix, iz, nivelActual, modoActual) - 1) {
        return;
      }

      const visible = modoActual !== MODOS.arcade && revelar && cubo.tipo === 'mina'
        ? 'mina'
        : 'seguro';
      if (cubo.tipoVisible !== visible) {
        aplicarTipoTapa(cubo.mesh, visible, nivelActual, modoActual);
        cubo.tipoVisible = visible;
      }
    });
  }

  function actualizarHud() {
    if (modoActual === MODOS.arcade) {
      pintarHudArcade({
        estado: arcadeEstado,
        restante: arcadeRestante,
        cuentaRestante: arcadeCuentaRestante,
        tiempoCima: arcadeTiempoCima,
        ranking: arcadeRanking,
        jugadores: arcadeJugadores
      });
      return;
    }

    pintarHud({
      inventario,
      movimientos,
      vidas,
      totalVidas: VIDAS_INICIALES,
      nivel: nivelActual,
      totalNiveles: TOTAL_NIVELES,
      jugadoresActivos,
      jugadoresConectados,
      aturdidoRestante: Math.max(0, aturdidoHasta - tiempoJuego),
      radarRestante: Math.max(0, radarHasta - tiempoJuego)
    });
  }

  function textoAvisoRonda(datos) {
    if (datos.motivo === 'partida') {
      const nombre = datos.ganador ? datos.ganador.nombre : 'Vos';
      return `¡Partida completa! ${nombre} ganó los 3 niveles`;
    }
    if (datos.motivo === 'nivel') {
      const nombre = datos.ganador ? datos.ganador.nombre : 'Vos';
      return `Nivel ${datos.nivel} · ${nombre} llegó a la cima`;
    }
    if (datos.ganador) {
      return `Ganó ${datos.ganador.nombre} en ${datos.movimientos} movimientos`;
    }
    if (datos.motivo === 'todos-eliminados') {
      return 'Todos eliminados · volvemos al nivel 1';
    }
    return 'Nueva ronda';
  }

  /* ---------- Jugador ---------- */
  let spawnX = spawnsDe(modoActual)[0].x;
  let spawnZ = spawnsDe(modoActual)[0].z;
  const alturaSpawn = () => alturaEn(spawnX, spawnZ, nivelActual, modoActual);

  const jugador = new THREE.Group();
  const bob = new THREE.Group();
  jugador.add(bob);
  scene.add(jugador);
  jugador.position.set(spawnX, alturaSpawn(), spawnZ);

  const COLOR_POWERUP = {
    resorte: '#7bd88f',
    escudo: '#6ec6ff',
    radar: '#ffb74d'
  };

  function emitirEnCelda(tipo, ix, iz, opciones = {}) {
    const x = Number.isFinite(ix) ? ix : 0;
    const z = Number.isFinite(iz) ? iz : 0;
    particulas.emitir(tipo, {
      x,
      y: alturaEn(x, z, nivelActual, modoActual) + 0.45,
      z,
      ...opciones
    });
  }

  function emitirEnJugador(tipo, opciones = {}) {
    particulas.emitir(tipo, {
      x: jugador.position.x,
      y: jugador.position.y + 0.25,
      z: jugador.position.z,
      ...opciones
    });
  }

  function emitirConfetiCima() {
    emitirEnCelda('confeti', 0, 0, {
      y: alturaEn(0, 0, nivelActual, modoActual) + 0.9,
      count: 42
    });
  }

  function emitirAuraCima(x, z, alturaExtra = 0.55) {
    const ix = Math.round(x);
    const iz = Math.round(z);
    particulas.emitir('aura', {
      x: x + (Math.random() - 0.5) * 1.6,
      y: alturaEn(ix, iz, nivelActual, modoActual) + alturaExtra + Math.random() * 0.6,
      z: z + (Math.random() - 0.5) * 1.6,
      count: 1
    });
  }

  function emitirImpacto(x, y, z) {
    particulas.emitir('impacto', {
      x,
      y: y + 0.3,
      z,
      count: 14
    });
  }

  function emitirTeletransporte(desdeX, desdeY, desdeZ, hastaX, hastaY, hastaZ) {
    particulas.emitir('teleport', {
      x: desdeX,
      y: desdeY + 0.3,
      z: desdeZ,
      count: 20
    });
    particulas.emitir('teleport', {
      x: hastaX,
      y: hastaY + 0.3,
      z: hastaZ,
      count: 20
    });
  }

  /* ---------- Luces ---------- */

  const luzAmbiental = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(luzAmbiental);

  const sol = new THREE.DirectionalLight(0xffffff, 1.1);
  sol.position.set(10, 12, 10);
  scene.add(sol);

  const luzFocal = new THREE.SpotLight(0xfff1c9, 35, 35, Math.PI / 5, 0.45, 1.5);
  luzFocal.position.set(4, 12, 4);
  luzFocal.target = jugador;
  luzFocal.castShadow = true;
  luzFocal.shadow.mapSize.set(1024, 1024);
  luzFocal.shadow.camera.near = 0.5;
  luzFocal.shadow.camera.far = 40;
  luzFocal.shadow.bias = -0.0005;
  luzFocal.shadow.normalBias = 0.02;
  scene.add(luzFocal);

  /* ---------- Cámara (isométrica por defecto, cenital con V) ---------- */
  const VISTA_ISOMETRICA_CLASICA = {
    posicion: new THREE.Vector3(14, 14, 14),
    objetivo: new THREE.Vector3(0, 2, 0),
    arriba: new THREE.Vector3(0, 1, 0)
  };
  const VISTA_ISOMETRICA_ARCADE = {
    posicion: new THREE.Vector3(24, 26, 24),
    objetivo: new THREE.Vector3(0, 3, 0),
    arriba: new THREE.Vector3(0, 1, 0)
  };
  const VISTA_CENITAL_CLASICA = {
    posicion: new THREE.Vector3(0, 18, 0.01),
    objetivo: new THREE.Vector3(0, 0, 0),
    arriba: new THREE.Vector3(0, 0, -1)
  };
  const VISTA_CENITAL_ARCADE = {
    posicion: new THREE.Vector3(0, 30, 0.01),
    objetivo: new THREE.Vector3(0, 0, 0),
    arriba: new THREE.Vector3(0, 0, -1)
  };
  let vistaCenital = false;

  function aplicarCamara() {
    const arcade = modoActual === MODOS.arcade;
    const vista = vistaCenital
      ? (arcade ? VISTA_CENITAL_ARCADE : VISTA_CENITAL_CLASICA)
      : (arcade ? VISTA_ISOMETRICA_ARCADE : VISTA_ISOMETRICA_CLASICA);
    camera.up.copy(vista.arriba);
    camera.position.copy(vista.posicion);
    camera.lookAt(vista.objetivo);
  }

  // Vista satelital local: solo cambia la camara de este cliente, no se envia
  // al servidor ni afecta a los demas jugadores.
  function alternarVista() {
    vistaCenital = !vistaCenital;
    aplicarCamara();
  }

  aplicarCamara();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    particulas.redimensionar();
  });

  /* ---------- Animación ---------- */
  const reloj = new THREE.Clock();

  const mixers = [];

  /* ---------- Estado del jugador y de los avatares remotos ---------- */
  let plantillaPato = null;
  let salto = null;
  const remotos = new Map();
  const decorativos = [];

  /* ---------- Carga del pato ---------- */
  const gestor = crearGestorCarga();
  const modelosCargados = await cargarModelos(MODELOS, gestor);

  const buscarModelo = (nombre) => modelosCargados.find((modelo) => modelo.name === nombre);

  plantillaPato = buscarModelo('Duck');
  if (plantillaPato) {
    bob.add(plantillaPato);
    plantillaPato.traverse((objeto) => {
      if (objeto.isMesh) {
        objeto.castShadow = true;
        objeto.receiveShadow = true;
      }
    });

    const pistas = pistasDe(plantillaPato);
    if (pistas && pistas.length) {
      const m = new THREE.AnimationMixer(plantillaPato);
      pistas.forEach((clip) => m.clipAction(clip).play());
      mixers.push(m);
    }
  }

  // Powerups: un clon de la plantilla del GLB por celda, normalizado a un
  // tamano fijo y apoyado sobre la tapa. Las plantillas no se agregan a la
  // escena; solo se usan para clonar.
  const PLANTILLAS_POWERUP = { resorte: 'Spring', escudo: 'Escudo', radar: 'Radar' };
  const ANIMACION_POWERUP = {
    resorte: (objeto) => crearRebote(objeto, { amplitud: 0.3, frecuencia: 4 }),
    escudo: (objeto) => crearGiro(objeto, { velocidad: 1.2 }),
    radar: (objeto) => crearBarrido(objeto, { velocidad: 4, amplitud: 0.06, frecuencia: 6 }),
  };
  const TAMANO_POWERUP = 0.5;

  // Rehace los marcadores de powerup de la ronda actual. Los clones comparten
  // geometria y materiales con las plantillas, por eso solo se quitan de la
  // escena (no se destruyen).
  function construirPowerups() {
    marcadores.forEach((marca) => {
      scene.remove(marca.obj);
    });
    marcadores.clear();
    decorativos.length = 0;

    powerupsTablero.forEach((tipo, clave) => {
      const plantilla = buscarModelo(PLANTILLAS_POWERUP[tipo]);
      if (!plantilla) {
        return;
      }

      const objeto = plantilla.clone();
      objeto.position.set(0, 0, 0);
      objeto.scale.setScalar(1);
      objeto.traverse((hijo) => {
        if (hijo.isMesh) {
          hijo.castShadow = true;
          hijo.receiveShadow = true;
        }
      });
      scene.add(objeto);

      objeto.updateMatrixWorld(true);
      const tamano = new THREE.Box3().setFromObject(objeto).getSize(new THREE.Vector3());
      const maximo = Math.max(tamano.x, tamano.y, tamano.z) || 1;
      objeto.scale.setScalar(TAMANO_POWERUP / maximo);

      objeto.updateMatrixWorld(true);
      const caja = new THREE.Box3().setFromObject(objeto);
      const centro = caja.getCenter(new THREE.Vector3());
      const [ix, iz] = clave.split(',').map(Number);
      const topeTapa = alturaEn(ix, iz, nivelActual, modoActual) - 0.5;
      objeto.position.set(ix - centro.x, topeTapa - caja.min.y + 0.02, iz - centro.z);

      marcadores.set(clave, { obj: objeto, tipo });
      decorativos.push({ animacion: ANIMACION_POWERUP[tipo](objeto) });
    });
  }

  // Reconstruye el tablero de una ronda: geometria si cambia el nivel, minas,
  // powerups y sus visuales. Sin semilla valida (modo local) se genera una.
  function aplicarTablero(nueva, nivel = nivelActual) {
    if (modoActual === MODOS.arcade) {
      return;
    }

    const nivelDestino = Number.isInteger(nivel) ? nivel : nivelActual;
    const cambiaNivel = nivelDestino !== nivelActual;

    nivelActual = nivelDestino;
    semilla = Number.isInteger(nueva) ? nueva : nuevaSemilla();
    minas = celdasMina(DIFICULTADES[dificultadActual], semilla, nivelActual, modoActual);

    if (cambiaNivel) {
      destruirPiramide(scene, cubosPiramide);
      cubosPiramide = crearPiramide(scene, minas, nivelActual, modoActual);
    } else {
      marcarMinas(cubosPiramide, minas, nivelActual, modoActual);
    }

    powerupsTablero = powerupsDelTablero(semilla, nivelActual, modoActual);
    construirPowerups();
    refrescarTapas();
  }

  construirPowerups();
  refrescarTapas();

  salto = crearSalto(jugador, plantillaPato);

  const mixerBob = new THREE.AnimationMixer(bob);
  mixers.push(mixerBob);

  const pistaBob = new THREE.NumberKeyframeTrack(
    '.position[y]',
    [0,     0.5,   1.0],
    [-0.5, -0.42, -0.5]
  );
  const clipBob = new THREE.AnimationClip('espera', 1.0, [pistaBob]);
  mixerBob.clipAction(clipBob).setLoop(THREE.LoopRepeat).play();

  /* ---------- Control por teclado ---------- */
  const DURACION_GIRO = 0.15;
  const OFFSET_ORIENTACION = 0;
  const DURACION_REBOTE = 0.18;
  const UMBRAL_ENCARADO = 0.02;
  const EPSILON_DIRECCION = 1e-3;
  const UMBRAL_EMPUJE = 0.5;
  let rotObjetivo = 0;
  let rebote = null;

  const cajaJugadorDebug = new THREE.Box3();
  const cajaObjetivoDebug = new THREE.Box3();
  const grupoDebug = new THREE.Group();
  grupoDebug.visible = false;
  scene.add(grupoDebug);
  grupoDebug.add(
    new THREE.Box3Helper(cajaJugadorDebug, 0x39ff14),
    new THREE.Box3Helper(cajaObjetivoDebug, 0xff6b57)
  );

  function cajaDeJugador(x, y, z) {
    return new THREE.Box3(
      new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5),
      new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)
    );
  }

  function cajaDeColumna(ix, iz) {
    const altura = alturaEn(ix, iz, nivelActual, modoActual);
    return new THREE.Box3(
      new THREE.Vector3(ix - 0.5, -0.5, iz - 0.5),
      new THREE.Vector3(ix + 0.5, altura - 0.5, iz + 0.5)
    );
  }

  function estaEnRango(ix, iz) {
    return Math.abs(ix) <= radioActual && Math.abs(iz) <= radioActual;
  }

  function esMina(ix, iz) {
    return minas.has(claveCelda(ix, iz));
  }

  function jugadorRemotoEnCelda(ix, iz) {
    for (const [id, entrada] of remotos) {
      const { avatar } = entrada;
      if (
        Math.round(avatar.position.x) === ix &&
        Math.round(avatar.position.z) === iz
      ) {
        return { id, entrada };
      }
    }

    return null;
  }

  function celdaOcupadaPorJugador(ix, iz) {
    return jugadorRemotoEnCelda(ix, iz) !== null;
  }

  function evaluarCelda(ix, iz, alturaActual, { atravesarMinas = false, maxSubida = 1 } = {}) {
    if (!estaEnRango(ix, iz)) {
      return { ok: false, motivo: 'limite', altura: 0 };
    }

    const esCeldaMina = esMina(ix, iz);

    if (esCeldaMina && !atravesarMinas) {
      return { ok: false, motivo: 'mina', altura: alturaEn(ix, iz, nivelActual, modoActual) };
    }

    const altura = alturaEn(ix, iz, nivelActual, modoActual);

    if (celdaOcupadaPorJugador(ix, iz)) {
      return { ok: false, motivo: 'jugador', altura };
    }

    const cajaJugador = cajaDeJugador(ix, alturaActual, iz);
    const cajaColumna = cajaDeColumna(ix, iz);
    const hayContacto = cajaJugador.intersectsBox(cajaColumna);

    if (hayContacto && altura > alturaActual + maxSubida) {
      return { ok: false, motivo: 'muro', altura };
    }

    return { ok: true, altura, mina: esCeldaMina };
  }

  function intentarEmpuje(destinoX, destinoZ, dx, dz, alturaActual) {
    if (modoActual !== MODOS.arcade || !arcadeServidorActivo) {
      return false;
    }

    if (typeof alEmpujar !== 'function') {
      return false;
    }

    const ocupante = jugadorRemotoEnCelda(destinoX, destinoZ);
    if (!ocupante) {
      return false;
    }

    const { id, entrada } = ocupante;
    if (entrada.salto.estaEnSalto()) {
      return false;
    }

    const alineacion = Math.sin(entrada.rotObjetivo) * dx + Math.cos(entrada.rotObjetivo) * dz;
    if (alineacion < UMBRAL_EMPUJE) {
      return false;
    }

    const empujeX = destinoX + dx;
    const empujeZ = destinoZ + dz;

    if (!estaEnRango(empujeX, empujeZ) || jugadorRemotoEnCelda(empujeX, empujeZ)) {
      return false;
    }

    const alturaDestino = alturaEn(destinoX, destinoZ, nivelActual, modoActual);
    if (alturaDestino > alturaActual + 1) {
      return false;
    }

    const alturaEmpuje = alturaEn(empujeX, empujeZ, nivelActual, modoActual);
    if (alturaEmpuje > alturaDestino + 1) {
      return false;
    }

    return alEmpujar(id, dx, dz) !== false;
  }

  function actualizarCajasDebug(ix, iz) {
    cajaJugadorDebug.copy(cajaDeJugador(jugador.position.x, jugador.position.y, jugador.position.z));
    if (Number.isInteger(ix) && Number.isInteger(iz) && estaEnRango(ix, iz)) {
      cajaObjetivoDebug.copy(cajaDeColumna(ix, iz));
    }
  }

  function emitirPosicion(rotY = jugador.rotation.y) {
    if (typeof alMoverJugador === 'function') {
      alMoverJugador(jugador.position, rotY);
    }
  }

  function diferenciaAngular(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  function anguloDeDireccion(dx, dz) {
    return Math.atan2(dx, dz) + OFFSET_ORIENTACION;
  }

  function miraHacia(objetivo) {
    return Math.abs(diferenciaAngular(jugador.rotation.y, objetivo)) < UMBRAL_ENCARADO;
  }

  function mismaDireccion(a, b) {
    return Math.abs(diferenciaAngular(a, b)) < EPSILON_DIRECCION;
  }

  function intentarMovimiento(dx, dz) {
    if (!puedeActuar()) {
      return;
    }

    const objetivo = anguloDeDireccion(dx, dz);

    if (!mismaDireccion(rotObjetivo, objetivo) && !miraHacia(objetivo)) {
      rotObjetivo = objetivo;
      actualizarCajasDebug(
        Math.round(jugador.position.x) + dx,
        Math.round(jugador.position.z) + dz
      );
      emitirPosicion(rotObjetivo);
      return;
    }

    moverLocal(dx, dz);
  }

  function moverLocal(dx, dz) {
    if (!puedeActuar()) {
      return;
    }

    rotObjetivo = anguloDeDireccion(dx, dz);
    const ix = Math.round(jugador.position.x);
    const iz = Math.round(jugador.position.z);
    const alturaActual = alturaEn(ix, iz, nivelActual, modoActual);
    const destinoX = ix + dx;
    const destinoZ = iz + dz;

    actualizarCajasDebug(destinoX, destinoZ);
    const destino = evaluarCelda(destinoX, destinoZ, alturaActual, {
      atravesarMinas: inventario === 'escudo'
    });

    if (destino.motivo === 'mina') {
      golpearMina(ix, iz, destinoX, destinoZ, dx, dz, alturaActual);
      return;
    }

    if (destino.motivo === 'jugador'
      && intentarEmpuje(destinoX, destinoZ, dx, dz, alturaActual)) {
      return;
    }

    if (!destino.ok) {
      return;
    }

    if (destino.mina) {
      consumirEscudo();
    }

    jugador.position.set(destinoX, destino.altura, destinoZ);
    movimientos += 1;
    emitirPosicion(rotObjetivo);
    alLlegarCelda(destinoX, destinoZ);
    actualizarHud();
  }

  // El escudo se consume al pisar una mina y deja pasar al jugador; la mina
  // sigue armada para el proximo golpe sin escudo.
  function consumirEscudo() {
    inventario = null;
    actualizarHud();
  }

  // Mina sin escudo: pierde una vida, rebota una celda y queda aturdido.
  // `minaX/minaZ` es la celda de la mina (con resorte puede estar a 2 celdas).
  function golpearMina(ix, iz, minaX, minaZ, dx, dz, alturaActual) {
    const enviado = typeof alPisarMina === 'function' ? alPisarMina(minaX, minaZ) : false;
    if (!enviado) {
      vidas = Math.max(0, vidas - 1);
      if (vidas === 0) {
        programarReinicioLocal();
      }
    }

    emitirEnCelda('chispa', minaX, minaZ, { count: 26 });
    emitirEnCelda('humo', minaX, minaZ, { count: 8 });
    iniciarRebote(ix, iz, dx, dz, alturaActual);
    aturdidoHasta = tiempoJuego + DURACION_ATURDIMIENTO;
    actualizarHud();
    return 'mina';
  }

  // Sin servidor el jugador local es el unico de la partida: al quedarse sin
  // vidas se programa una ronda nueva con la misma espera que usa el servidor.
  function programarReinicioLocal() {
    if (reinicioLocalHasta > 0) {
      return;
    }

    reinicioLocalHasta = tiempoJuego + DEMORA_REINICIO_LOCAL;
    mostrarFinPartida(`Sin vidas · nueva ronda en ${DEMORA_REINICIO_LOCAL} s`);
  }

  function notificarPuntaje(datos) {
    if (typeof alRegistrarPuntaje !== 'function') {
      return;
    }

    try {
      const resultado = alRegistrarPuntaje(datos);
      if (resultado && typeof resultado.catch === 'function') {
        resultado.catch((error) => {
          console.error('Error registrando puntuación:', error);
        });
      }
    } catch (error) {
      console.error('Error registrando puntuación:', error);
    }
  }

  function notificarPuntajeArcade() {
    if (ultimaRondaPuntuada === arcadeRonda) {
      return;
    }

    ultimaRondaPuntuada = arcadeRonda;
    notificarPuntaje({ modo: MODOS.arcade, tiempoCima: arcadeTiempoCima });
  }

  // Al terminar un movimiento: recoge el powerup de la celda si la hay y si el
  // inventario esta libre, y comprueba la llegada a la cima.
  function alLlegarCelda(ix, iz) {
    if (modoActual === MODOS.arcade) {
      return;
    }

    const clave = `${ix},${iz}`;
    const tipo = powerupsTablero.get(clave);
    if (tipo && !tomados.has(clave) && !inventario && !recogidaPendiente) {
      const enviado = alRecogerPowerup ? alRecogerPowerup(ix, iz) : false;
      if (enviado) {
        recogidaPendiente = true;
      } else {
        // Sin servidor: la recogida es solo local.
        tomados.add(clave);
        if (marcadores.has(clave)) {
          marcadores.get(clave).obj.visible = false;
        }
        inventario = tipo;
        actualizarHud();
        emitirEnCelda('powerup', ix, iz, {
          color: COLOR_POWERUP[tipo] || '#7bd88f'
        });
      }
    }

    if (ix === 0 && iz === 0 && !cimaPendiente) {
      cimaPendiente = true;
      notificarPuntaje({
        modo: MODOS.clasico,
        nivel: nivelActual,
        movimientos
      });
      const enviado = alLlegarCima ? alLlegarCima(movimientos) : false;
      if (!enviado) {
        // Sin servidor: avanza de nivel (o reinicia la partida) solo aqui.
        const ultimo = nivelActual >= TOTAL_NIVELES;
        aplicarNuevaRonda({
          ganador: { nombre: 'Vos' },
          movimientos,
          motivo: ultimo ? 'partida' : 'nivel',
          nivel: ultimo ? 1 : nivelActual + 1
        });
      }
      emitirConfetiCima();
    }
  }

  function iniciarRebote(ix, iz, dx, dz, alturaActual) {
    const destinoX = ix - dx;
    const destinoZ = iz - dz;
    const destino = evaluarCelda(destinoX, destinoZ, alturaActual);

    if (!destino.ok) {
      return;
    }

    rebote = {
      t: 0,
      desdeX: ix,
      desdeY: alturaActual,
      desdeZ: iz,
      hastaX: destinoX,
      hastaY: destino.altura,
      hastaZ: destinoZ
    };
    rotObjetivo = anguloDeDireccion(-dx, -dz);
  }

  function actualizarRebote(delta) {
    if (!rebote) {
      return;
    }

    rebote.t += delta;
    const k = Math.min(1, rebote.t / DURACION_REBOTE);
    const eased = 1 - Math.pow(1 - k, 3);

    jugador.position.x = rebote.desdeX + (rebote.hastaX - rebote.desdeX) * eased;
    jugador.position.y = rebote.desdeY + (rebote.hastaY - rebote.desdeY) * eased;
    jugador.position.z = rebote.desdeZ + (rebote.hastaZ - rebote.desdeZ) * eased;
    emitirPosicion(jugador.rotation.y);

    if (k >= 1) {
      jugador.position.set(rebote.hastaX, rebote.hastaY, rebote.hastaZ);
      const { hastaX, hastaZ } = rebote;
      rebote = null;
      alLlegarCelda(hastaX, hastaZ);
    }
  }

  // Salta `distancia` celdas hacia donde mira. Devuelve 'salto' si salto,
  // 'mina' si el destino era mina sin escudo (rebote), o null si no se pudo
  // saltar. Con escudo la mina se consume y el salto aterriza en su celda.
  function intentarSalto(distancia = 1, { maxSubida = 1 } = {}) {
    if (!salto || !puedeActuar()) {
      return null;
    }

    const ix = Math.round(jugador.position.x);
    const iz = Math.round(jugador.position.z);
    const alturaActual = alturaEn(ix, iz, nivelActual, modoActual);
    const dirX = Math.round(Math.sin(rotObjetivo));
    const dirZ = Math.round(Math.cos(rotObjetivo));

    if (dirX === 0 && dirZ === 0) {
      return null;
    }

    const destinoX = ix + dirX * distancia;
    const destinoZ = iz + dirZ * distancia;
    actualizarCajasDebug(destinoX, destinoZ);
    const destino = evaluarCelda(destinoX, destinoZ, alturaActual, {
      atravesarMinas: inventario === 'escudo',
      maxSubida
    });

    if (destino.motivo === 'mina') {
      return golpearMina(ix, iz, destinoX, destinoZ, dirX, dirZ, alturaActual);
    }

    if (!destino.ok) {
      return null;
    }

    const iniciado = salto.iniciarSalto(dirX, dirZ, {
      yBase: alturaActual,
      yDestino: destino.altura,
      desplazamiento: distancia
    });

    if (!iniciado) {
      return null;
    }

    emitirEnJugador('polvo', { count: 8 });

    if (destino.mina) {
      consumirEscudo();
    }

    rotObjetivo = anguloDeDireccion(dirX, dirZ);
    movimientos += 1;
    emitirPosicion(rotObjetivo);
    actualizarHud();
    return 'salto';
  }

  // Tecla E: usa el objeto guardado. El escudo es pasivo y no se usa con E.
  function usarObjeto() {
    if (!puedeActuar()) {
      return;
    }

    if (inventario === 'radar') {
      inventario = null;
      radarHasta = tiempoJuego + DURACION_RADAR;
      refrescarTapas();
      actualizarHud();
    } else if (inventario === 'resorte') {
      const resultado = intentarSalto(2, { maxSubida: 2 });
      if (resultado === 'salto' || resultado === 'mina') {
        inventario = null;
        actualizarHud();
      }
    }
  }

  function actualizarLuzFocal() {
    luzFocal.position.set(jugador.position.x + 3.5, jugador.position.y + 8, jugador.position.z + 3.5);
    luzFocal.target.updateMatrixWorld();
  }

  function alternarLuzFocal() {
    luzFocal.visible = !luzFocal.visible;
  }

  document.addEventListener('keydown', (event) => {
    if (!vistaJuego.classList.contains('activa')) return;

    const tecla = event.key;

    if (!event.repeat && (tecla === 'c' || tecla === 'C')) {
      grupoDebug.visible = !grupoDebug.visible;
      if (grupoDebug.visible) {
        actualizarCajasDebug(
          Math.round(jugador.position.x),
          Math.round(jugador.position.z)
        );
      }
      return;
    }

    if (!event.repeat && (tecla === 'l' || tecla === 'L')) {
      alternarLuzFocal();
      return;
    }

    if (!event.repeat && (tecla === 'v' || tecla === 'V')) {
      alternarVista();
      return;
    }

    if (!event.repeat && (tecla === 'e' || tecla === 'E')) {
      usarObjeto();
      return;
    }

    if (tecla === ' ') {
      event.preventDefault();
      if (!puedeActuar()) return;
      intentarSalto(1);
      return;
    }

    if (tecla.startsWith('Arrow')) event.preventDefault();
    if (!puedeActuar()) return;

    let dirX = 0;
    let dirZ = 0;

    if (tecla === 'a' || tecla === 'ArrowLeft') dirX = -1;
    else if (tecla === 'd' || tecla === 'ArrowRight') dirX = 1;
    else if (tecla === 'w' || tecla === 'ArrowUp') dirZ = -1;
    else if (tecla === 's' || tecla === 'ArrowDown') dirZ = 1;
    else return;

    if (event.repeat) return;

    intentarMovimiento(dirX, dirZ);
  });

  function animate() {
    const delta = reloj.getDelta();
    mixers.forEach((m) => m.update(delta));

    if (vistaJuego.classList.contains('activa')) {
      // El tiempo de juego solo avanza con la vista activa: la pausa congela
      // el aturdimiento y el radar.
      tiempoJuego += delta;

      if (finPartidaHasta > 0 && tiempoJuego >= finPartidaHasta) {
        finPartidaHasta = 0;
        ocultarFinPartida();
      }

      if (reinicioLocalHasta > 0 && tiempoJuego >= reinicioLocalHasta) {
        reinicioLocalHasta = 0;
        aplicarNuevaRonda({ motivo: 'todos-eliminados', nivel: 1 });
      }

      if (rebote) {
        actualizarRebote(delta);
      }

      const estabaSaltando = Boolean(salto?.estaEnSalto());
      const saltoActivo = salto?.actualizar(delta);

      if (saltoActivo) {
        jugador.position.x = Math.max(-radioActual, Math.min(radioActual, jugador.position.x));
        jugador.position.z = Math.max(-radioActual, Math.min(radioActual, jugador.position.z));
        emitirPosicion(jugador.rotation.y);
      } else if (estabaSaltando) {
        jugador.position.x = Math.round(jugador.position.x);
        jugador.position.z = Math.round(jugador.position.z);
        emitirEnJugador('polvo', { count: 10 });
        emitirPosicion(jugador.rotation.y);
        alLlegarCelda(jugador.position.x, jugador.position.z);
      }

      // Aturdido: el pato parpadea. Radar: caduca y vuelve a ocultar las minas.
      const aturdido = estaAturdido();
      bob.visible = aturdido ? Math.floor(tiempoJuego * 10) % 2 === 0 : true;

      const radar = radarActivo();
      if (radar !== radarVisibleAnterior) {
        radarVisibleAnterior = radar;
        refrescarTapas();
      }

      const hudActivo = aturdido || radar;
      if (hudActivo || hudActivoAnterior) {
        actualizarHud();
      }
      hudActivoAnterior = hudActivo;

      const girando = girarHacia(jugador, rotObjetivo, delta);
      if (girando) {
        emitirPosicion(jugador.rotation.y);
      }

      remotos.forEach((entrada) => {
        const estabaSaltandoRemoto = entrada.salto.estaEnSalto();
        const sigueSaltando = entrada.salto.actualizar(delta);

        if (estabaSaltandoRemoto && !sigueSaltando) {
          const ix = Math.round(entrada.avatar.position.x);
          const iz = Math.round(entrada.avatar.position.z);
          if (estaEnRango(ix, iz)) {
            entrada.avatar.position.y = alturaEn(ix, iz, nivelActual, modoActual);
            particulas.emitir('polvo', {
              x: entrada.avatar.position.x,
              y: entrada.avatar.position.y + 0.1,
              z: entrada.avatar.position.z,
              count: 5
            });
          }
        }

        entrada.mezclador?.update(delta);
        girarHacia(entrada.avatar, entrada.rotObjetivo, delta);
      });

      if (grupoDebug.visible) {
        cajaJugadorDebug.copy(cajaDeJugador(jugador.position.x, jugador.position.y, jugador.position.z));
      }

      actualizarLuzFocal();
      decorativos.forEach((entrada) => entrada.animacion.actualizar(delta));
      actualizarArcadeLocal(delta);
      actualizarParticulasArcade(delta);
      particulas.actualizar(delta);

      renderer.render(scene, camera);
    }
  }

  /* ---------- Jugadores remotos (multijugador) ---------- */

  function girarHacia(objeto, objetivo, delta) {
    const paso = Math.min(1, delta / DURACION_GIRO);
    let diferencia = objetivo - objeto.rotation.y;
    diferencia = Math.atan2(Math.sin(diferencia), Math.cos(diferencia));

    if (Math.abs(diferencia) < 1e-4) {
      objeto.rotation.y = objetivo;
      return false;
    }

    objeto.rotation.y += diferencia * paso;
    return true;
  }

  function aplicarColorPato(objeto, color) {
    if (!objeto || !color) {
      return;
    }

    objeto.traverse((nodo) => {
      if (!nodo.isMesh || !nodo.material) {
        return;
      }

      const materiales = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
      materiales.forEach((material, indice) => {
        if (!material || material.name !== 'Yellow') {
          return;
        }

        const clon = material.clone();
        clon.color.set(color);

        if (Array.isArray(nodo.material)) {
          nodo.material[indice] = clon;
        } else {
          nodo.material = clon;
        }
      });
    });
  }

  // Cartel breve con el resultado de la ronda; se oculta solo en el bucle.
  function mostrarAvisoFin(datos) {
    if (!datos) {
      return;
    }

    mostrarFinPartida(textoAvisoRonda(datos));
    finPartidaHasta = tiempoJuego + DURACION_AVISO_FIN;
  }

  // Contador compartido de jugadores: activos (vidas > 0) y conectados.
  function aplicarJugadoresActivos(datos) {
    if (!datos) {
      return;
    }

    if (Number.isInteger(datos.activos)) {
      jugadoresActivos = Math.max(0, datos.activos);
    }
    if (Number.isInteger(datos.conectados)) {
      jugadoresConectados = Math.max(0, datos.conectados);
    }

    actualizarHud();
  }

  // Estado completo de la partida (al entrar y al rechazar una accion):
  // reemplaza las recogidas y sincroniza las vidas propias.
  function aplicarEstadoPartida(estado) {
    if (!estado || modoActual === MODOS.arcade) {
      return;
    }

    const nivelEstado = Number.isInteger(estado.nivel) ? estado.nivel : nivelActual;
    if (
      (Number.isInteger(estado.semilla) && estado.semilla !== semilla) ||
      nivelEstado !== nivelActual
    ) {
      aplicarTablero(estado.semilla, nivelEstado);
    }

    tomados.clear();
    (estado.tomados || []).forEach((t) => tomados.add(`${t.x},${t.z}`));
    marcadores.forEach((marca, clave) => {
      marca.obj.visible = !tomados.has(clave);
    });

    recogidaPendiente = false;
    cimaPendiente = false;

    const propia = (estado.vidas || []).find((entrada) => entrada.id === miId);
    if (propia) {
      vidas = Math.max(0, propia.vidas);
    }

    if (Number.isInteger(estado.activos)) {
      jugadoresActivos = Math.max(0, estado.activos);
    }
    if (Number.isInteger(estado.conectados)) {
      jugadoresConectados = Math.max(0, estado.conectados);
    }

    ocultarFinPartida();
    finPartidaHasta = 0;
    actualizarHud();
  }

  // Un powerup fue tomado por algun jugador. Si fue el local, pasa al inventario.
  function registrarPowerupTomado(datos) {
    if (!datos || modoActual === MODOS.arcade) {
      return;
    }

    const clave = `${datos.x},${datos.z}`;
    tomados.add(clave);
    const marca = marcadores.get(clave);
    if (marca) {
      marca.obj.visible = false;
    }

    const tipo = datos.tipo || marca?.tipo;
    emitirEnCelda('powerup', datos.x, datos.z, {
      color: COLOR_POWERUP[tipo] || '#7bd88f'
    });

    if (datos.id === miId) {
      recogidaPendiente = false;
      inventario = datos.tipo;
      actualizarHud();
    }
  }

  // Vidas propias actualizadas por el servidor tras pisar una mina.
  function aplicarVidas(datos) {
    if (!datos || modoActual === MODOS.arcade || datos.id !== miId) {
      return;
    }

    vidas = Math.max(0, Number.isInteger(datos.vidas) ? datos.vidas : 0);
    actualizarHud();
  }

  // Ronda nueva para todos: vidas, powerups, contador y posiciones de spawn.
  // La usa el servidor al llegar alguien a la cima y tambien el modo local
  // cuando no hay conexion.
  function aplicarNuevaRonda(datos) {
    if (!datos || modoActual === MODOS.arcade) {
      return;
    }

    particulas.limpiar();
    cimaPendiente = false;
    recogidaPendiente = false;
    inventario = null;
    movimientos = 0;
    aturdidoHasta = 0;
    radarHasta = 0;
    rebote = null;
    reinicioLocalHasta = 0;
    bob.visible = true;

    aplicarTablero(datos.semilla, datos.nivel);

    if (datos.ganador?.id) {
      emitirConfetiCima();
    }

    tomados.clear();
    marcadores.forEach((marca) => {
      marca.obj.visible = true;
    });

    salto?.cancelar();
    remotos.forEach((entrada) => entrada.salto.cancelar());

    const lista = Array.isArray(datos.jugadores) ? datos.jugadores : [];
    if (lista.length > 0) {
      jugadoresConectados = lista.length;
      jugadoresActivos = lista.filter((entrada) => entrada.vidas > 0).length;
    } else {
      jugadoresActivos = 1;
      jugadoresConectados = 1;
    }

    const propia = lista.find((entrada) => entrada.id === miId);
    const destino = propia || { x: spawnX, z: spawnZ, vidas: VIDAS_INICIALES };

    if (Number.isFinite(destino.x) && Number.isFinite(destino.z)) {
      const ix = Math.round(destino.x);
      const iz = Math.round(destino.z);
      if (estaEnRango(ix, iz)) {
        jugador.position.set(ix, alturaEn(ix, iz, nivelActual, modoActual), iz);
      }
    }

    rotObjetivo = 0;
    jugador.rotation.y = 0;
    vidas = Number.isInteger(destino.vidas) ? destino.vidas : VIDAS_INICIALES;

    lista.forEach((otro) => {
      if (otro.id === miId) {
        return;
      }
      moverJugadorRemoto({ id: otro.id, x: otro.x, y: otro.y, z: otro.z, rotY: otro.rotY });
    });

    mostrarAvisoFin(datos);
    refrescarTapas();
    actualizarHud();
  }

  // Nueva sesion del jugador local: reinicia lo que es propio de la sesion
  // (inventario, contador, aturdimiento). El estado de la partida llega aparte.
  function reiniciarSesion() {
    inventario = null;
    movimientos = 0;
    aturdidoHasta = 0;
    radarHasta = 0;
    recogidaPendiente = false;
    cimaPendiente = false;
    finPartidaHasta = 0;
    reinicioLocalHasta = 0;
    ultimaRondaPuntuada = null;
    vidas = VIDAS_INICIALES;
    bob.visible = true;
    ocultarFinPartida();
    refrescarTapas();
    actualizarHud();
  }

  function identificarJugador(datos) {
    if (!datos) {
      return;
    }

    const modoDatos = datos.modo === MODOS.arcade
      ? MODOS.arcade
      : (datos.modo === MODOS.clasico ? MODOS.clasico : modoActual);

    if (modoDatos !== modoActual) {
      cambiarModo(modoDatos);
    }

    if (modoDatos === MODOS.arcade) {
      arcadeServidorActivo = true;
    }

    miId = datos.id ?? null;
    reiniciarSesion();

    if (modoDatos !== MODOS.arcade && Number.isInteger(datos.vidas)) {
      vidas = Math.max(0, datos.vidas);
      actualizarHud();
    }

    if (datos.color) {
      aplicarColorPato(plantillaPato, datos.color);
    }

    if (Number.isInteger(datos.nivel) && Number.isInteger(datos.semilla)) {
      aplicarTablero(datos.semilla, datos.nivel);
    }

    if (!Number.isFinite(datos.x) || !Number.isFinite(datos.z)) {
      return;
    }

    const ix = Math.round(datos.x);
    const iz = Math.round(datos.z);

    if (!estaEnRango(ix, iz)) {
      return;
    }

    salto?.cancelar();
    jugador.position.set(ix, alturaEn(ix, iz, nivelActual, modoActual), iz);
    rebote = null;

    if (typeof datos.rotY === 'number') {
      rotObjetivo = datos.rotY;
      jugador.rotation.y = rotObjetivo;
    }
  }

  function agregarJugadorRemoto(remoto) {
    if (!remoto) {
      return;
    }

    const existente = remotos.get(remoto.id);
    if (existente) {
      if (remoto.color) {
        aplicarColorPato(existente.pato, remoto.color);
      }
      if (remoto.nombre) {
        existente.avatar.name = remoto.nombre;
      }
      return;
    }

    const avatar = new THREE.Group();
    avatar.name = remoto.nombre || remoto.id;

    let pato = null;
    if (plantillaPato) {
      pato = plantillaPato.clone();
      pato.position.set(0, -0.3, 0);
      pato.traverse((objeto) => {
        if (objeto.isMesh) {
          objeto.castShadow = true;
          objeto.receiveShadow = true;
        }
      });
      aplicarColorPato(pato, remoto.color || '#ffd45e');
      avatar.add(pato);
    }

    const x = Number.isFinite(remoto.x) ? remoto.x : spawnX;
    const z = Number.isFinite(remoto.z) ? remoto.z : spawnZ;
    const ix = Math.round(x);
    const iz = Math.round(z);
    const alturaBase = estaEnRango(ix, iz)
      ? alturaEn(ix, iz, nivelActual, modoActual)
      : alturaSpawn();
    const y = Math.max(alturaBase, Number.isFinite(remoto.y) ? remoto.y : alturaBase);

    avatar.position.set(x, y, z);
    scene.add(avatar);

    const entrada = {
      avatar,
      pato,
      rotObjetivo: remoto.rotY || 0,
      salto: crearSalto(avatar, pato),
      mezclador: crearMezclador(pato, pistasDe(plantillaPato))
    };

    avatar.rotation.y = entrada.rotObjetivo;

    if (y > alturaBase + 0.05) {
      entrada.salto.iniciarSalto(0, 0, { yBase: alturaBase, yDestino: alturaBase });
    }

    remotos.set(remoto.id, entrada);
  }

  function moverJugadorRemoto(remoto) {
    if (!remoto || remoto.id === miId) {
      return;
    }

    if (!remotos.has(remoto.id)) {
      agregarJugadorRemoto(remoto);
    }

    const entrada = remotos.get(remoto.id);
    if (!entrada) {
      return;
    }

    const { avatar, salto } = entrada;
    const x = Number.isFinite(remoto.x) ? remoto.x : avatar.position.x;
    const z = Number.isFinite(remoto.z) ? remoto.z : avatar.position.z;

    avatar.position.x = x;
    avatar.position.z = z;
    if (typeof remoto.rotY === 'number') {
      entrada.rotObjetivo = remoto.rotY;
    }

    const ix = Math.round(x);
    const iz = Math.round(z);
    const alturaBase = estaEnRango(ix, iz)
      ? alturaEn(ix, iz, nivelActual, modoActual)
      : avatar.position.y;

    if (!salto.estaEnSalto()) {
      const y = Math.max(alturaBase, Number.isFinite(remoto.y) ? remoto.y : alturaBase);
      avatar.position.y = y;
      if (y > alturaBase + 0.05) {
        salto.iniciarSalto(0, 0, { yBase: alturaBase, yDestino: alturaBase });
      }
    }
  }

  function quitarJugadorRemoto(id) {
    const entrada = remotos.get(id);
    if (entrada) {
      entrada.mezclador?.stopAllAction();
      scene.remove(entrada.avatar);
      remotos.delete(id);
    }
  }

  /* ---------- Modo arcade ---------- */

  function actualizarClaseModo() {
    vistaJuego.classList.toggle('modo-arcade', modoActual === MODOS.arcade);
  }

  function colocarJugadorEn(x, z, rotY = 0) {
    salto?.cancelar();
    rebote = null;
    jugador.position.set(x, alturaEn(x, z, nivelActual, modoActual), z);
    rotObjetivo = rotY;
    jugador.rotation.y = rotY;
  }

  function aplicarEmpujeConfirmado(datos) {
    if (!datos || modoActual !== MODOS.arcade) {
      return;
    }

    const x = Number(datos.x);
    const z = Number(datos.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return;
    }

    const anteriorX = jugador.position.x;
    const anteriorY = jugador.position.y;
    const anteriorZ = jugador.position.z;
    colocarJugadorEn(Math.round(x), Math.round(z), rotObjetivo);
    particulas.emitir('polvo', {
      x: anteriorX,
      y: anteriorY + 0.2,
      z: anteriorZ,
      count: 7
    });

    if (typeof datos.objetivoId === 'string') {
      const objetivoX = Number(datos.objetivoX);
      const objetivoZ = Number(datos.objetivoZ);
      if (Number.isFinite(objetivoX) && Number.isFinite(objetivoZ)) {
        moverJugadorRemoto({
          id: datos.objetivoId,
          x: objetivoX,
          z: objetivoZ
        });
        emitirImpacto(
          objetivoX,
          alturaEn(Math.round(objetivoX), Math.round(objetivoZ), nivelActual, modoActual),
          objetivoZ
        );
      }
    }

    actualizarHud();
  }

  function aplicarEmpujado(datos) {
    if (!datos || modoActual !== MODOS.arcade) {
      return;
    }

    const x = Number(datos.x);
    const z = Number(datos.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return;
    }

    const anteriorX = jugador.position.x;
    const anteriorY = jugador.position.y;
    const anteriorZ = jugador.position.z;
    colocarJugadorEn(Math.round(x), Math.round(z), rotObjetivo);
    particulas.emitir('polvo', {
      x: anteriorX,
      y: anteriorY + 0.2,
      z: anteriorZ,
      count: 7
    });
    emitirImpacto(jugador.position.x, jugador.position.y, jugador.position.z);
    actualizarHud();
  }

  function aplicarTeletransporteArcade(datos) {
    if (!datos || modoActual !== MODOS.arcade) {
      return;
    }

    const x = Number(datos.x);
    const z = Number(datos.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return;
    }

    const rotY = Number.isFinite(datos.rotY) ? datos.rotY : rotObjetivo;
    const anteriorX = jugador.position.x;
    const anteriorY = jugador.position.y;
    const anteriorZ = jugador.position.z;
    colocarJugadorEn(Math.round(x), Math.round(z), rotY);
    emitirTeletransporte(
      anteriorX,
      anteriorY,
      anteriorZ,
      jugador.position.x,
      jugador.position.y,
      jugador.position.z
    );
    arcadeCimaPisada = false;
    actualizarHud();
  }

  function reiniciarArcadeLocal() {
    particulas.limpiar();
    const spawn = spawnsDe(MODOS.arcade)[0];
    spawnX = spawn.x;
    spawnZ = spawn.z;
    arcadeRonda += 1;
    arcadeEstado = 'cuenta';
    arcadeCuentaRestante = CUENTA_ARCADE;
    arcadeRestante = DURACION_ARCADE;
    arcadeTiempoCima = 0;
    arcadeRanking = [];
    arcadeJugadores = [{
      id: miId || 'local',
      nombre: 'Vos',
      tiempoCima: 0,
      enCima: false
    }];
    arcadeFinHasta = 0;
    arcadeHudAcumulado = 0;
    arcadeCimaPisada = false;
    arcadeAuraAcumulada = 0;
    arcadeSobreCima = false;
    colocarJugadorEn(spawnX, spawnZ, 0);
    ocultarFinPartida();
    actualizarHud();
  }

  function iniciarArcadeLocal() {
    arcadeServidorActivo = false;
    reiniciarArcadeLocal();
  }

  function finalizarArcadeLocal() {
    arcadeEstado = 'fin';
    arcadeRestante = 0;
    arcadeFinHasta = tiempoJuego + REINICIO_ARCADE;
    arcadeRanking = [{
      id: miId || 'local',
      nombre: 'Vos',
      tiempoCima: arcadeTiempoCima
    }];
    notificarPuntajeArcade();
    emitirConfetiCima();
    mostrarFinPartida(`Tiempo agotado · ${arcadeTiempoCima.toFixed(1)} s en la cima`);
    actualizarHud();
  }

  function actualizarArcadeLocal(delta) {
    if (modoActual !== MODOS.arcade || arcadeServidorActivo) {
      return;
    }

    const enCima = esCimaArcade(
      Math.round(jugador.position.x),
      Math.round(jugador.position.z)
    );

    if (arcadeEstado === 'cuenta') {
      arcadeCuentaRestante = Math.max(0, arcadeCuentaRestante - delta);
      if (arcadeCuentaRestante <= 0) {
        arcadeEstado = 'jugando';
        arcadeCuentaRestante = 0;
        arcadeRestante = DURACION_ARCADE;
        actualizarHud();
      }
    } else if (arcadeEstado === 'jugando') {
      const enPiso = !salto?.estaEnSalto() && !rebote;

      if (enCima) {
        arcadeTiempoCima += delta;
        if (enPiso) {
          arcadeCimaPisada = true;
        }
      } else if (arcadeCimaPisada && enPiso) {
        const anteriorX = jugador.position.x;
        const anteriorY = jugador.position.y;
        const anteriorZ = jugador.position.z;
        const spawn = spawnsDe(MODOS.arcade)[0];
        colocarJugadorEn(spawn.x, spawn.z, 0);
        emitirTeletransporte(
          anteriorX,
          anteriorY,
          anteriorZ,
          jugador.position.x,
          jugador.position.y,
          jugador.position.z
        );
        arcadeCimaPisada = false;
      }

      arcadeRestante = Math.max(0, arcadeRestante - delta);
      if (arcadeRestante <= 0) {
        finalizarArcadeLocal();
        return;
      }
    } else if (arcadeEstado === 'fin' && tiempoJuego >= arcadeFinHasta) {
      reiniciarArcadeLocal();
      return;
    }

    arcadeJugadores = [{
      id: miId || 'local',
      nombre: 'Vos',
      tiempoCima: arcadeTiempoCima,
      enCima
    }];

    arcadeHudAcumulado += delta;
    if (arcadeHudAcumulado >= 0.1) {
      arcadeHudAcumulado = 0;
      actualizarHud();
    }
  }

  function actualizarParticulasArcade(delta) {
    if (modoActual !== MODOS.arcade) {
      arcadeSobreCima = false;
      arcadeAuraAcumulada = 0;
      return;
    }

    const enCima = esCimaArcade(
      Math.round(jugador.position.x),
      Math.round(jugador.position.z)
    );
    const enPiso = !salto?.estaEnSalto() && !rebote;
    const sobreCima = enCima && enPiso;

    if (sobreCima && !arcadeSobreCima && arcadeEstado === 'jugando') {
      emitirConfetiCima();
    }
    arcadeSobreCima = sobreCima;

    if (arcadeEstado !== 'jugando') {
      arcadeAuraAcumulada = 0;
      return;
    }

    arcadeAuraAcumulada += delta;
    const intervalo = 0.16 / Math.max(0.35, configParticulas.escala || 1);
    if (arcadeAuraAcumulada < intervalo) {
      return;
    }
    arcadeAuraAcumulada = 0;

    if (sobreCima) {
      emitirAuraCima(jugador.position.x, jugador.position.z);
    }

    remotos.forEach((entrada) => {
      const ix = Math.round(entrada.avatar.position.x);
      const iz = Math.round(entrada.avatar.position.z);
      if (esCimaArcade(ix, iz)) {
        emitirAuraCima(entrada.avatar.position.x, entrada.avatar.position.z, 0.4);
      }
    });
  }

  function aplicarEstadoArcade(estado) {
    if (!estado || modoActual !== MODOS.arcade) {
      return;
    }

    arcadeServidorActivo = true;
    const rondaAnterior = arcadeRonda;
    const estadosValidos = ['espera', 'cuenta', 'jugando', 'fin'];

    arcadeRonda = Number.isInteger(estado.ronda) ? estado.ronda : arcadeRonda;
    arcadeEstado = estadosValidos.includes(estado.estado) ? estado.estado : 'espera';
    arcadeRestante = Number.isFinite(estado.restante)
      ? Math.max(0, estado.restante)
      : arcadeRestante;
    arcadeCuentaRestante = Number.isFinite(estado.cuentaRestante)
      ? Math.max(0, estado.cuentaRestante)
      : 0;

    const jugadores = Array.isArray(estado.jugadores) ? estado.jugadores : [];
    arcadeJugadores = jugadores;
    arcadeRanking = Array.isArray(estado.ranking) ? estado.ranking : [];

    const propio = jugadores.find((jugadorRemoto) => jugadorRemoto.id === miId);
    if (propio && Number.isFinite(propio.tiempoCima)) {
      arcadeTiempoCima = propio.tiempoCima;
    }

    if (arcadeEstado === 'cuenta' && propio
      && Number.isFinite(propio.x) && Number.isFinite(propio.z)) {
      colocarJugadorEn(Math.round(propio.x), Math.round(propio.z), propio.rotY || 0);
    }

    const idsPresentes = new Set();
    jugadores.forEach((jugadorRemoto) => {
      if (jugadorRemoto.id === miId) {
        return;
      }
      idsPresentes.add(jugadorRemoto.id);
      moverJugadorRemoto(jugadorRemoto);
    });

    [...remotos.keys()].forEach((id) => {
      if (!idsPresentes.has(id)) {
        quitarJugadorRemoto(id);
      }
    });

    if (rondaAnterior !== arcadeRonda || arcadeEstado === 'cuenta') {
      ocultarFinPartida();
    }

    actualizarHud();
  }

  function aplicarFinArcade(datos) {
    if (!datos || modoActual !== MODOS.arcade) {
      return;
    }

    arcadeServidorActivo = true;
    arcadeEstado = 'fin';
    arcadeRestante = 0;

    if (Number.isInteger(datos.ronda)) {
      arcadeRonda = datos.ronda;
    }

    arcadeRanking = Array.isArray(datos.ranking) ? datos.ranking : [];

    const propia = arcadeRanking.find((entrada) => entrada.id === miId);
    if (propia && Number.isFinite(propia.tiempoCima)) {
      arcadeTiempoCima = propia.tiempoCima;
      notificarPuntajeArcade();
    }

    emitirConfetiCima();

    let texto = 'Tiempo agotado';
    if (datos.empate) {
      const tiempos = arcadeRanking
        .filter((entrada) => entrada.tiempoCima === arcadeRanking[0]?.tiempoCima)
        .map((entrada) => entrada.nombre)
        .join(', ');
      texto = `Empate · ${tiempos}`;
    } else if (datos.ganador) {
      const tiempo = Number(datos.ganador.tiempoCima) || 0;
      texto = datos.ganador.id === miId
        ? `¡Ganaste! ${tiempo.toFixed(1)} s en la cima`
        : `Ganó ${datos.ganador.nombre} · ${tiempo.toFixed(1)} s`;
    }

    mostrarFinPartida(texto);
    actualizarHud();
  }

  function cambiarModo(modo, { reiniciar = false } = {}) {
    const destino = modo === MODOS.arcade ? MODOS.arcade : MODOS.clasico;
    if (destino === modoActual) {
      actualizarClaseModo();
      if (reiniciar && modoActual === MODOS.arcade) {
        iniciarArcadeLocal();
      }
      return;
    }

    modoActual = destino;
    radioActual = radioDe(modoActual);
    actualizarClaseModo();
    ultimaRondaPuntuada = null;

    nivelActual = 1;
    semilla = nuevaSemilla();
    minas = celdasMina(DIFICULTADES[dificultadActual], semilla, nivelActual, modoActual);
    destruirPiramide(scene, cubosPiramide);
    cubosPiramide = crearPiramide(scene, minas, nivelActual, modoActual);
    powerupsTablero = modoActual === MODOS.arcade
      ? new Map()
      : powerupsDelTablero(semilla, nivelActual, modoActual);
    construirPowerups();
    refrescarTapas();

    inventario = null;
    movimientos = 0;
    vidas = VIDAS_INICIALES;
    aturdidoHasta = 0;
    radarHasta = 0;
    recogidaPendiente = false;
    cimaPendiente = false;
    finPartidaHasta = 0;
    reinicioLocalHasta = 0;
    rebote = null;
    salto?.cancelar();
    particulas.limpiar();
    arcadeSobreCima = false;
    arcadeAuraAcumulada = 0;
    tomados.clear();
    bob.visible = true;
    jugadoresActivos = 1;
    jugadoresConectados = 1;
    ocultarFinPartida();

    [...remotos.keys()].forEach((id) => quitarJugadorRemoto(id));

    const spawn = spawnsDe(modoActual)[0];
    spawnX = spawn.x;
    spawnZ = spawn.z;
    colocarJugadorEn(spawnX, spawnZ, 0);

    const arcade = modoActual === MODOS.arcade;
    luzFocal.distance = arcade ? 60 : 35;
    luzFocal.shadow.camera.far = arcade ? 80 : 40;
    luzFocal.shadow.camera.updateProjectionMatrix();
    aplicarCamara();

    if (arcade) {
      iniciarArcadeLocal();
    } else {
      arcadeServidorActivo = false;
      arcadeEstado = 'espera';
      arcadeRestante = DURACION_ARCADE;
      arcadeCuentaRestante = CUENTA_ARCADE;
      arcadeTiempoCima = 0;
      arcadeRanking = [];
      arcadeJugadores = [];
      arcadeFinHasta = 0;
      actualizarHud();
    }
  }

  actualizarClaseModo();

  renderer.setAnimationLoop(animate);

  return {
    scene,
    jugador,
    identificarJugador,
    agregarJugadorRemoto,
    moverJugadorRemoto,
    quitarJugadorRemoto,
    aplicarDificultad,
    aplicarEstadoPartida,
    aplicarJugadoresActivos,
    registrarPowerupTomado,
    aplicarVidas,
    aplicarNuevaRonda,
    cambiarModo,
    aplicarEstadoArcade,
    aplicarFinArcade,
    aplicarEmpujeConfirmado,
    aplicarEmpujado,
    aplicarTeletransporteArcade
  };
}
