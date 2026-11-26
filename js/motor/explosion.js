import * as THREE from 'three';

const COLORES = [0xff4400, 0xff8c00, 0xffcc00, 0xffd45e, 0xff6b6b, 0xffffff];

export function crearExplosion(scene, posicion) {
  const fragmentos = [];
  const COUNT = 28;

  for (let i = 0; i < COUNT; i++) {
    const size = 0.12 + Math.random() * 0.22;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshPhongMaterial({
        color: COLORES[Math.floor(Math.random() * COLORES.length)],
        transparent: true,
        opacity: 1,
      })
    );
    mesh.position.copy(posicion);
    mesh.position.y += 0.5;

    const speed = 3 + Math.random() * 5;
    const angle = Math.random() * Math.PI * 2;
    const up    = 2 + Math.random() * 6;
    fragmentos.push({
      mesh,
      vx: Math.cos(angle) * speed,
      vy: up,
      vz: Math.sin(angle) * speed,
      rx: (Math.random() - 0.5) * 10,
      ry: (Math.random() - 0.5) * 10,
      rz: (Math.random() - 0.5) * 10,
    });
    scene.add(mesh);
  }

  let t = 0;
  const DURACION = 1.0;

  function animar(delta) {
    t += delta;
    const prog = t / DURACION;
    if (prog >= 1) {
      fragmentos.forEach(({ mesh }) => scene.remove(mesh));
      return true;
    }
    fragmentos.forEach((f) => {
      f.vy -= 14 * delta;
      f.mesh.position.x += f.vx * delta;
      f.mesh.position.y += f.vy * delta;
      f.mesh.position.z += f.vz * delta;
      f.mesh.rotation.x += f.rx * delta;
      f.mesh.rotation.y += f.ry * delta;
      f.mesh.rotation.z += f.rz * delta;
      f.mesh.material.opacity = 1 - prog;
    });
    return false;
  }

  return { animar };
}
