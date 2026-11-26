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
  crearEstructura,
  DIFICULTADES,
  DIFICULTAD_POR_DEFECTO,
  TOTAL_NIVELES,
  RADIO,
  MODOS,
  radioDe,
  spawnsDe,
  esCimaArcade
} from './piramide.js';
import { setSeed } from '../util/rng.js';
import { crearSalto, crearMezclador, crearRebote, crearGiro, crearBarrido } from './animaciones.js';
import { crearParticulas } from './particulas.js';
import {
  pintarHud,
  pintarHudArcade,
  pintarCronometroClasico,
  mostrarFinPartida,
  ocultarFinPartida
} from './hud.js';
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

async function iniciarEscenaClasica({
  alMoverJugador,
  alCuadro = () => {},
  estaActivo = () => true,
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
  let tiempoClasico = 0;
  let segundoClasicoPintado = -1;
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

  function reiniciarCronometroClasico() {
    tiempoClasico = 0;
    segundoClasicoPintado = -1;
    pintarCronometroClasico(0);
  }

  function actualizarCronometroClasico(delta) {
    if (modoActual !== MODOS.clasico) {
      return;
    }

    tiempoClasico += delta;
    const segundo = Math.floor(tiempoClasico);
    if (segundo !== segundoClasicoPintado) {
      segundoClasicoPintado = segundo;
      pintarCronometroClasico(segundo);
    }
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
    if (!vistaJuego.classList.contains('activa') || !estaActivo()) return;

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
    if (!estaActivo()) {
      alCuadro();
      return;
    }
    mixers.forEach((m) => m.update(delta));

    if (vistaJuego.classList.contains('activa')) {
      // El tiempo de juego solo avanza con la vista activa: la pausa congela
      // el aturdimiento y el radar. El cronómetro clásico va a la par.
      tiempoJuego += delta;
      actualizarCronometroClasico(delta);

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
    alCuadro();
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
      } else if (reiniciar && modoActual === MODOS.clasico) {
        reiniciarCronometroClasico();
        actualizarHud();
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
      reiniciarCronometroClasico();
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
    renderer,
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

function iniciarEscenaBatalla({ alMoverJugador, alGanar, alPerder, renderer, estaActivo: motorBatallaActivo = () => true, alActivar = () => {} } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  const vistaJuego = document.getElementById('vista-juego');

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
  const divStats = document.getElementById('perf-stats') || document.createElement('div');
  divStats.id = 'perf-stats';
  divStats.style.cssText = [
    'position:fixed', 'bottom:8px', 'right:8px',
    'background:rgba(0,0,0,0.55)', 'color:#0f0', 'font:11px/1.5 monospace',
    'padding:5px 8px', 'border-radius:4px', 'pointer-events:none',
    'z-index:9999', 'display:none',
  ].join(';');
  if (!divStats.parentNode) document.body.appendChild(divStats);

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

  const divPowerups = document.getElementById('hud-powerups') || document.createElement('div');
  divPowerups.id = 'hud-powerups';
  if (!divPowerups.parentNode) document.body.appendChild(divPowerups);

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
    if (!vistaJuego.classList.contains('activa') || !motorBatallaActivo()) return;
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

  /* ---------- Loop de animación ---------- */
  function animate() {
    if (!motorBatallaActivo()) return;
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
    cronometroActivo = true;

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
    alActivar();
  }

  function pausarCronometro()   { cronometroActivo = false; detenerMusica(); }
  function reanudarCronometro() {
    if (cronometroT > 0 && !muerto) { cronometroActivo = true; iniciarMusica(); }
  }

  return {
    scene,
    jugador,
    animate,
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

export async function iniciarEscena(opciones = {}) {
  let motorActivo = 'clasico';
  let cuadroBatalla = () => {};

  const clasica = await iniciarEscenaClasica({
    ...opciones,
    estaActivo: () => motorActivo === 'clasico',
    alCuadro: () => cuadroBatalla()
  });

  const batalla = iniciarEscenaBatalla({
    alMoverJugador: opciones.alMoverJugador,
    alGanar: opciones.alGanar,
    alPerder: opciones.alPerder,
    renderer: clasica.renderer,
    estaActivo: () => motorActivo === 'batalla',
    alActivar: () => { motorActivo = 'batalla'; }
  });

  cuadroBatalla = batalla.animate;

  const enClasico = () => motorActivo === 'clasico';
  const soloClasico = (nombre) => (...argumentos) => {
    if (enClasico()) {
      return clasica[nombre](...argumentos);
    }
  };

  return {
    scene: clasica.scene,
    jugador: clasica.jugador,
    renderer: clasica.renderer,
    identificarJugador: soloClasico('identificarJugador'),
    agregarJugadorRemoto: (jugador) => enClasico()
      ? clasica.agregarJugadorRemoto(jugador)
      : batalla.agregarJugadorRemoto(jugador),
    moverJugadorRemoto: (jugador) => enClasico()
      ? clasica.moverJugadorRemoto(jugador)
      : batalla.moverJugadorRemoto(jugador),
    quitarJugadorRemoto: (id) => {
      if (enClasico()) {
        clasica.quitarJugadorRemoto(id);
      } else {
        batalla.quitarJugadorRemoto(id);
      }
    },
    aplicarDificultad: soloClasico('aplicarDificultad'),
    aplicarEstadoPartida: soloClasico('aplicarEstadoPartida'),
    aplicarJugadoresActivos: soloClasico('aplicarJugadoresActivos'),
    registrarPowerupTomado: soloClasico('registrarPowerupTomado'),
    aplicarVidas: soloClasico('aplicarVidas'),
    aplicarNuevaRonda: soloClasico('aplicarNuevaRonda'),
    cambiarModo: (modo, ajustes) => {
      motorActivo = 'clasico';
      return clasica.cambiarModo(modo, ajustes);
    },
    aplicarEstadoArcade: soloClasico('aplicarEstadoArcade'),
    aplicarFinArcade: soloClasico('aplicarFinArcade'),
    aplicarEmpujeConfirmado: soloClasico('aplicarEmpujeConfirmado'),
    aplicarEmpujado: soloClasico('aplicarEmpujado'),
    aplicarTeletransporteArcade: soloClasico('aplicarTeletransporteArcade'),
    reiniciar: (...argumentos) => batalla.reiniciar(...argumentos),
    pausarCronometro: () => batalla.pausarCronometro(),
    reanudarCronometro: () => batalla.reanudarCronometro(),
    setNombreJugador: (...argumentos) => batalla.setNombreJugador(...argumentos),
    mostrarVictoriaBatalla: (...argumentos) => batalla.mostrarVictoriaBatalla(...argumentos)
  };
}
