import * as THREE from 'three';
import { rand } from '../util/rng.js';

const TIPOS = [
  { id: 'semilla',   color: 0x7d5a1e, puntos:  5, peso: 35 },
  { id: 'manzana',   color: 0xe74c3c, puntos: 10, peso: 30 },
  { id: 'zanahoria', color: 0xff7f00, puntos: 15, peso: 20 },
  { id: 'dulce',     color: 0xfd79a8, puntos: 20, peso: 10 },
];

// Elige un tipo ponderando por rareza: los de mayor valor salen menos.
function elegirTipo() {
  const total = TIPOS.reduce((s, t) => s + t.peso, 0);
  let r = rand() * total;
  for (const t of TIPOS) {
    r -= t.peso;
    if (r <= 0) return t;
  }
  return TIPOS[0];
}

function crearManzana(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color, flatShading: true });
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), mat);
  g.add(cuerpo);
  const tallo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.18, 4),
    new THREE.MeshPhongMaterial({ color: 0x5a3e1b, flatShading: true })
  );
  tallo.position.y = 0.26;
  g.add(tallo);
  return g;
}

function crearZanahoria(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color, flatShading: true });
  const cuerpo = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 5), mat);
  cuerpo.rotation.x = Math.PI;
  g.add(cuerpo);
  const hoja = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.2, 4),
    new THREE.MeshPhongMaterial({ color: 0x27ae60, flatShading: true })
  );
  hoja.position.y = 0.26;
  g.add(hoja);
  return g;
}

function crearSemilla(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color, flatShading: true });
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.18, 5, 4), mat);
  cuerpo.scale.y = 0.6;
  g.add(cuerpo);
  return g;
}

function crearDulce(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color, flatShading: true });
  const cuerpo = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), mat);
  g.add(cuerpo);
  return g;
}

function crearMesh(tipo) {
  switch (tipo.id) {
    case 'manzana':   return crearManzana(tipo.color);
    case 'zanahoria': return crearZanahoria(tipo.color);
    case 'semilla':   return crearSemilla(tipo.color);
    case 'dulce':     return crearDulce(tipo.color);
  }
}

const VIDA_ITEM = 25; // segundos antes de que un item desaparezca

export function crearSistemaColeccionables(scene, alturaFn, rango, baseYFn) {
  const activos = new Map(); // "ix,iz" → { grupo, tipo, baseY, t, vida }

  function spawn(ix, iz) {
    const key = `${ix},${iz}`;
    if (activos.has(key)) return;
    const h = alturaFn(ix, iz);
    if (h <= 0) return;
    const tipo = elegirTipo();
    const grupo = crearMesh(tipo);
    const baseY = (baseYFn ? baseYFn(ix, iz) + 1 : h * 2) + 0.8;
    grupo.position.set(ix * 2, baseY, iz * 2);
    grupo.scale.setScalar(2.2);
    scene.add(grupo);
    activos.set(key, { grupo, tipo, baseY, t: rand() * Math.PI * 2, vida: VIDA_ITEM });
  }

  function spawnAleatorio() {
    const ix = Math.floor(rand() * (rango * 2 + 1)) - rango;
    const iz = Math.floor(rand() * (rango * 2 + 1)) - rango;
    spawn(ix, iz);
  }

  function spawnEnCuadrante(qx, qz) {
    const ix = qx > 0
      ? Math.floor(rand() * (rango + 1))
      : -(Math.floor(rand() * rango) + 1);
    const iz = qz > 0
      ? Math.floor(rand() * (rango + 1))
      : -(Math.floor(rand() * rango) + 1);
    spawn(ix, iz);
  }

  function itemsEnCuadrante(qx, qz, limite = Infinity) {
    let n = 0;
    activos.forEach((_, key) => {
      const [ix, iz] = key.split(',').map(Number);
      if (Math.abs(ix) > limite || Math.abs(iz) > limite) return;
      if ((qx > 0 ? ix >= 0 : ix < 0) && (qz > 0 ? iz >= 0 : iz < 0)) n++;
    });
    return n;
  }

  function tieneItem(ix, iz) {
    return activos.has(`${ix},${iz}`);
  }

  function recoger(ix, iz) {
    const key = `${ix},${iz}`;
    const item = activos.get(key);
    if (!item) return null;
    scene.remove(item.grupo);
    activos.delete(key);
    return item.tipo.puntos;
  }

  function animar(delta) {
    const expirados = [];
    activos.forEach((item, key) => {
      item.t += delta * 2.5;
      item.grupo.position.y = item.baseY + Math.sin(item.t) * 0.2;
      item.grupo.rotation.y += delta * 2;
      item.vida -= delta;
      if (item.vida <= 0) expirados.push(key);
    });
    expirados.forEach((key) => {
      scene.remove(activos.get(key).grupo);
      activos.delete(key);
    });
  }

  function limpiar() {
    activos.forEach(({ grupo }) => scene.remove(grupo));
    activos.clear();
  }

  return { spawn, spawnAleatorio, spawnEnCuadrante, itemsEnCuadrante, tieneItem, recoger, animar, limpiar };
}
