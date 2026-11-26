import * as THREE from 'three';
import { rand } from '../util/rng.js';

const _cache = {};

/**
 * Genera una CanvasTexture con el color de fondo dado y un borde negro
 * dibujado sobre el canvas — la misma técnica del ejemplo de Three.js
 * con baldosas (color plano + línea de cuadrícula).
 */
function texturaCara(color) {
  if (_cache[color]) return _cache[color];

  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 64, 64);

  ctx.strokeStyle = '#1f2430';
  ctx.lineWidth = 5;
  ctx.strokeRect(2.5, 2.5, 59, 59);

  const tex = new THREE.CanvasTexture(cv);
  _cache[color] = tex;
  return tex;
}

/*
 * Cada nivel de juego tiene su propia paleta para que el cambio de mapa se
 * note a simple vista. La tapa de mina siempre es roja.
 */
export const PALETAS_NIVEL = {
  1: {
    seguro: { top: '#8fe0b8', lit: '#e8a878', shadow: '#c9885a' },
    mina: { top: '#ff6b57', lit: '#e8a878', shadow: '#c9885a' }
  },
  2: {
    seguro: { top: '#8fd8ff', lit: '#8bb8d6', shadow: '#5a829e' },
    mina: { top: '#ff6b57', lit: '#8bb8d6', shadow: '#5a829e' }
  },
  3: {
    seguro: { top: '#ffd166', lit: '#d9a066', shadow: '#9c6f3f' },
    mina: { top: '#ff6b57', lit: '#d9a066', shadow: '#9c6f3f' }
  }
};

export const TOTAL_NIVELES = 3;
export const RADIO = 4;
export const RADIO_ARCADE = 7;

export const MODOS = Object.freeze({
  clasico: 'clasico',
  arcade: 'arcade'
});

export const PALETA_ARCADE = {
  seguro: { top: '#7ee8fa', lit: '#79b8cc', shadow: '#4a7a8c' },
  mina: { top: '#ff6b57', lit: '#79b8cc', shadow: '#4a7a8c' }
};

export const DIFICULTADES = {
  facil: 0.17,
  normal: 0.26,
  dificil: 0.33
};
export const DIFICULTAD_POR_DEFECTO = 'normal';

export const SPAWNS = [
  { x: 0, z: RADIO },
  { x: RADIO, z: 0 },
  { x: 0, z: -RADIO },
  { x: -RADIO, z: 0 },
  { x: 2, z: RADIO },
  { x: -2, z: RADIO },
  { x: RADIO, z: 2 },
  { x: RADIO, z: -2 },
];

export const SPAWNS_ARCADE = [
  { x: 0, z: RADIO_ARCADE },
  { x: RADIO_ARCADE, z: 0 },
  { x: 0, z: -RADIO_ARCADE },
  { x: -RADIO_ARCADE, z: 0 },
  { x: 3, z: RADIO_ARCADE },
  { x: -3, z: RADIO_ARCADE },
  { x: RADIO_ARCADE, z: 3 },
  { x: RADIO_ARCADE, z: -3 },
];

export const RADIO_POR_MODO = {
  [MODOS.clasico]: RADIO,
  [MODOS.arcade]: RADIO_ARCADE
};

export const SPAWNS_POR_MODO = {
  [MODOS.clasico]: SPAWNS,
  [MODOS.arcade]: SPAWNS_ARCADE
};

export function radioDe(modo = MODOS.clasico) {
  return modo === MODOS.arcade ? RADIO_ARCADE : RADIO;
}

export function spawnsDe(modo = MODOS.clasico) {
  return modo === MODOS.arcade ? SPAWNS_ARCADE : SPAWNS;
}

export function esCimaArcade(ix, iz) {
  return Math.abs(ix) <= 1 && Math.abs(iz) <= 1;
}

const HASH_POWERUP_ORDEN = 301;
const HASH_POWERUP_ROTACION = 401;

/**
 * Semilla nueva por partida/ronda. El servidor la genera y la comparte para
 * que cliente y servidor calculen exactamente el mismo tablero.
 */
export function nuevaSemilla() {
  return Math.floor(Math.random() * 0x7fffffff);
}

/**
 * Raiz cuadrada entera. Se usa en el mapa circular para que navegador y
 * servidor obtengan exactamente el mismo anillo, sin depender de Math.hypot.
 */
function isqrt(valor) {
  let raiz = 0;
  while ((raiz + 1) * (raiz + 1) <= valor) {
    raiz += 1;
  }
  return raiz;
}

/**
 * Hash determinista por celda y semilla. Devuelve un valor en [0, 1).
 * La misma formula existe en servidor.js: si cambia, cambiar las dos.
 */
