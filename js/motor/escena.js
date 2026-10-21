import * as THREE from 'three';
import { crearGestorCarga, cargarModelos } from './modelos.js';
import { crearPiramide } from './piramide.js';

const MODELOS = [
  {
    tipo: 'obj',
    ruta: 'assets/models/duck',
    nombre: 'Duck',
    escala: new THREE.Vector3(1, 1, 1),
    posicion: new THREE.Vector3(0, 0.5, 0),
  },
];

export async function iniciarEscena({ alMoverJugador } = {}) {
  const scene = new THREE.Scene();

  // FOV reducido para vista isométrica limpia (menos deformación de perspectiva).
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const vistaJuego = document.getElementById('vista-juego');
  vistaJuego.insertBefore(renderer.domElement, vistaJuego.firstChild);

  /* ---------- Pirámide ---------- */
  crearPiramide(scene);

  /* ---------- Jugador ---------- */
  // jugador: control de teclado mueve X/Z.
  // bob: subgrupo que anima el eje Y (bob de espera) sin interferir con el teclado.
  const jugador = new THREE.Group();
  const bob = new THREE.Group();
  jugador.add(bob);
  scene.add(jugador);
  jugador.position.set(0, 0, 4);

  /* ---------- Luces ---------- */

  // Luz ambiental: rellena las sombras sin borrarlas por completo.
  const luzAmbiental = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(luzAmbiental);

  const sol = new THREE.DirectionalLight(0xffffff, 1.2);
  sol.position.set(10, 12, 10);
  scene.add(sol);

  /* ---------- Cámara isométrica ---------- */
  // Posición diagonal: igual distancia en X y Z, elevada en Y.
  // lookAt al centro de la pirámide (nivel 2 de 5).
  camera.position.set(14, 14, 14);
  camera.lookAt(0, 2, 0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ---------- Animación ---------- */
  const reloj = new THREE.Clock();

  // mixers recoge todos los AnimationMixer activos (pato + cualquier GLB futuro).
  const mixers = [];

  renderer.setAnimationLoop(animate);

  /* ---------- Carga del pato ---------- */
  const gestor = crearGestorCarga();
  const modelosCargados = await cargarModelos(MODELOS, gestor);

  modelosCargados.forEach((modelo) => {
    bob.add(modelo);

    // Si el modelo trae animaciones (GLB/GLTF), las reproducimos todas.
    if (modelo.userData.animations?.length) {
      const m = new THREE.AnimationMixer(modelo);
      modelo.userData.animations.forEach((clip) => m.clipAction(clip).play());
      mixers.push(m);
    }
  });

  // Animación de espera (idle bob): oscilación suave del pato en Y.
  // Usa NumberKeyframeTrack + AnimationMixer para demostrar el sistema
  // de animaciones de Three.js/WebGL integrado en la escena.
  const mixerBob = new THREE.AnimationMixer(bob);
  mixers.push(mixerBob);

  const pistaBob = new THREE.NumberKeyframeTrack(
    '.position[y]',       // propiedad del nodo raíz del mixer (bob)
    [0,    0.5,  1.0],    // tiempos (s)
    [0.5,  0.58, 0.5]     // Y base = 0.5 (sobre el cubo), cima = 0.58
  );
  const clipBob = new THREE.AnimationClip('espera', 1.0, [pistaBob]);
  mixerBob.clipAction(clipBob).setLoop(THREE.LoopRepeat).play();

  /* ---------- Control por teclado ---------- */
  // Movimiento sobre la base de la pirámide (−2 a +2 en X y Z).
  // TODO: implementar detección de escalón para subir/bajar de nivel.
  const PASO = 1;
  const LIMITE_X = 4;
  const LIMITE_Z_MIN = -4;
  const LIMITE_Z_MAX = 4;

  document.addEventListener('keydown', (event) => {
    if (!vistaJuego.classList.contains('activa')) return;

    let movido = false;
    const tecla = event.key;

    if (tecla === 'a' || tecla === 'ArrowLeft') { jugador.position.x -= PASO; movido = true; }
    if (tecla === 'd' || tecla === 'ArrowRight') { jugador.position.x += PASO; movido = true; }
    if (tecla === 'w' || tecla === 'ArrowUp')    { jugador.position.z -= PASO; movido = true; }
    if (tecla === 's' || tecla === 'ArrowDown')  { jugador.position.z += PASO; movido = true; }

    if (tecla.startsWith('Arrow')) event.preventDefault();
    if (!movido) return;

    jugador.position.x = Math.max(-LIMITE_X, Math.min(LIMITE_X, jugador.position.x));
    jugador.position.z = Math.max(LIMITE_Z_MIN, Math.min(LIMITE_Z_MAX, jugador.position.z));

    if (typeof alMoverJugador === 'function') {
      alMoverJugador(jugador.position);
    }
  });

  function animate() {
    const delta = reloj.getDelta();
    // Los mixers se actualizan siempre: así no acumulan tiempo durante la pausa.
    mixers.forEach((m) => m.update(delta));

    if (vistaJuego.classList.contains('activa')) {
      renderer.render(scene, camera);
    }
  }

  /* ---------- Jugadores remotos (multijugador) ---------- */
  const remotos = new Map();

  function colorPorId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) {
      hash = (hash * 31 + id.charCodeAt(i)) % 360;
    }
    return new THREE.Color(`hsl(${hash}, 80%, 55%)`);
  }

  function agregarJugadorRemoto(remoto) {
    if (!remoto || remotos.has(remoto.id)) return;

    const avatar = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshPhongMaterial({ color: colorPorId(remoto.id) })
    );
    avatar.name = remoto.nombre || remoto.id;
    avatar.position.set(remoto.x || 0, remoto.y || 0, remoto.z || 0);
    scene.add(avatar);
    remotos.set(remoto.id, avatar);
  }

  function moverJugadorRemoto(remoto) {
    const avatar = remotos.get(remoto.id);
    if (avatar) avatar.position.set(remoto.x, remoto.y, remoto.z);
  }

  function quitarJugadorRemoto(id) {
    const avatar = remotos.get(id);
    if (avatar) {
      scene.remove(avatar);
      remotos.delete(id);
    }
  }

  return {
    scene,
    jugador,
    agregarJugadorRemoto,
    moverJugadorRemoto,
    quitarJugadorRemoto,
  };
}
