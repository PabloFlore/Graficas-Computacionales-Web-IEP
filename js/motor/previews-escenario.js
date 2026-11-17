import * as THREE from 'three';

const W = 180, H = 200;

const SKY = { piramide: 0x6cc0f0, torre: 0xffb85e, islas: 0xb8d4e0 };

function _geoVC() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const n   = geo.attributes.position.count;
  const buf = new Float32Array(n * 3);
  const cols = [
    new THREE.Color(0xe8a878),
    new THREE.Color(0xc9885a),
    new THREE.Color(0x8fe0b8),
    new THREE.Color(0xc9885a),
    new THREE.Color(0xc9885a),
    new THREE.Color(0xe8a878),
  ];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = (f * 4 + v) * 3;
      buf[i] = cols[f].r; buf[i+1] = cols[f].g; buf[i+2] = cols[f].b;
    }
  geo.setAttribute('color', new THREE.BufferAttribute(buf, 3));
  return geo;
}

function _buildScene(cubos) {
  const scene  = new THREE.Scene();
  const geo    = _geoVC();
  const mat    = new THREE.MeshBasicMaterial({ vertexColors: true });
  const geoOut = new THREE.BoxGeometry(1.08, 1.08, 1.08);
  const matOut = new THREE.MeshBasicMaterial({ color: 0x1f2430, side: THREE.BackSide });
  const m4     = new THREE.Matrix4();
  const n      = cubos.length;
  const inst    = new THREE.InstancedMesh(geo,    mat,    n);
  const instOut = new THREE.InstancedMesh(geoOut, matOut, n);
  cubos.forEach(([x, y, z], i) => {
    m4.makeTranslation(x, y, z);
    inst.setMatrixAt(i, m4);
    instOut.setMatrixAt(i, m4);
  });
  inst.instanceMatrix.needsUpdate    = true;
  instOut.instanceMatrix.needsUpdate = true;
  scene.add(inst);
  scene.add(instOut);
  return scene;
}

function _addNubes(scene, positions) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xf8faff, transparent: true, opacity: 0.88 });
  const box = (x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    scene.add(m);
  };
  positions.forEach(([bx, by, bz, s]) => {
    box(bx,          by,      bz,      3.0*s, 1.2*s, 2.5*s);
    box(bx - 1.6*s,  by,      bz+0.2*s, 1.8*s, 1.0*s, 2.0*s);
    box(bx + 1.6*s,  by,      bz+0.2*s, 1.8*s, 1.0*s, 2.0*s);
    box(bx,          by+0.5*s, bz,      2.0*s, 0.8*s, 2.0*s);
  });
}

function _cubos_piramide() {
  const c = [];
  for (let ix = -5; ix <= 5; ix++)
    for (let iz = -5; iz <= 5; iz++) {
      const h = Math.max(0, 6 - Math.max(Math.abs(ix), Math.abs(iz)));
      for (let iy = 0; iy < h; iy++) c.push([ix, iy, iz]);
    }
  return c;
}

function _cubos_torre() {
  const c = [];
  for (let ix = -4; ix <= 4; ix++)
    for (let iz = -4; iz <= 4; iz++) {
      const d = Math.max(Math.abs(ix), Math.abs(iz));
      const h = d === 0 ? 14 : d === 1 ? 10 : d === 2 ? 7 : d === 3 ? 4 : d === 4 ? 1 : 0;
      for (let iy = 0; iy < h; iy++) c.push([ix, iy, iz]);
    }
  return c;
}

function _cubos_islas() {
  const c = [];
  const EL_IZQ = 3;   // isla pequeña izquierda (referencia)
  const EL_CEN = -2;  // isla grande centro (5 abajo)
  const EL_DER = -4;  // isla mediana derecha (2 más abajo)

  const isla = (cx, cz, maxH, r, el) => {
    for (let ix = cx - r; ix <= cx + r; ix++)
      for (let iz = cz - r; iz <= cz + r; iz++) {
        const h = Math.max(0, maxH - Math.max(Math.abs(ix - cx), Math.abs(iz - cz)));
        for (let iy = 0; iy < h; iy++) c.push([ix, iy + el, iz]);
      }
  };

  isla(-14,  0, 4, 2, EL_IZQ);  // pequeña – frente izquierda
  isla(  0,  0, 8, 4, EL_CEN);  // grande  – meta central
  isla(  0, 14, 5, 2, EL_DER);  // mediana – atrás izquierda

  // puente frente-izquierdo (sube de EL_CEN a EL_IZQ, eje X)
  for (let bx = -11; bx <= -5; bx++) {
    const t = (bx + 11) / 6;
    c.push([bx, Math.round(EL_IZQ + t * (EL_CEN - EL_IZQ)), 0]);
  }

  // puente atrás-izquierdo (baja de EL_CEN a EL_DER, eje Z)
  for (let bz = 5; bz <= 11; bz++) {
    const t = (bz - 5) / 6;
    c.push([0, Math.round(EL_CEN + t * (EL_DER - EL_CEN)), bz]);
  }

  return c;
}

function _render(id, cubos, camPos, lookAt, zoom, skyHex, nubePos) {
  const canvas = document.getElementById(id);
  if (!canvas) return;

  canvas.width  = W * 2;
  canvas.height = H * 2;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W * 2, H * 2, false);
  renderer.setClearColor(0x000000, 0);

  const aspect = W / H;
  const camera = new THREE.OrthographicCamera(
    -zoom * aspect, zoom * aspect, zoom, -zoom, 0.1, 200
  );
  camera.position.set(camPos[0], camPos[1], camPos[2]);
  camera.lookAt(new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]));

  const scene = _buildScene(cubos);
  _addNubes(scene, nubePos);
  renderer.render(scene, camera);
  renderer.dispose();
}

export function iniciarPreviewsEscenario() {
  const camPos = [20, 18, 20];

  try { _render('preview-piramide', _cubos_piramide(), camPos,       [0, 3, 0], 10, SKY.piramide, []); } catch(e) { console.error('preview-piramide', e); }
  try { _render('preview-torre',    _cubos_torre(),    camPos,       [0, 7, 0], 12, SKY.torre,    []); } catch(e) { console.error('preview-torre',    e); }
  try { _render('preview-islas',    _cubos_islas(), [18, 16, 18], [-4, 1, 5], 20, SKY.islas,    []); } catch(e) { console.error('preview-islas',    e); }
}