function hash01(ix, iz, capa, semilla) {
  let h = Math.imul(ix | 0, 374761393);
  h = (h + Math.imul(iz | 0, 668265263)) | 0;
  h = (h + Math.imul(capa | 0, 2147483647)) | 0;
  h = (h + Math.imul(semilla | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/**
 * Altura de la columna (ix, iz) en el nivel de juego indicado.
 *
 * Nivel 1: piramide clasica por distancia de Chebyshev (1..5).
 * Nivel 2: monticulo circular por distancia euclidea entera (1..6).
 * Nivel 3: meseta en forma de estrella con pico central unico (2..6).
 *
 * Las tres formas cumplen que dos celdas ortogonales vecinas nunca difieren
 * en mas de una capa, asi el movimiento actual sigue siendo valido.
 */
export function alturaEn(ix, iz, nivelJuego = 1, modo = MODOS.clasico) {
  const x = Math.abs(ix);
  const z = Math.abs(iz);

  if (modo === MODOS.arcade) {
    return Math.min(7, 8 - Math.max(x, z));
  }

  if (nivelJuego === 2) {
    return Math.max(1, 6 - isqrt(ix * ix + iz * iz));
  }

  if (nivelJuego === 3) {
    return Math.max(1, 6 - (x + z), 5 - Math.abs(x - z));
  }

  return RADIO + 1 - Math.max(x, z);
}

/**
 * Las celdas de spawn y la cima quedan siempre a salvo. Las demas se reparten
 * con el hash de la ronda: con una probabilidad mayor, el conjunto de minas
 * contiene al de una menor para la misma semilla y nivel.
 */
function esCeldaMina(ix, iz, nivelJuego, probabilidad, semilla, modo = MODOS.clasico) {
  if (modo === MODOS.arcade) {
    return false;
  }

  if ((ix === 0 && iz === 0) || spawnsDe(modo).some((spawn) => spawn.x === ix && spawn.z === iz)) {
    return false;
  }

  const capa = alturaEn(ix, iz, nivelJuego, modo) - 1;
  return hash01(ix, iz, capa, semilla) < probabilidad;
}

/**
 * Devuelve el conjunto de celdas "ix,iz" cuya tapa es mina con la
 * probabilidad, semilla, nivel de juego y modo dados.
 */
export function celdasMina(probabilidad, semilla, nivelJuego = 1, modo = MODOS.clasico) {
  const minas = new Set();
  const radio = radioDe(modo);

  if (modo === MODOS.arcade) {
    return minas;
  }

  for (let ix = -radio; ix <= radio; ix++) {
    for (let iz = -radio; iz <= radio; iz++) {
      if (esCeldaMina(ix, iz, nivelJuego, probabilidad, semilla, modo)) {
        minas.add(`${ix},${iz}`);
      }
    }
  }

  return minas;
}

/*
 * Powerups: seleccion determinista a partir de la semilla de la ronda, para
 * que cliente y servidor coincidan sin enviar listas. Se excluyen la cima, los
 * spawns y las celdas que son mina en la dificultad mas alta: como las minas de
 * facil y normal son un subconjunto de las de dificil, un powerup nunca queda
 * sobre una mina de ninguna dificultad. La copia de estas funciones en
 * servidor.js debe mantenerse igual.
 */
export const TIPOS_POWERUP = ['resorte', 'escudo', 'radar'];
const OBJETIVO_POWERUPS = 12;
const DISTANCIA_MINIMA_POWERUP = 2;

function celdasElegiblesPowerup(semilla, nivelJuego, modo = MODOS.clasico) {
  const celdas = [];
  const radio = radioDe(modo);

  if (modo === MODOS.arcade) {
    return celdas;
  }

  for (let ix = -radio; ix <= radio; ix++) {
    for (let iz = -radio; iz <= radio; iz++) {
      if (ix === 0 && iz === 0) {
        continue;
      }

      if (spawnsDe(modo).some((spawn) => spawn.x === ix && spawn.z === iz)) {
        continue;
      }

      if (esCeldaMina(ix, iz, nivelJuego, DIFICULTADES.dificil, semilla, modo)) {
        continue;
      }

      celdas.push({ ix, iz, orden: hash01(ix, iz, HASH_POWERUP_ORDEN, semilla) });
    }
  }

  celdas.sort((a, b) => a.orden - b.orden || a.ix - b.ix || a.iz - b.iz);
  return celdas;
}

/**
 * Mapa "ix,iz" -> tipo de los powerups del tablero. Se eligen 12 celdas en
 * orden pseudoaleatorio determinista y se exige una separacion de Chebyshev de
 * 2 celdas para que queden repartidos; si el tablero no permite llegar al
 * objetivo con esa separacion, se completa con las celdas restantes. Los tipos
 * se asignan en ciclo desde una rotacion derivada de la semilla: siempre
 * aparecen los tres y quedan equilibrados (4 de cada uno).
 */
export function powerupsDelTablero(semilla, nivelJuego = 1, modo = MODOS.clasico) {
  const elegibles = celdasElegiblesPowerup(semilla, nivelJuego, modo);
  const objetivo = Math.min(OBJETIVO_POWERUPS, elegibles.length);
  const elegidas = [];

  for (const celda of elegibles) {
    if (elegidas.length >= objetivo) {
      break;
    }

    const separada = elegidas.every((otra) =>
      Math.max(Math.abs(celda.ix - otra.ix), Math.abs(celda.iz - otra.iz)) >= DISTANCIA_MINIMA_POWERUP
    );

    if (separada) {
      elegidas.push(celda);
    }
  }

  if (elegidas.length < objetivo) {
    for (const celda of elegibles) {
      if (elegidas.length >= objetivo) {
        break;
      }

      if (!elegidas.some((otra) => otra.ix === celda.ix && otra.iz === celda.iz)) {
        elegidas.push(celda);
      }
    }
  }

  const rotacion = Math.floor(hash01(0, 0, HASH_POWERUP_ROTACION, semilla) * TIPOS_POWERUP.length);
  const mapa = new Map();

  elegidas.forEach((celda, indice) => {
    const tipo = TIPOS_POWERUP[(indice + rotacion) % TIPOS_POWERUP.length];
    mapa.set(`${celda.ix},${celda.iz}`, tipo);
  });

  return mapa;
}

/**
 * Devuelve el tipo de powerup de la celda (ix, iz), o null si no tiene.
 * Consulta el mismo tablero que powerupsDelTablero.
 */
export function powerupEn(ix, iz, semilla, nivelJuego = 1, modo = MODOS.clasico) {
  return powerupsDelTablero(semilla, nivelJuego, modo).get(`${ix},${iz}`) || null;
}

/**
 * Cambia el color de la tapa (cara superior, indice 2) de un cubo ya creado.
 * No reconstruye la geometria. La paleta depende del nivel de juego.
 */
export function aplicarTipoTapa(mesh, tipo, nivelJuego = 1, modo = MODOS.clasico) {
  const paleta = modo === MODOS.arcade
    ? PALETA_ARCADE
    : (PALETAS_NIVEL[nivelJuego] || PALETAS_NIVEL[1]);
  const c = paleta[tipo] || paleta.seguro;
  const tapa = mesh.material[2];
  tapa.map = texturaCara(c.top);
  tapa.needsUpdate = true;
}

/**
 * Crea un cubo estilizado con:
 *  - Tres tonos distintos (tapa / lado iluminado / lado en sombra)
 *  - Contorno negro usando el truco BackSide (sin post-procesado)
 *
 * Orden de materiales en BoxGeometry de Three.js:
 *   0 = +x   1 = -x   2 = +y (tapa)   3 = -y (fondo)   4 = +z   5 = -z
 *
 * Con cámara en (8, 10, 8) mirando al centro, el eje +x y el eje -z
 * son los lados visibles desde "el sol de lado" (guía pág. 9).
 */
function crearCubo(x, y, z, tipo = 'seguro', nivelJuego = 1, modo = MODOS.clasico) {
  const paleta = modo === MODOS.arcade
    ? PALETA_ARCADE
    : (PALETAS_NIVEL[nivelJuego] || PALETAS_NIVEL[1]);
  const c = paleta[tipo] || paleta.seguro;

  const mats = [
    new THREE.MeshLambertMaterial({ map: texturaCara(c.lit) }),
    new THREE.MeshLambertMaterial({ map: texturaCara(c.shadow) }),
    new THREE.MeshLambertMaterial({ map: texturaCara(c.top) }),
    new THREE.MeshLambertMaterial({ map: texturaCara(c.shadow) }),
    new THREE.MeshLambertMaterial({ map: texturaCara(c.shadow) }),
    new THREE.MeshLambertMaterial({ map: texturaCara(c.lit) }),
  ];

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const contorno = new THREE.Mesh(
    new THREE.BoxGeometry(1.06, 1.06, 1.06),
    new THREE.MeshBasicMaterial({ color: 0x1f2430, side: THREE.BackSide })
  );
  contorno.castShadow = false;
  contorno.receiveShadow = false;
  mesh.add(contorno);

  return mesh;
}

/**
 * Marca como mina la tapa de cada columna cuyo "ix,iz" esta en el conjunto.
 * Se usa al crear el tablero y al reconstruirlo en cada ronda.
 */
export function marcarMinas(cubos, minas = new Set(), nivelJuego = 1, modo = MODOS.clasico) {
  cubos.forEach((cubo) => {
    const ix = Math.round(cubo.mesh.position.x);
    const iz = Math.round(cubo.mesh.position.z);
    if (cubo.nivel !== alturaEn(ix, iz, nivelJuego, modo) - 1) {
      return;
    }

    cubo.tipo = modo !== MODOS.arcade && minas.has(`${ix},${iz}`) ? 'mina' : 'seguro';
  });
}

/**
 * Construye el tablero del nivel indicado con columnas de cubos apilados.
 * Las tapas nacen neutras: la mina solo se muestra con el radar (ver
 * refrescarTapas en escena.js). El tipo real queda en cubos[].tipo y se
 * actualiza con marcarMinas.
 */
export function crearPiramide(escena, minas = new Set(), nivelJuego = 1, modo = MODOS.clasico) {
  const cubos = [];
  const radio = radioDe(modo);

  for (let ix = -radio; ix <= radio; ix++) {
    for (let iz = -radio; iz <= radio; iz++) {
      const altura = alturaEn(ix, iz, nivelJuego, modo);

      for (let h = 0; h < altura; h++) {
        const cubo = crearCubo(ix, h, iz, 'seguro', nivelJuego, modo);
        escena.add(cubo);
        cubos.push({ mesh: cubo, nivel: h, tipo: 'seguro' });
      }
    }
  }

  marcarMinas(cubos, minas, nivelJuego, modo);
  return cubos;
}

/**
 * Quita un tablero de la escena y libera geometrias y materiales. Las texturas
 * se comparten en la cache de texturaCara, por eso no se destruyen.
 */
export function destruirPiramide(escena, cubos) {
  cubos.forEach(({ mesh }) => {
    escena.remove(mesh);
    mesh.traverse((hijo) => {
      if (hijo.geometry) {
        hijo.geometry.dispose();
      }

      if (!hijo.material) {
        return;
      }

      const materiales = Array.isArray(hijo.material) ? hijo.material : [hijo.material];
      materiales.forEach((material) => material.dispose());
    });
  });
}

/* ---- Vertex-colored geometry builders ---- */
// Face order in BoxGeometry: +X, -X, +Y, -Y, +Z, -Z  (4 verts each = 24 total)
// Matches original material array: [lit, shadow, top, shadow, shadow, lit]
function _crearGeoVC(topHex, litHex, shadowHex) {
  const geo = new THREE.BoxGeometry(2, 2, 2);
  const n   = geo.attributes.position.count; // 24
  const buf = new Float32Array(n * 3);
  const cols = [
    new THREE.Color(litHex),    // face 0: +X lit
    new THREE.Color(shadowHex), // face 1: -X shadow
    new THREE.Color(topHex),    // face 2: +Y top  ← changes for mines
    new THREE.Color(shadowHex), // face 3: -Y shadow
    new THREE.Color(shadowHex), // face 4: +Z shadow
    new THREE.Color(litHex),    // face 5: -Z lit
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = (f * 4 + v) * 3;
      buf[i] = cols[f].r; buf[i + 1] = cols[f].g; buf[i + 2] = cols[f].b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(buf, 3));
  return geo;
}

// Border texture: white fill + dark inset stroke — multiplies with vertex colors
// Result: face center = vertex_color × white = vertex_color; border ≈ very dark
const _TEX_BORDE = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#1f2430';
  ctx.lineWidth = 5;
  ctx.strokeRect(2.5, 2.5, 59, 59);
  return new THREE.CanvasTexture(cv);
})();

// Shared geometry — module-level, reused across reiniciar()
const _GEO_SEGURO   = _crearGeoVC('#8fe0b8', '#e8a878', '#c9885a');
const _GEO_MINA     = _crearGeoVC('#ff6b57', '#e8a878', '#c9885a');
const _GEO_BLOQUEADO = _crearGeoVC('#a97142', '#8b5a2b', '#6b4423');
const _GEO_OUTLINE  = new THREE.BoxGeometry(2.12, 2.12, 2.12);
const _MAT_VC      = new THREE.MeshBasicMaterial({ vertexColors: true, map: _TEX_BORDE });
const _MAT_OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1f2430, side: THREE.BackSide });

