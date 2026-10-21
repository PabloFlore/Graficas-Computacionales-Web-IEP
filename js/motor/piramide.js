import * as THREE from 'three';

// Cache de texturas por color para no crear un canvas por cada cubo.
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

// Paleta de colores según la guía visual (pág. 4 y 6 del PDF).
const PALETA = {
  seguro: { top: '#8fe0b8', lit: '#e8a878', shadow: '#c9885a' },
  mina:   { top: '#ff6b57', lit: '#e8a878', shadow: '#c9885a' },
};

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
function crearCubo(x, y, z, tipo = 'seguro') {
  const c = PALETA[tipo] || PALETA.seguro;

  const mats = [
    new THREE.MeshBasicMaterial({ map: texturaCara(c.lit) }),    // +x  lado iluminado
    new THREE.MeshBasicMaterial({ map: texturaCara(c.shadow) }), // -x  lado sombra
    new THREE.MeshBasicMaterial({ map: texturaCara(c.top) }),    // +y  tapa
    new THREE.MeshBasicMaterial({ map: texturaCara(c.shadow) }), // -y  fondo (no visible)
    new THREE.MeshBasicMaterial({ map: texturaCara(c.shadow) }), // +z  lado sombra
    new THREE.MeshBasicMaterial({ map: texturaCara(c.lit) }),    // -z  lado iluminado
  ];

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
  mesh.position.set(x, y, z);

  // Contorno: mismo cubo levemente agrandado con normales volteadas.
  // Los fragmentos que sobresalen del cubo interior quedan visibles
  // como línea negra entre cubos adyacentes.
  const contorno = new THREE.Mesh(
    new THREE.BoxGeometry(1.06, 1.06, 1.06),
    new THREE.MeshBasicMaterial({ color: 0x1f2430, side: THREE.BackSide })
  );
  mesh.add(contorno);

  return mesh;
}

/**
 * Devuelve cuántos cubos de altura tiene la columna en (ix, iz).
 * Distancia de Chebyshev al centro → cuanto más cerca, más alta la columna.
 */
export function alturaEn(ix, iz) {
  return RADIO + 1 - Math.max(Math.abs(ix), Math.abs(iz));
}

// Radio de la base (9×9 cuadrícula, 5 niveles de altura).
// Todas las posiciones X e Z son enteros: no hay cortes en las caras.
const RADIO = 4;

/**
 * Construye una pirámide escalonada de 5 niveles con columnas de cubos apilados.
 * Enfoque por columna + distancia de Chebyshev: todas las posiciones son
 * enteros, por lo que cada cara lateral queda completamente visible.
 *
 * Base 9×9 (RADIO=4), cima 1×1 en el centro.
 */
export function crearPiramide(escena) {
  const cubos = [];

  for (let ix = -RADIO; ix <= RADIO; ix++) {
    for (let iz = -RADIO; iz <= RADIO; iz++) {
      const altura = alturaEn(ix, iz);

      for (let h = 0; h < altura; h++) {
        // Solo la tapa de cada columna puede ser mina.
        const esMina = h === altura - 1 && Math.random() < 0.08;
        const cubo = crearCubo(ix, h, iz, esMina ? 'mina' : 'seguro');
        escena.add(cubo);
        cubos.push({ mesh: cubo, nivel: h, tipo: esMina ? 'mina' : 'seguro' });
      }
    }
  }

  return cubos;
}
