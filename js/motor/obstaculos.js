import * as THREE from 'three';
import { rand } from '../util/rng.js';

const CONFIG = {
  facil:   { tortugas: 1, rango: 2, paso: 1.5, hierbas: 6 },
  normal:  { tortugas: 2, rango: 3, paso: 1.2, hierbas: 10 },
  dificil: { tortugas: 3, rango: 3, paso: 0.9, hierbas: 14 },
};

const INTERVALO_HIERBA = 4;
const SOBRE_CUBO = 1;
const MAT_CAPARAZON = new THREE.MeshPhongMaterial({ color: 0x5f8a3a, flatShading: true });
const MAT_CAPARAZON_CLARO = new THREE.MeshPhongMaterial({ color: 0x7fae55, flatShading: true });
const MAT_CABEZA = new THREE.MeshPhongMaterial({ color: 0x9bc46a, flatShading: true });
const MAT_PATA = new THREE.MeshPhongMaterial({ color: 0x4e7030, flatShading: true });
const MAT_HIERBA = new THREE.MeshPhongMaterial({ color: 0x43a047, flatShading: true });
const MAT_HIERBA_CLARA = new THREE.MeshPhongMaterial({ color: 0x66bb6a, flatShading: true });

function crearTortuga() {
  const g = new THREE.Group();

  const caparazon = new THREE.Mesh(new THREE.SphereGeometry(0.46, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT_CAPARAZON);
  caparazon.scale.y = 0.7;
  caparazon.position.y = 0.18;
  g.add(caparazon);

  const centro = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), MAT_CAPARAZON_CLARO);
  centro.scale.y = 0.35;
  centro.position.y = 0.45;
  g.add(centro);

  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), MAT_CABEZA);
  cabeza.position.set(0.5, 0.28, 0);
  g.add(cabeza);

  for (const dx of [-0.28, 0.28]) {
    for (const dz of [-0.3, 0.3]) {
      const pata = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.22), MAT_PATA);
      pata.position.set(dx, 0.08, dz);
      g.add(pata);
    }
  }

  const cola = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 4), MAT_PATA);
  cola.rotation.z = Math.PI / 2;
  cola.position.set(-0.55, 0.2, 0);
  g.add(cola);

  g.scale.setScalar(1.35);
  return g;
}

function crearHierba() {
  const g = new THREE.Group();
  const hojas = [
    [-0.18, 0, 0.12], [0.05, 0.1, -0.16], [0.2, -0.08, 0.05], [-0.04, -0.14, -0.04],
  ];
  hojas.forEach(([x, z, tilt], i) => {
    const hoja = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.42, 4),
      i % 2 ? MAT_HIERBA_CLARA : MAT_HIERBA
    );
    hoja.position.set(x, 0.2, z);
    hoja.rotation.z = tilt;
    g.add(hoja);
  });
  g.scale.setScalar(1.4);
  return g;
}