const _HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const _M4     = new THREE.Matrix4();

// Top de mina: rojo fijo (sin parpadeo)
const _C_MINA_A = new THREE.Color('#ff6b57');

const AVISO_NARANJA = 1.1;
const AVISO_ROJO    = 1.0;

const PROB_CUBO_CAE = { facil: 0.10, normal: 0.18, dificil: 0.28 };
const RETARDO_CUBO_CAE = 0.9;

const _GEO_AVISO = new THREE.PlaneGeometry(1.8, 1.8);
_GEO_AVISO.rotateX(-Math.PI / 2);
const _MAT_AVISO_NARANJA = new THREE.MeshBasicMaterial({ color: 0xff9d3d, side: THREE.DoubleSide, depthWrite: false });
const _MAT_AVISO_ROJO    = new THREE.MeshBasicMaterial({ color: 0xff3b30, side: THREE.DoubleSide, depthWrite: false });

function _setMineTopColor(c) {
  const attr = _GEO_MINA.attributes.color;
  for (let v = 8; v < 12; v++) attr.setXYZ(v, c.r, c.g, c.b);
  attr.needsUpdate = true;
}

/* -------- Funciones de altura -------- */

function alturaPiramideBase(ix, iz) {
  const d = Math.max(Math.abs(ix), Math.abs(iz));
  return Math.max(0, 11 - d);
}

