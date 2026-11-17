import * as THREE from 'three';

export function crearPato(colorCuerpo = 0xffd45e, colorOjo = 0x1a1a2e) {
  const grupo = new THREE.Group();

  const matAmarillo = new THREE.MeshPhongMaterial({ color: colorCuerpo, flatShading: true });
  const matNaranja  = new THREE.MeshPhongMaterial({ color: 0xff9d3d, flatShading: true });
  const matNegro    = new THREE.MeshBasicMaterial({ color: colorOjo });
  const matBlanco   = new THREE.MeshBasicMaterial({ color: colorOjo === 0xffffff ? 0x1a1a2e : 0xffffff });

  // Cuerpo: esfera achatada, base en y=0
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 7, 5), matAmarillo);
  cuerpo.scale.set(1.1, 0.88, 1.0);
  cuerpo.position.y = 0.42;

  // Cabeza
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), matAmarillo);
  cabeza.position.set(0.25, 0.9, 0);

  // Pico superior e inferior (boca de pato)
  const picoSup = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.22), matNaranja);
  picoSup.position.set(0.56, 0.9, 0);
  const picoInf = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.19), matNaranja);
  picoInf.position.set(0.55, 0.81, 0);

  // Ojos
  const ojoL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), matNegro);
  ojoL.position.set(0.34, 0.97, 0.22);
  const brilloL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 3), matBlanco);
  brilloL.position.set(0.37, 1.0, 0.24);

  const ojoR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), matNegro);
  ojoR.position.set(0.34, 0.97, -0.22);
  const brilloR = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 3), matBlanco);
  brilloR.position.set(0.37, 1.0, -0.24);

  // Cola: cono de 4 lados, estilo diamante
  const cola = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 4), matAmarillo);
  cola.rotation.z = Math.PI * 0.65;
  cola.position.set(-0.52, 0.52, 0);

  grupo.add(cuerpo, cabeza, picoSup, picoInf, cola);
  grupo.add(ojoL, brilloL, ojoR, brilloR);

  return grupo;
}
