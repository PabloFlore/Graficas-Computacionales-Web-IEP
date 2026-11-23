import * as THREE from 'three';

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
const _GEO_SEGURO  = _crearGeoVC('#8fe0b8', '#e8a878', '#c9885a');
const _GEO_MINA    = _crearGeoVC('#ff6b57', '#e8a878', '#c9885a');
const _GEO_OUTLINE = new THREE.BoxGeometry(2.12, 2.12, 2.12);
const _MAT_VC      = new THREE.MeshBasicMaterial({ vertexColors: true, map: _TEX_BORDE });
const _MAT_OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1f2430, side: THREE.BackSide });

const _HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const _M4     = new THREE.Matrix4();

// Top de mina: rojo fijo (sin parpadeo)
const _C_MINA_A = new THREE.Color('#ff6b57');

const AVISO_NARANJA = 1.1;
const AVISO_ROJO    = 1.0;

const PROB_CUBO_CAE   = 0.22;
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

export function alturaEn(ix, iz) {
  const d = Math.max(Math.abs(ix), Math.abs(iz));
  return Math.max(0, 11 - d);
}

function alturaTorre(ix, iz) {
  const d = Math.max(Math.abs(ix), Math.abs(iz));
  if (d === 0) return 14;
  if (d <= 1) return 11;
  if (d <= 2) return 8;
  if (d <= 3) return 5;
  if (d <= 4) return 2;
  if (d <= 5) return 1;
  return 0;
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

export function obtenerAlturaFn(tipo) {
  if (tipo === 'torre') return alturaTorre;
  if (tipo === 'islas') return alturaIslas;
  return alturaEn;
}

/* -------- Constructor -------- */

const NIVEL_INICIAL_PIRAMIDE = 4;
const MAX_DYN_MINAS = 60;
const ELEV_POR_TIPO = { piramide: 0, torre: 0, islas: 3 };
const PROB_MINAS_ESTATICA = { facil: 0.05, normal: 0.10, dificil: 0.18 };

export function crearEstructura(escena, tipo = 'piramide', dificultad = 'normal') {
  _setMineTopColor(_C_MINA_A);

  const alturaFn = obtenerAlturaFn(tipo);
  const RANGO = tipo === 'islas' ? 16 : tipo === 'piramide' ? 10 : 5;
  const ELEVACION = ELEV_POR_TIPO[tipo] || 0;
  let _nivelMaxVisible = 100;

  /* -- Single pass: collect data and count -- */
  const cubeData = [];
  let nSeguro = 0, nMinas = 0;

  for (let ix = -RANGO; ix <= RANGO; ix++) {
    for (let iz = -RANGO; iz <= RANGO; iz++) {
      const hMax = alturaFn(ix, iz);
      if (hMax <= 0) continue;
      const key = `${ix},${iz}`;
      for (let h = 0; h < hMax; h++) {
        const nivel  = h + 1;
        const esTapa = h === hMax - 1;
        const esMina = esTapa && hMax > 1 && Math.random() < (PROB_MINAS_ESTATICA[dificultad] ?? 0.03);
        if (esMina) nMinas++; else nSeguro++;
        cubeData.push({
          key, nivel, esTapa, esMina,
          wx: ix * 2, wz: iz * 2,
          targetY: h * 2 + 1 + ELEVACION * 2,
          oculto: nivel > _nivelMaxVisible,
        });
      }
    }
  }

  const nTotal = cubeData.length;

  /* -- InstancedMesh: 3 draw calls for the entire structure -- */
  const instSeguro  = new THREE.InstancedMesh(_GEO_SEGURO,  _MAT_VC,      nSeguro || 1);
  // Extra slots at the end for dynamic mine conversions
  const instMinas   = new THREE.InstancedMesh(_GEO_MINA,    _MAT_VC,      (nMinas || 1) + MAX_DYN_MINAS);
  const instOutline = new THREE.InstancedMesh(_GEO_OUTLINE, _MAT_OUTLINE, nTotal  || 1);

  instSeguro.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instMinas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instOutline.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  instSeguro.count  = nSeguro;
  instMinas.count   = nMinas;
  instOutline.count = nTotal;

  escena.add(instSeguro);
  escena.add(instMinas);
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

  let sIdx = 0, mIdx = 0, oIdx = 0;

  for (const c of cubeData) {
    const { key, nivel, esTapa, esMina, wx, wz, targetY, oculto } = c;
    const outlineIdx = oIdx++;
    let instIdx;

    if (esMina) {
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

    cubosPorNivel.get(nivel)?.push({ instIdx, outlineIdx, isMina: esMina, wx, wz, targetY });
    if (esTapa) cubosTapa.set(key, { instIdx, outlineIdx, isMina: esMina });
  }

  instSeguro.instanceMatrix.needsUpdate  = true;
  instMinas.instanceMatrix.needsUpdate   = true;
  instOutline.instanceMatrix.needsUpdate = true;

  /* -------- Revelar nivel -------- */
  function revelarNivel(n) {
    if (n <= _nivelMaxVisible || n > 14) return;
    _nivelMaxVisible = n;

    (cubosPorNivel.get(n) || []).forEach((entry, i) => {
      const startY = entry.targetY + 10 + Math.random() * 3;
      _M4.makeTranslation(entry.wx, startY, entry.wz);
      if (entry.isMina) instMinas.setMatrixAt(entry.instIdx, _M4);
      else              instSeguro.setMatrixAt(entry.instIdx, _M4);
      instOutline.setMatrixAt(entry.outlineIdx, _M4);
      cubosEnCaida.push({ ...entry, currentY: startY, delay: i * 0.003 });
    });
    instSeguro.instanceMatrix.needsUpdate  = true;
    instMinas.instanceMatrix.needsUpdate   = true;
    instOutline.instanceMatrix.needsUpdate = true;

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
        if (f.isMina) instMinas.setMatrixAt(f.instIdx, _M4);
        else          instSeguro.setMatrixAt(f.instIdx, _M4);
        instOutline.setMatrixAt(f.outlineIdx, _M4);
        moved = true;
        if (f.currentY <= f.targetY) cubosEnCaida.splice(i, 1);
      }
      if (moved) {
        instSeguro.instanceMatrix.needsUpdate  = true;
        instMinas.instanceMatrix.needsUpdate   = true;
        instOutline.instanceMatrix.needsUpdate = true;
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
    if (!tapa || tapa.isMina) return false;
    if (alturaFn(ix, iz) >= alturaFn(0, 0)) return false;
    if (Math.random() >= PROB_CUBO_CAE) return false;
    pasosPendientes.set(key, { ix, iz, t: 0 });
    return true;
  }

  function desprenderCubo(ix, iz) {
    const key = `${ix},${iz}`;
    const tapa = cubosTapa.get(key);
    if (!tapa || tapa.isMina || cubosCaidos.has(key)) return;

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
    if (!tapa || tapa.isMina || alturaFn(ix, iz) > _nivelMaxVisible) return false;

    const h = alturaFn(ix, iz);
    const mesh = new THREE.Mesh(_GEO_AVISO, _MAT_AVISO_NARANJA);
    mesh.position.set(ix * 2, h * 2 + ELEVACION * 2 + 0.06, iz * 2);
    escena.add(mesh);
    avisos.set(key, { ix, iz, mesh, t: 0, fase: 0 });
    return true;
  }

  function convertirEnMina(ix, iz) {
    const key = `${ix},${iz}`;
    if (minasPos.has(key)) return;
    const tapa = cubosTapa.get(key);
    if (!tapa || tapa.isMina || alturaFn(ix, iz) > _nivelMaxVisible) return;

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

    if (tapa.isMina) {
      instMinas.setMatrixAt(tapa.instIdx, _HIDDEN);
      instMinas.instanceMatrix.needsUpdate = true;
      minasPos.delete(key);
      const ai = minasActiveIdx.indexOf(tapa.instIdx);
      if (ai !== -1) minasActiveIdx.splice(ai, 1);
    } else {
      instSeguro.setMatrixAt(tapa.instIdx, _HIDDEN);
      instSeguro.instanceMatrix.needsUpdate = true;
    }
    instOutline.setMatrixAt(tapa.outlineIdx, _HIDDEN);
    instOutline.instanceMatrix.needsUpdate = true;
    cubosTapa.delete(key);
  }

  function limpiar() {
    escena.remove(instSeguro);
    escena.remove(instMinas);
    escena.remove(instOutline);
    instSeguro.dispose();
    instMinas.dispose();
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
    limpiar,
    revelarNivel,
    elevacion: ELEVACION,
    get nivelMaxVisible() { return _nivelMaxVisible; },
    get minasCount()      { return minasPos.size; },
    get minasPendientes() { return avisos.size; },
    get tapasCount()      { return cubosTapa.size; },
  };
}