const PASOS_TORRE = [
  [3, 0], [3, 1], [2, 1], [1, 1], [1, 0], [1, -1], [2, -1],
  [3, -1], [3, -2], [2, -2], [1, -2], [0, -2], [0, -1], [0, 0],
];
const NIVEL_PASO_TORRE = new Map(PASOS_TORRE.map(([ix, iz], i) => [`${ix},${iz}`, i + 1]));

function alturaTorre(ix, iz) {
  if (Math.max(Math.abs(ix), Math.abs(iz)) > 5) return 0;
  return NIVEL_PASO_TORRE.get(`${ix},${iz}`) ?? 1;
}

function alturaIslas(ix, iz) {
  // isla principal (centro)
  const d2 = Math.max(Math.abs(ix), Math.abs(iz));
  if (d2 === 0) return 11;
  if (d2 <= 1) return 9;
  if (d2 <= 2) return 7;
  if (d2 <= 3) return 5;
  if (d2 <= 4) return 3;
  if (d2 <= 5) return 1;
  // puentes (z=0, 1 bloque de ancho)
  if (iz === 0 && ix >= -9 && ix <= -6) return 1;
  if (iz === 0 && ix >=  6 && ix <=  9) return 1;
  // isla izquierda en x=-13
  const d1 = Math.max(Math.abs(ix + 13), Math.abs(iz));
  if (d1 === 0) return 7;
  if (d1 <= 1) return 5;
  if (d1 <= 2) return 3;
  if (d1 <= 3) return 1;
  // isla derecha en x=13
  const d3 = Math.max(Math.abs(ix - 13), Math.abs(iz));
  if (d3 === 0) return 7;
  if (d3 <= 1) return 5;
  if (d3 <= 2) return 3;
  if (d3 <= 3) return 1;
  return 0;
}