export function crearSistemaObstaculos(scene, alturaFn, rango, baseYFn, puedeOcupar) {
  let config = CONFIG.normal;
  const tortugas = new Map();
  const hierbas = new Map();
  let hierbaTick = 0;

  function clave(ix, iz) { return `${ix},${iz}`; }

  function accesible(ix, iz, ctx = {}) {
    if (!puedeOcupar(ix, iz)) return false;
    if (ctx.celdaX !== undefined) {
      const refX = ctx.destinoX !== undefined ? ctx.destinoX : ctx.celdaX;
      const refZ = ctx.destinoZ !== undefined ? ctx.destinoZ : ctx.celdaZ;
      if (alturaFn(ix, iz) > alturaFn(refX, refZ) + 3) return false;
    }
    return true;
  }

  function libre(ix, iz, ctx = {}) {
    if (!accesible(ix, iz, ctx)) return false;
    if (tortugas.has(clave(ix, iz))) return false;
    if (hierbas.has(clave(ix, iz))) return false;
    if (ctx.celdaX === ix && ctx.celdaZ === iz) return false;
    if (ctx.destinoX === ix && ctx.destinoZ === iz) return false;
    return true;
  }

  function celdaAleatoria(ctx) {
    for (let i = 0; i < 40; i++) {
      const ix = Math.floor(rand() * (rango * 2 + 1)) - rango;
      const iz = Math.floor(rand() * (rango * 2 + 1)) - rango;
      if (!libre(ix, iz, ctx)) continue;
      if (ctx.celdaX !== undefined && Math.abs(ix - ctx.celdaX) + Math.abs(iz - ctx.celdaZ) < 2) continue;
      return { ix, iz };
    }
    return null;
  }

  function spawnTortuga(ctx) {
    const centro = celdaAleatoria(ctx);
    if (!centro) return false;

    const medio = config.rango;
    const minX = Math.max(-rango, centro.ix - medio);
    const maxX = Math.min(rango, centro.ix + medio);
    for (let x = minX; x <= maxX; x++) {
      if (!accesible(x, centro.iz, ctx)) return false;
    }

    const dir = rand() < 0.5 ? 1 : -1;
    const ix = minX + Math.floor(rand() * (maxX - minX + 1));
    const grupo = crearTortuga();
    const baseY = baseYFn(ix, centro.iz) + SOBRE_CUBO;
    grupo.position.set(ix * 2, baseY + 0.1, centro.iz * 2);
    grupo.rotation.y = dir > 0 ? 0 : Math.PI;
    scene.add(grupo);
    tortugas.set(clave(ix, centro.iz), { grupo, ix, iz: centro.iz, minX, maxX, dir, baseY, t: 0 });
    return true;
  }

  function spawnHierba(ctx) {
    const celda = celdaAleatoria(ctx);
    if (!celda) return false;
    const grupo = crearHierba();
    const baseY = baseYFn(celda.ix, celda.iz) + SOBRE_CUBO;
    grupo.position.set(celda.ix * 2, baseY + 0.08, celda.iz * 2);
    scene.add(grupo);
    hierbas.set(clave(celda.ix, celda.iz), { grupo, baseY, t: Math.random() * Math.PI * 2 });
    return true;
  }

  function poblar(ctx) {
    for (let i = 0; i < config.tortugas; i++) {
      for (let intento = 0; intento < 20; intento++) {
        if (spawnTortuga(ctx)) break;
      }
    }
    for (let i = 0; i < config.hierbas; i++) {
      for (let intento = 0; intento < 20; intento++) {
        if (spawnHierba(ctx)) break;
      }
    }
  }

  function estaBloqueada(ix, iz) {
    return tortugas.has(clave(ix, iz));
  }

  function consumirHierba(ix, iz) {
    const key = clave(ix, iz);
    const hierba = hierbas.get(key);
    if (!hierba) return false;
    scene.remove(hierba.grupo);
    hierbas.delete(key);
    return true;
  }

  function animar(delta, ctx = {}) {
    const ocupadas = new Set(tortugas.keys());
    if (ctx.celdaX !== undefined) ocupadas.add(clave(ctx.celdaX, ctx.celdaZ));
    if (ctx.destinoX !== undefined) ocupadas.add(clave(ctx.destinoX, ctx.destinoZ));

    const movimientos = [];
    tortugas.forEach((tor, key) => {
      tor.t += delta;
      tor.grupo.position.y = tor.baseY + 0.1 + Math.sin(tor.t * 3) * 0.05;
      tor.grupo.rotation.z = Math.sin(tor.t * 2.2) * 0.05;
      if (ctx.saltando || tor.t < config.paso) return;
      tor.t = 0;

      let sig = tor.ix + tor.dir;
      const ocupado = (x) => x < tor.minX || x > tor.maxX || ocupadas.has(clave(x, tor.iz)) || !accesible(x, tor.iz, ctx);
      if (ocupado(sig)) {
        tor.dir *= -1;
        sig = tor.ix + tor.dir;
        if (ocupado(sig)) return;
      }
      movimientos.push({ key, tor, sig });
    });

    movimientos.forEach(({ key, tor, sig }) => {
      tortugas.delete(key);
      tor.ix = sig;
      tor.baseY = baseYFn(sig, tor.iz) + SOBRE_CUBO;
      tor.grupo.position.set(sig * 2, tor.baseY + 0.1, tor.iz * 2);
      tor.grupo.rotation.y = tor.dir > 0 ? 0 : Math.PI;
      tortugas.set(clave(sig, tor.iz), tor);
    });

    hierbas.forEach((h) => {
      h.t += delta * 2;
      h.grupo.rotation.z = Math.sin(h.t) * 0.12;
    });

    hierbaTick += delta;
    if (hierbaTick >= INTERVALO_HIERBA) {
      hierbaTick = 0;
      const faltan = config.hierbas - hierbas.size;
      for (let i = 0; i < Math.min(2, faltan); i++) spawnHierba(ctx);
    }
  }

  function invertirTortugas() {
    tortugas.forEach((tor) => {
      tor.dir *= -1;
      tor.grupo.rotation.y = tor.dir > 0 ? 0 : Math.PI;
    });
  }

  function limpiar() {
    tortugas.forEach(({ grupo }) => scene.remove(grupo));
    hierbas.forEach(({ grupo }) => scene.remove(grupo));
    tortugas.clear();
    hierbas.clear();
    hierbaTick = 0;
  }

  return {
    configurar(dificultad) { config = CONFIG[dificultad] || CONFIG.normal; },
    poblar,
    estaBloqueada,
    consumirHierba,
    animar,
    invertirTortugas,
    limpiar,
    get tortugasCount() { return tortugas.size; },
    get hierbasCount() { return hierbas.size; },
  };
}
