import * as THREE from 'three';
import { crearPato } from './pato.js';

export function iniciarPatoMenu() {
  const canvas = document.getElementById('pato-menu-canvas');
  if (!canvas) return;

  const W = 210, H = 160;
  canvas.width  = W * 2;
  canvas.height = H * 2;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W * 2, H * 2, false);
  renderer.setClearColor(0x000000, 0);

  const scene  = new THREE.Scene();
  // 45° a la derecha del frente del pato (que mira +X)
  const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 50);
  camera.position.set(1.4, 0.85, -1.4);
  camera.lookAt(0.15, 0.55, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const sol = new THREE.DirectionalLight(0xfffde0, 1.4);
  sol.position.set(3, 5, 1);
  scene.add(sol);
  const frontal = new THREE.DirectionalLight(0xffffff, 0.7);
  frontal.position.set(2, 2, -3);
  scene.add(frontal);
  const rebote = new THREE.DirectionalLight(0xd0eeff, 0.4);
  rebote.position.set(-2, 1, 2);
  scene.add(rebote);

  const pato = crearPato(0xffd45e);
  scene.add(pato);

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}