const PIRAMIDES_ARENA = [
  [0, 0], [7, 7], [-7, 7], [7, -7], [-7, -7], [0, 9], [9, 0],
];

function alturaArena(ix, iz) {
  if (Math.max(Math.abs(ix), Math.abs(iz)) > 11) return 0;
  let h = 1;
  for (const [px, pz] of PIRAMIDES_ARENA) {
    const d = Math.max(Math.abs(ix - px), Math.abs(iz - pz));
    if (d === 0) h = Math.max(h, 5);
    else if (d === 1) h = Math.max(h, 4);
    else if (d === 2) h = Math.max(h, 3);
    else if (d === 3) h = Math.max(h, 2);
  }
  return h;
}

function alturaBatalla(ix, iz) {
  return Math.max(Math.abs(ix), Math.abs(iz)) <= 10 ? 1 : 0;
}

export function obtenerAlturaFn(tipo) {
  if (tipo === 'torre')    return alturaTorre;
  if (tipo === 'islas')    return alturaIslas;
  if (tipo === 'arena')    return alturaArena;
  if (tipo === 'batalla')  return alturaBatalla;
  return alturaPiramideBase;
}

/* -------- Constructor -------- */

const NIVEL_INICIAL_PIRAMIDE = 4;
const MAX_DYN_MINAS = 60;
const ELEV_POR_TIPO = { piramide: 0, torre: 0, islas: 3, arena: 0, batalla: 0 };
const PROB_MINAS_ESTATICA = {
  piramide: { facil: 0.015, normal: 0.03, dificil: 0.06 },
  torre:    { facil: 0.03,   normal: 0.06, dificil: 0.12 },
  islas:    { facil: 0.025,  normal: 0.05, dificil: 0.10 },
  arena:    { facil: 0.01,   normal: 0.02, dificil: 0.04 },
  batalla:  { facil: 0,      normal: 0,    dificil: 0 },
};

