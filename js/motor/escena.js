import * as THREE from 'three';
import { crearGestorCarga, cargarModelos } from './modelos.js';

// Lista de modelos 3D a cargar. Queda vacia hasta tener los archivos:
// basta agregar un elemento y el modelo aparece en la escena.
//   { tipo: 'obj', ruta: 'assets/models/Anakin', nombre: 'Anakin', escala: new THREE.Vector3(1, 1, 1) }
//   { tipo: 'glb', ruta: 'assets/models/glb/pato.glb', nombre: 'Pato', escala: new THREE.Vector3(1, 1, 1) }
// El pato apoya sobre el cubo (cubo de 1x1x1 centrado en el origen -> techo en Y=0.5).
const MODELOS = [
  {
    tipo: 'obj',
    ruta: 'assets/models/duck',
    nombre: 'Duck',
    escala: new THREE.Vector3(1, 1, 1),
    posicion: new THREE.Vector3(0, 0.5, 0)
  },
];

export async function iniciarEscena({ alMoverJugador } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  // alpha: true deja el lienzo transparente para que se vea
  // el fondo negro de la ventana detrás de la escena.
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const vistaJuego = document.getElementById('vista-juego');
  vistaJuego.insertBefore(renderer.domElement, vistaJuego.firstChild);

  /* ---------- Figuras: textura basica + luces (Practica 4) ---------- */
  // MeshPhongMaterial reacciona a las luces de la escena.
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshPhongMaterial({ color: 0x00ff00 })
  );

  // El jugador agrupa el cubo (hitbox) y los modelos cargados (pato),
  // asi se mueven juntos con el teclado.
  const jugador = new THREE.Group();
  jugador.add(cube);
  scene.add(jugador);

  const esfera = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 32, 32),
    new THREE.MeshPhongMaterial({ color: 0x0000ff })
  );
  esfera.position.set(-10, 0.2, -1);
  scene.add(esfera);

  const cilindro = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
    new THREE.MeshPhongMaterial({ color: 0xff0000 })
  );
  cilindro.position.set(-2.5, 0.2, -1);
  scene.add(cilindro);

  /* ---------- Suelo ---------- */
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 5),
    new THREE.MeshPhongMaterial({ color: 0x888888, specular: 0xffffff, side: THREE.DoubleSide })
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.y = -1;
  suelo.position.z = -2.5;
  scene.add(suelo);

  /* ---------- Luces (como la Practica 4) ---------- */

  // Luz ambiental
  const luzAmbiental = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(luzAmbiental);

  // Luz direccional (frontal): lado de enfrente iluminado, trasero en sombra
  const luzDireccional = new THREE.DirectionalLight(0xffffff, 1.5);
  luzDireccional.position.set(0, 0, 10);
  const helperDireccional = new THREE.DirectionalLightHelper(luzDireccional, 2);
  scene.add(luzDireccional, helperDireccional);

  // Luz puntual
  const luzPuntual = new THREE.PointLight(0xff8c00, 2);
  luzPuntual.position.set(esfera.position.x, 4, -10);
  const helperPuntual = new THREE.PointLightHelper(luzPuntual);
  scene.add(luzPuntual, helperPuntual);

  camera.position.z = 8;
  camera.position.y = 2.5;

  // La escena y el lienzo se adaptan al tamaño de la ventana.
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Solo se dibuja cuando la vista de juego está activa: así el
  // render se detiene en el menú y durante la pausa. El reloj se
  // consulta igual en cada fotograma para que el tiempo pausado no
  // se acumule y la esfera no salte de golpe al reanudar.
  const reloj = new THREE.Clock();
  let direccion = 1;
  const velocidad = 2;
  const LIMITE = 10;

  renderer.setAnimationLoop(animate);

  // Un unico LoadingManager compartido por todos los loaders.
  // cargarModelos no rechaza: si un archivo falta, solo avisa por consola.
  const gestor = crearGestorCarga();
  const modelosCargados = await cargarModelos(MODELOS, gestor);
  modelosCargados.forEach((modelo) => jugador.add(modelo));

  // Control del jugador por teclado: WASD y flechas, pasos de 1 unidad
  // sobre el plano X/Z. Solo responde cuando la vista de juego esta activa.
  const PASO = 1;
  const LIMITE_X = 13;
  const LIMITE_Z_FONDO = -4.5;
  const LIMITE_Z_FRENTE = 0;

  document.addEventListener('keydown', (event) => {
    if (!vistaJuego.classList.contains('activa')) {
      return;
    }

    const tecla = event.key;
    let movido = false;

    if (tecla === 'a' || tecla === 'ArrowLeft') {
      jugador.position.x -= PASO;
      movido = true;
    }
    if (tecla === 'd' || tecla === 'ArrowRight') {
      jugador.position.x += PASO;
      movido = true;
    }
    if (tecla === 'w' || tecla === 'ArrowUp') {
      jugador.position.z -= PASO;
      movido = true;
    }
    if (tecla === 's' || tecla === 'ArrowDown') {
      jugador.position.z += PASO;
      movido = true;
    }

    if (tecla.startsWith('Arrow')) {
      event.preventDefault();
    }

    if (!movido) {
      return;
    }

    jugador.position.x = Math.max(-LIMITE_X, Math.min(LIMITE_X, jugador.position.x));
    jugador.position.z = Math.max(LIMITE_Z_FONDO, Math.min(LIMITE_Z_FRENTE, jugador.position.z));

    // Se avisa la nueva posicion para sincronizarla con los demas jugadores.
    if (typeof alMoverJugador === 'function') {
      alMoverJugador(jugador.position);
    }
  });

  function animate() {
    const delta = reloj.getDelta();

    if (vistaJuego.classList.contains('activa')) {
      // Movimiento gradual y lento de la esfera entre X=-10 y X=10.
      esfera.position.x += direccion * velocidad * delta;
      if (esfera.position.x >= LIMITE) {
        esfera.position.x = LIMITE;
        direccion *= -1;
      } else if (esfera.position.x <= -LIMITE) {
        esfera.position.x = -LIMITE;
        direccion *= -1;
      }

      // La luz puntual comparte la posición X de la esfera.
      luzPuntual.position.x = esfera.position.x;

      renderer.render(scene, camera);
    }
  }

  /* ---------- Jugadores remotos (multijugador) ---------- */
  const remotos = new Map();

  // Color estable por jugador, derivado del id, para distinguirlos.
  function colorPorId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) {
      hash = (hash * 31 + id.charCodeAt(i)) % 360;
    }
    return new THREE.Color(`hsl(${hash}, 80%, 55%)`);
  }

  function agregarJugadorRemoto(remoto) {
    if (!remoto || remotos.has(remoto.id)) {
      return;
    }

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
    if (avatar) {
      avatar.position.set(remoto.x, remoto.y, remoto.z);
    }
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
    quitarJugadorRemoto
  };
}