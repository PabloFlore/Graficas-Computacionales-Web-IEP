import * as THREE from 'three';
import { rand } from '../util/rng.js';

// Tres objetos especiales (ítems) para cubrir el rubro "3 como mínimo":
//  🛟 escudo — absorbe el siguiente golpe mortal (mina, agua o cubo caído)
//  🪽 pluma  — doble salto: sube +1 nivel extra durante unos segundos
//  🧲 imán   — recoge también los coleccionables de las 4 celdas vecinas
export const TIPOS_POWERUP = {
  escudo: { id: 'escudo', color: 0x3ad1ff, dur: 0 },   // dur 0 = hasta recibir un golpe
  pluma:  { id: 'pluma',  color: 0xfff176, dur: 8 },
  iman:   { id: 'iman',   color: 0xff6fae, dur: 8 },
};

function crearEscudo(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color, flatShading: true, transparent: true, opacity: 0.85 });
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 14), mat);
  anillo.rotation.x = Math.PI / 2;
  g.add(anillo);
  const nucleo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.14, 0),
    new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true })
  );
  g.add(nucleo);
  return g;
}

function crearPluma(color) {
  const g = new THREE.Group();
  const pluma = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.5, 4),
    new THREE.MeshPhongMaterial({ color, flatShading: true })
  );
  g.add(pluma);
  const tallo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4),
    new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true })
  );
  tallo.position.y = -0.02;
  g.add(tallo);
  return g;
}

function crearIman(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color, flatShading: true });
  const arco = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 6, 12, Math.PI), mat);
  arco.rotation.z = Math.PI;
  g.add(arco);
  for (const dx of [-0.2, 0.2]) {
    const punta = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.18, 0.1),
      new THREE.MeshPhongMaterial({ color: 0xeeeeee, flatShading: true })
    );
    punta.position.set(dx, 0.14, 0);
    g.add(punta);
  }
  return g;
}

function crearMesh(id, color) {
  if (id === 'escudo') return crearEscudo(color);
  if (id === 'pluma')  return crearPluma(color);
  return crearIman(color);
}

const VIDA_POWERUP = 12; // segundos visible antes de desaparecer

export function crearSistemaPowerups(scene, alturaFn, rango, baseYFn, puedeOcupar) {
  const activos = new Map(); // "ix,iz" -> { grupo, tipo, baseY, t, vida }
  const ids = Object.keys(TIPOS_POWERUP);

  function celdaValida(ix, iz) {
    if (alturaFn(ix, iz) <= 0) return false;
    if (activos.has(`${ix},${iz}`)) return false;
    if (puedeOcupar && !puedeOcupar(ix, iz)) return false;
    return true;
  }

  function spawn(ix, iz, idForzado = null) {
    const key = `${ix},${iz}`;
    if (activos.has(key)) return;
    const id = idForzado || ids[Math.floor(rand() * ids.length)];
    const tipo = TIPOS_POWERUP[id];
    const grupo = crearMesh(id, tipo.color);
    const baseY = (baseYFn ? baseYFn(ix, iz) + 1 : alturaFn(ix, iz) * 2) + 1.0;
    grupo.position.set(ix * 2, baseY, iz * 2);
    grupo.scale.setScalar(2.0);
    scene.add(grupo);
    activos.set(key, { grupo, tipo, baseY, t: rand() * Math.PI * 2, vida: VIDA_POWERUP });
  }

  function spawnAleatorio() {
    for (let i = 0; i < 30; i++) {
      const ix = Math.floor(rand() * (rango * 2 + 1)) - rango;
      const iz = Math.floor(rand() * (rango * 2 + 1)) - rango;
      if (!celdaValida(ix, iz)) continue;
      spawn(ix, iz);
      return true;
    }
    return false;
  }

  function recoger(ix, iz) {
    const key = `${ix},${iz}`;
    const it = activos.get(key);
    if (!it) return null;
    scene.remove(it.grupo);
    activos.delete(key);
    return it.tipo; // { id, color, dur }
  }

  function tiene(ix, iz) {
    return activos.has(`${ix},${iz}`);
  }

  function animar(delta) {
    const expirados = [];
    activos.forEach((it, key) => {
      it.t += delta * 2;
      it.grupo.position.y = it.baseY + Math.sin(it.t) * 0.25;
      it.grupo.rotation.y += delta * 1.5;
      it.vida -= delta;
      if (it.vida <= 0) expirados.push(key);
    });
    expirados.forEach((k) => {
      scene.remove(activos.get(k).grupo);
      activos.delete(k);
    });
  }

  function limpiar() {
    activos.forEach(({ grupo }) => scene.remove(grupo));
    activos.clear();
  }

  return {
    spawn,
    spawnAleatorio,
    recoger,
    tiene,
    animar,
    limpiar,
    get cantidad() { return activos.size; },
  };
}