export function crearEstructura(escena, tipo = 'piramide', dificultad = 'normal', celdasProtegidas = []) {
  _setMineTopColor(_C_MINA_A);

  const alturaFn = obtenerAlturaFn(tipo);
  const RANGO = tipo === 'islas' ? 16 : tipo === 'piramide' ? 10 : tipo === 'arena' ? 12 : tipo === 'batalla' ? 10 : 5;
  const ELEVACION = ELEV_POR_TIPO[tipo] || 0;
  const probMinas = PROB_MINAS_ESTATICA[tipo]?.[dificultad] ?? 0.03;
  const probCuboCae = PROB_CUBO_CAE[dificultad] ?? PROB_CUBO_CAE.normal;
  let _nivelMaxVisible = 100;

  function esProtegida(ix, iz) {
    if (celdasProtegidas.some(([px, pz]) => ix === px && iz === pz)) return true;
    if (ix === 0 && iz === 0) return true;
    if (tipo === 'torre' && NIVEL_PASO_TORRE.has(`${ix},${iz}`)) return true;
    if (tipo !== 'islas') return false;
    if (iz === 0 && ((ix >= -9 && ix <= -6) || (ix >= 6 && ix <= 9))) return true;
    return iz === 0 && (ix === -13 || ix === 13);
  }

  /* -- Single pass: collect data and count -- */
  const cubeData = [];
  let nSeguro = 0, nMinas = 0, nBloqueado = 0;

  for (let ix = -RANGO; ix <= RANGO; ix++) {
    for (let iz = -RANGO; iz <= RANGO; iz++) {
      const hMax = alturaFn(ix, iz);
      if (hMax <= 0) continue;
      const key = `${ix},${iz}`;
      const esBloqueado = tipo === 'piramide' && iz < 0;
      for (let h = 0; h < hMax; h++) {
        const nivel  = h + 1;
        const esTapa = h === hMax - 1;
        const esMina = esTapa && hMax > 1 && !esProtegida(ix, iz) && rand() < probMinas;
        if (esBloqueado) nBloqueado++;
        else if (esMina) nMinas++; else nSeguro++;
        cubeData.push({
          key, nivel, esTapa, esMina, esBloqueado,
          wx: ix * 2, wz: iz * 2,
          targetY: h * 2 + 1 + ELEVACION * 2,
          oculto: nivel > _nivelMaxVisible,
        });
      }
    }
  }

  const nTotal = cubeData.length;

  /* -- InstancedMesh: 3 draw calls for the entire structure -- */
  const instSeguro   = new THREE.InstancedMesh(_GEO_SEGURO,   _MAT_VC,      nSeguro    || 1);
  // Extra slots at the end for dynamic mine conversions
  const instMinas    = new THREE.InstancedMesh(_GEO_MINA,     _MAT_VC,      (nMinas || 1) + MAX_DYN_MINAS);
  const instBloqueado = new THREE.InstancedMesh(_GEO_BLOQUEADO, _MAT_VC,    nBloqueado || 1);
  const instOutline  = new THREE.InstancedMesh(_GEO_OUTLINE,  _MAT_OUTLINE, nTotal     || 1);

  instSeguro.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instMinas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instBloqueado.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instOutline.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  instSeguro.count   = nSeguro;
  instMinas.count    = nMinas;
  instBloqueado.count = nBloqueado;
  instOutline.count  = nTotal;

  escena.add(instSeguro);
  escena.add(instMinas);
  escena.add(instBloqueado);
  escena.add(instOutline);

  /* -- Tracking -- */
  const cubosPorNivel  = new Map(); // nivel → [{sIdx or mIdx, outlineIdx, isMina, wx, wz, targetY}]
  const cubosEnCaida   = [];
  const minasPos       = new Set(); // "ix,iz"
  const minasOcultas   = new Map(); // "ix,iz" → {mIdx, outlineIdx}
  const cubosTapa      = new Map(); // "ix,iz" → {instIdx, outlineIdx, isMina}
  const minasActiveIdx = [];        // mIdx values of active mines
  const avisos         = new Map(); // "ix,iz" → {ix, iz, mesh, t, fase}
  const pasosPendientes = new Map(); // "ix,iz" → {ix, iz, t}
  const cubosCayendo    = [];        // cubos que se desprenden al pisarlos
  const cubosCaidos     = new Set(); // "ix,iz" ya desaparecidos

  for (let n = 1; n <= 14; n++) cubosPorNivel.set(n, []);

  let sIdx = 0, mIdx = 0, bIdx = 0, oIdx = 0;

  for (const c of cubeData) {
    const { key, nivel, esTapa, esMina, esBloqueado, wx, wz, targetY, oculto } = c;
    const outlineIdx = oIdx++;
    let instIdx;

    if (esBloqueado) {
      instIdx = bIdx++;
      if (oculto) {
        instBloqueado.setMatrixAt(instIdx, _HIDDEN);
        instOutline.setMatrixAt(outlineIdx, _HIDDEN);
      } else {
        _M4.makeTranslation(wx, targetY, wz);
        instBloqueado.setMatrixAt(instIdx, _M4);
        instOutline.setMatrixAt(outlineIdx, _M4);
        if (esMina) minasPos.add(key);
      }
    } else if (esMina) {
      instIdx = mIdx++;
      if (oculto) {
        instMinas.setMatrixAt(instIdx, _HIDDEN);
        instOutline.setMatrixAt(outlineIdx, _HIDDEN);
        if (esTapa) minasOcultas.set(key, { mIdx: instIdx, outlineIdx });
      } else {
        _M4.makeTranslation(wx, targetY, wz);
        instMinas.setMatrixAt(instIdx, _M4);
        instOutline.setMatrixAt(outlineIdx, _M4);
        minasPos.add(key);
        minasActiveIdx.push(instIdx);
      }
    } else {
      instIdx = sIdx++;
      if (oculto) {
        instSeguro.setMatrixAt(instIdx, _HIDDEN);
        instOutline.setMatrixAt(outlineIdx, _HIDDEN);
      } else {
        _M4.makeTranslation(wx, targetY, wz);
        instSeguro.setMatrixAt(instIdx, _M4);
        instOutline.setMatrixAt(outlineIdx, _M4);
      }
    }

    cubosPorNivel.get(nivel)?.push({ instIdx, outlineIdx, isMina: esMina, bloqueado: esBloqueado, wx, wz, targetY });
    if (esTapa) cubosTapa.set(key, { instIdx, outlineIdx, isMina: esMina, bloqueado: esBloqueado });
  }

  instSeguro.instanceMatrix.needsUpdate   = true;
  instMinas.instanceMatrix.needsUpdate    = true;
  instBloqueado.instanceMatrix.needsUpdate = true;
  instOutline.instanceMatrix.needsUpdate  = true;

  /* -------- Revelar nivel -------- */
  function revelarNivel(n) {
    if (n <= _nivelMaxVisible || n > 14) return;
    _nivelMaxVisible = n;

    (cubosPorNivel.get(n) || []).forEach((entry, i) => {
      const startY = entry.targetY + 10 + Math.random() * 3;
      _M4.makeTranslation(entry.wx, startY, entry.wz);
      const mesh = entry.bloqueado ? instBloqueado : entry.isMina ? instMinas : instSeguro;
      mesh.setMatrixAt(entry.instIdx, _M4);
      instOutline.setMatrixAt(entry.outlineIdx, _M4);
      cubosEnCaida.push({ ...entry, currentY: startY, delay: i * 0.003 });
    });
    instSeguro.instanceMatrix.needsUpdate   = true;
    instMinas.instanceMatrix.needsUpdate    = true;
    instBloqueado.instanceMatrix.needsUpdate = true;
    instOutline.instanceMatrix.needsUpdate  = true;

    const toActivate = [];
    minasOcultas.forEach(({ mIdx: mi }, key) => {
      const [mix, miz] = key.split(',').map(Number);
      if (alturaFn(mix, miz) === n) toActivate.push({ key, mi });
    });
    toActivate.forEach(({ key, mi }) => {
      minasPos.add(key);
      minasActiveIdx.push(mi);
      minasOcultas.delete(key);
    });
  }

  /* -------- Animación -------- */
  function animarMinas(delta) {
    // Aviso naranja → rojo → mina activa (sin parpadeo)
    for (const [key, av] of avisos) {
      av.t += delta;
      if (av.fase === 0 && av.t >= AVISO_NARANJA) {
        av.fase = 1;
        av.mesh.material = _MAT_AVISO_ROJO;
      }
      if (av.t >= AVISO_NARANJA + AVISO_ROJO) {
        escena.remove(av.mesh);
        avisos.delete(key);
        convertirEnMina(av.ix, av.iz);
      }
    }

    // Cubos que se desprenden después de ser pisados
    for (const [key, paso] of pasosPendientes) {
      paso.t += delta;
      if (paso.t >= RETARDO_CUBO_CAE) {
        pasosPendientes.delete(key);
        desprenderCubo(paso.ix, paso.iz);
      }
    }

    if (cubosCayendo.length > 0) {
      let moved = false;
      for (let i = cubosCayendo.length - 1; i >= 0; i--) {
        const c = cubosCayendo[i];
        c.y -= 12 * delta;
        _M4.makeRotationY((c.y0 - c.y) * 0.18);
        _M4.setPosition(c.wx, c.y, c.wz);
        instSeguro.setMatrixAt(c.instIdx, _M4);
        instOutline.setMatrixAt(c.outlineIdx, _M4);
        moved = true;
        if (c.y < -30) {
          instSeguro.setMatrixAt(c.instIdx, _HIDDEN);
          instOutline.setMatrixAt(c.outlineIdx, _HIDDEN);
          cubosCayendo.splice(i, 1);
        }
      }
      if (moved) {
        instSeguro.instanceMatrix.needsUpdate  = true;
        instOutline.instanceMatrix.needsUpdate = true;
      }
    }

    // Caída al revelar
    if (cubosEnCaida.length > 0) {
      let moved = false;
      for (let i = cubosEnCaida.length - 1; i >= 0; i--) {
        const f = cubosEnCaida[i];
        f.delay -= delta;
        if (f.delay > 0) continue;
        f.currentY = Math.max(f.targetY, f.currentY - 12 * delta);
        _M4.makeTranslation(f.wx, f.currentY, f.wz);
        const mesh = f.bloqueado ? instBloqueado : f.isMina ? instMinas : instSeguro;
        mesh.setMatrixAt(f.instIdx, _M4);
        instOutline.setMatrixAt(f.outlineIdx, _M4);
        moved = true;
        if (f.currentY <= f.targetY) cubosEnCaida.splice(i, 1);
      }
      if (moved) {
        instSeguro.instanceMatrix.needsUpdate   = true;
        instMinas.instanceMatrix.needsUpdate    = true;
        instBloqueado.instanceMatrix.needsUpdate = true;
        instOutline.instanceMatrix.needsUpdate  = true;
      }
    }
  }

  function esMina(ix, iz) {
    if (alturaFn(ix, iz) > _nivelMaxVisible) return false;
    return minasPos.has(`${ix},${iz}`);
  }

  function estaCaido(ix, iz) {
    return cubosCaidos.has(`${ix},${iz}`);
  }

  function registrarPaso(ix, iz) {
    const key = `${ix},${iz}`;
    if (cubosCaidos.has(key) || pasosPendientes.has(key) || minasPos.has(key)) return false;
    const tapa = cubosTapa.get(key);
    if (!tapa || tapa.isMina || tapa.bloqueado) return false;
    if (esProtegida(ix, iz)) return false;
    if (alturaFn(ix, iz) >= alturaFn(0, 0)) return false;
    if (rand() >= probCuboCae) return false;
    pasosPendientes.set(key, { ix, iz, t: 0 });
    return true;
  }

  function desprenderCubo(ix, iz) {
    const key = `${ix},${iz}`;
    const tapa = cubosTapa.get(key);
    if (!tapa || tapa.isMina || tapa.bloqueado || cubosCaidos.has(key)) return;

    const y0 = alturaFn(ix, iz) * 2 - 1 + ELEVACION * 2;
    cubosCayendo.push({ instIdx: tapa.instIdx, outlineIdx: tapa.outlineIdx, wx: ix * 2, wz: iz * 2, y: y0, y0 });
    cubosCaidos.add(key);
    cubosTapa.delete(key);
    instSeguro.instanceMatrix.needsUpdate  = true;
    instOutline.instanceMatrix.needsUpdate = true;
  }

  function avisarMina(ix, iz) {
    const key = `${ix},${iz}`;
    if (minasPos.has(key) || avisos.has(key)) return false;
    const tapa = cubosTapa.get(key);
    if (!tapa || tapa.isMina || tapa.bloqueado || esProtegida(ix, iz) || alturaFn(ix, iz) > _nivelMaxVisible) return false;

    const h = alturaFn(ix, iz);
    const mesh = new THREE.Mesh(_GEO_AVISO, _MAT_AVISO_NARANJA);
    mesh.position.set(ix * 2, h * 2 + ELEVACION * 2 + 0.06, iz * 2);
    escena.add(mesh);
    avisos.set(key, { ix, iz, mesh, t: 0, fase: 0 });
    return true;
  }

  function convertirEnMina(ix, iz) {
    const key = `${ix},${iz}`;
    if (minasPos.has(key)) return false;
    const tapa = cubosTapa.get(key);
    if (!tapa || tapa.isMina || tapa.bloqueado || esProtegida(ix, iz) || alturaFn(ix, iz) > _nivelMaxVisible) return false;

    // Hide the seguro cube
    instSeguro.setMatrixAt(tapa.instIdx, _HIDDEN);
    instSeguro.instanceMatrix.needsUpdate = true;

    // Place a mine in the dynamic area at the end of instMinas
    const dynIdx = instMinas.count;
    if (dynIdx < nMinas + MAX_DYN_MINAS) {
      const h = alturaFn(ix, iz) - 1;
      _M4.makeTranslation(ix * 2, h * 2 + 1 + ELEVACION * 2, iz * 2);
      instMinas.setMatrixAt(dynIdx, _M4);
      instMinas.count = dynIdx + 1;
      instMinas.instanceMatrix.needsUpdate = true;
      minasActiveIdx.push(dynIdx);
    }

    minasPos.add(key);
    // The outline at tapa.outlineIdx stays visible at the correct position
    return true;
  }

  function eliminarCubo(ix, iz) {
    const key = `${ix},${iz}`;
    const tapa = cubosTapa.get(key);
    if (!tapa) return;

    const av = avisos.get(key);
    if (av) {
      escena.remove(av.mesh);
      avisos.delete(key);
    }

    const mesh = tapa.bloqueado ? instBloqueado : tapa.isMina ? instMinas : instSeguro;
    mesh.setMatrixAt(tapa.instIdx, _HIDDEN);
    mesh.instanceMatrix.needsUpdate = true;

    if (tapa.isMina) {
      minasPos.delete(key);
      const ai = minasActiveIdx.indexOf(tapa.instIdx);
      if (ai !== -1) minasActiveIdx.splice(ai, 1);
    }
    instOutline.setMatrixAt(tapa.outlineIdx, _HIDDEN);
    instOutline.instanceMatrix.needsUpdate = true;
    cubosTapa.delete(key);
  }

  function limpiar() {
    escena.remove(instSeguro);
    escena.remove(instMinas);
    escena.remove(instBloqueado);
    escena.remove(instOutline);
    instSeguro.dispose();
    instMinas.dispose();
    instBloqueado.dispose();
    instOutline.dispose();
    cubosEnCaida.length = 0;
    minasPos.clear();
    minasOcultas.clear();
    cubosTapa.clear();
    minasActiveIdx.length = 0;
    avisos.forEach((av) => escena.remove(av.mesh));
    avisos.clear();
    pasosPendientes.clear();
    cubosCayendo.length = 0;
    cubosCaidos.clear();
  }

  return {
    alturaFn,
    animarMinas,
    esMina,
    estaCaido,
    registrarPaso,
    avisarMina,
    convertirEnMina,
    eliminarCubo,
    desprenderCubo,
    limpiar,
    revelarNivel,
    elevacion: ELEVACION,
    get nivelMaxVisible() { return _nivelMaxVisible; },
    get minasCount()      { return minasPos.size; },
    get minasPendientes() { return avisos.size; },
    get tapasCount()      { return cubosTapa.size; },
  };
}
