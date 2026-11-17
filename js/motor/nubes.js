import * as THREE from 'three';

const _GEO = new THREE.BoxGeometry(1, 1, 1);
const _MAT = new THREE.MeshBasicMaterial({ color: 0xf8faff, transparent: true, opacity: 0.90 });

function _crearNube(x, y, z, s) {
  const g = new THREE.Group();
  const box = (dx, dy, dz, w, h, d) => {
    const m = new THREE.Mesh(_GEO, _MAT);
    m.position.set(dx * s, dy * s, dz * s);
    m.scale.set(w * s, h * s, d * s);
    g.add(m);
  };
  box( 0,    0,    0,   3.0, 1.2, 2.5);
  box(-1.6,  0,    0.2, 1.8, 1.0, 2.0);
  box( 1.6,  0,    0.2, 1.8, 1.0, 2.0);
  box( 0,    0.5,  0,   2.0, 0.8, 2.0);
  box( 0.7,  0.4,  0.6, 1.4, 0.7, 1.4);
  g.position.set(x, y, z);
  return g;
}

const CONFIGS = {
  piramide: [
    { x: -16, y: 16, z: -10, s: 1.3 },
    { x:  12, y: 18, z: -15, s: 1.0 },
    { x:  18, y: 14, z:   8, s: 1.5 },
    { x:  -8, y: 20, z:  14, s: 1.1 },
    { x:   4, y: 22, z:  -6, s: 0.9 },
  ],
  torre: [
    { x: -15, y: 32, z: -12, s: 1.4 },
    { x:  12, y: 30, z: -18, s: 1.1 },
    { x:  18, y: 35, z:  10, s: 1.6 },
    { x: -10, y: 28, z:  16, s: 0.9 },
  ],
  islas: [
    { x:  -5, y:  5, z:  -8, s: 1.5 },
    { x:   8, y:  6, z:  -5, s: 1.2 },
    { x:  18, y:  4, z:   5, s: 1.4 },
    { x: -14, y:  7, z:   3, s: 1.0 },
    { x:   2, y:  3, z:  12, s: 1.6 },
    { x: -10, y:  8, z:  14, s: 0.8 },
    { x:   5, y: 10, z: -15, s: 1.1 },
  ],
};

const RANGO = { piramide: 24, torre: 20, islas: 28 };

export function crearNubes(scene, tipo) {
  const cfg = CONFIGS[tipo] || CONFIGS.piramide;
  const rango = RANGO[tipo] || 24;
  const nubes = [];

  cfg.forEach(({ x, y, z, s }) => {
    const n = _crearNube(x, y, z, s);
    n.userData.vx = (0.3 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
    scene.add(n);
    nubes.push(n);
  });

  return {
    animar(delta) {
      nubes.forEach(n => {
        n.position.x += n.userData.vx * delta;
        if (n.position.x >  rango) n.position.x = -rango;
        if (n.position.x < -rango) n.position.x =  rango;
      });
    },
    limpiar() {
      nubes.forEach(n => scene.remove(n));
      nubes.length = 0;
    },
  };
}
