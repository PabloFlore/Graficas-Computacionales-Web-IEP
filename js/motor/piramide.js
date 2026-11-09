import * as THREE from 'three';

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
