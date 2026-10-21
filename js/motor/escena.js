import * as THREE from 'three';
import { crearGestorCarga, cargarModelos } from './modelos.js';
import { crearPiramide } from './piramide.js';
import { crearSalto, crearMezclador, crearRebote, crearGiro, crearBarrido } from './animaciones.js';

// Lista de modelos 3D a cargar: basta agregar un elemento y el modelo
// aparece en la escena.
//   { tipo: 'obj', ruta: 'assets/models/Anakin', nombre: 'Anakin', escala: new THREE.Vector3(1, 1, 1) }
//   { tipo: 'glb', ruta: 'assets/models/glb/pato.glb', nombre: 'Pato', escala: new THREE.Vector3(1, 1, 1) }
// El pato ('Duck') es el modelo del jugador; los demas son decorativos y
// se distinguen por su nombre (no por el orden).
// El pato apoya sobre el cubo hitbox (cubo de 1x1x1 centrado en el
// origen -> techo en Y=0.5); el grupo 'bob' lo sube a esa altura.
const MODELOS = [
  {
    tipo: 'obj',
    ruta: 'assets/models/duck',
    nombre: 'Duck',
    escala: new THREE.Vector3(1, 1, 1),
    posicion: new THREE.Vector3(0, 0, 0),
  },
  // Decorativos con animacion procedural. El pivote de estos GLB esta en
  // la base (spring tiene el pivote centrado), asi que se apoyan en el
  // mismo nivel que la base de la piramide (y = -0.5) y quedan en una
  // fila por delante de ella, de cara a la camara.
  {
    tipo: 'glb',
    ruta: 'assets/models/spring.glb',
    nombre: 'Spring',
    escala: new THREE.Vector3(0.04, 0.04, 0.04),
    posicion: new THREE.Vector3(2.83, -0.46, 8.49),
  },
  {
    tipo: 'glb',
    ruta: 'assets/models/escudo.glb',
    nombre: 'Escudo',
    escala: new THREE.Vector3(0.22, 0.22, 0.22),
    posicion: new THREE.Vector3(5.66, -0.5, 5.66),
  },
  {
    tipo: 'glb',
    ruta: 'assets/models/radar.glb',
    nombre: 'Radar',
    escala: new THREE.Vector3(3.2, 3.2, 3.2),
    posicion: new THREE.Vector3(8.49, -0.5, 2.83),
  },
];

/**
 * Devuelve las pistas de animacion de un modelo, sin importar si vienen
 * en `userData.animations` (como las guarda cargarModeloGLB) o en
 * `animations` (propiedad directa del objeto).
 */
function pistasDe(modelo) {
  if (!modelo) {
    return null;
  }

  const deUserData = modelo.userData ? modelo.userData.animations : null;
  if (Array.isArray(deUserData)) {
    return deUserData;
  }

  return Array.isArray(modelo.animations) ? modelo.animations : null;
}

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

  // Cubo hitbox del jugador: marca la altura de referencia (su techo queda
  // en y = 0.5, donde apoya el pato) y recibe el color que asigna el
  // servidor, para que uno se vea igual que como lo ven los demas.
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshPhongMaterial({ color: 0x00ff00 })
  );
  jugador.add(cube);

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

  /* ---------- Estado del jugador y de los avatares remotos ---------- */
  // Se declaran antes del bucle de render porque animate() los consulta
  // desde el primer fotograma, mientras aun estan cargando los modelos.
  let plantillaPato = null;
  let salto = null;
  const remotos = new Map();
  // Objetos decorativos animados (spring, escudo, radar): cada entrada es
  // { animacion } con su propio actualizar(delta).
  const decorativos = [];

  /* ---------- Carga del pato ---------- */
  const gestor = crearGestorCarga();
  const modelosCargados = await cargarModelos(MODELOS, gestor);

  // El pato se identifica por nombre (no por el orden de la lista) para
  // que los decorativos puedan agregarse o reordenarse sin romperlo.
  const buscarModelo = (nombre) => modelosCargados.find((modelo) => modelo.name === nombre);

  plantillaPato = buscarModelo('Duck');
  if (plantillaPato) {
    bob.add(plantillaPato);

    // Si el modelo trae animaciones (GLB/GLTF), las reproducimos todas.
    const pistas = pistasDe(plantillaPato);
    if (pistas && pistas.length) {
      const m = new THREE.AnimationMixer(plantillaPato);
      pistas.forEach((clip) => m.clipAction(clip).play());
      mixers.push(m);
    }
  }

  // Objetos decorativos: los modelos ya vienen con su posicion/escala de
  // MODELOS; aqui se agregan a la escena y se les engancha su animacion
  // procedural (los GLB no traen pistas).
  const DECORATIVOS = {
    Spring: (objeto) => crearRebote(objeto, { amplitud: 0.3, frecuencia: 4 }),
    Escudo: (objeto) => crearGiro(objeto, { velocidad: 1.2 }),
    Radar: (objeto) => crearBarrido(objeto, { velocidad: 4, amplitud: 0.06, frecuencia: 6 }),
  };

  Object.entries(DECORATIVOS).forEach(([nombre, crearAnimacion]) => {
    const objeto = buscarModelo(nombre);
    if (!objeto) {
      return;
    }
    scene.add(objeto);
    decorativos.push({ animacion: crearAnimacion(objeto) });
  });

  // Salto del jugador: el grupo vuela en parabola, el pato se deforma
  // (squash & stretch) y se avanza 1 unidad hacia donde mira.
  salto = crearSalto(jugador, plantillaPato);

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
  // Movimiento sobre la base de la pirámide (−4 a +4 en X y Z).
  const PASO = 1;
  const LIMITE_X = 4;
  const LIMITE_Z_MIN = -4;
  const LIMITE_Z_MAX = 4;

  // Rotacion: el grupo entero gira hacia la direccion de movimiento de
  // forma interpolada (suave). `rotObjetivo` es el angulo destino en
  // radianes; el offset corrige hacia donde "mira" el modelo por defecto.
  const DURACION_GIRO = 0.15;
  const OFFSET_ORIENTACION = 0;
  let rotObjetivo = 0;

  document.addEventListener('keydown', (event) => {
    if (!vistaJuego.classList.contains('activa')) return;

    let movido = false;
    let dirX = 0;
    let dirZ = 0;
    const tecla = event.key;

    // Salto: barra espaciadora. preventDefault evita que la pagina
    // haga scroll con la tecla. El salto avanza en la direccion actual
    // del jugador (hacia donde mira), asi que ademas de subir recorre
    // 1 unidad en X/Z.
    if (tecla === ' ') {
      event.preventDefault();
      // La orientacion del grupo es rotObjetivo = atan2(dirX, dirZ); el
      // vector "adelante" correspondiente es (sin(rotY), cos(rotY)).
      const rotY = jugador.rotation.y;
      const saltoIniciado = salto?.iniciarSalto(Math.sin(rotY), Math.cos(rotY));
      if (saltoIniciado && typeof alMoverJugador === 'function') {
        alMoverJugador(jugador.position, rotY);
      }
      return;
    }

    if (tecla === 'a' || tecla === 'ArrowLeft') { jugador.position.x -= PASO; dirX = -1; movido = true; }
    if (tecla === 'd' || tecla === 'ArrowRight') { jugador.position.x += PASO; dirX = 1; movido = true; }
    if (tecla === 'w' || tecla === 'ArrowUp')    { jugador.position.z -= PASO; dirZ = -1; movido = true; }
    if (tecla === 's' || tecla === 'ArrowDown')  { jugador.position.z += PASO; dirZ = 1; movido = true; }

    if (tecla.startsWith('Arrow')) event.preventDefault();
    if (!movido) return;

    jugador.position.x = Math.max(-LIMITE_X, Math.min(LIMITE_X, jugador.position.x));
    jugador.position.z = Math.max(LIMITE_Z_MIN, Math.min(LIMITE_Z_MAX, jugador.position.z));

    // El grupo mira hacia donde avanza (mas el offset del modelo).
    rotObjetivo = Math.atan2(dirX, dirZ) + OFFSET_ORIENTACION;

    // Se avisa la nueva posicion y el angulo destino para sincronizarlos.
    if (typeof alMoverJugador === 'function') {
      alMoverJugador(jugador.position, rotObjetivo);
    }
  });

  function animate() {
    const delta = reloj.getDelta();
    // Los mixers se actualizan siempre: así no acumulan tiempo durante la pausa.
    mixers.forEach((m) => m.update(delta));

    if (vistaJuego.classList.contains('activa')) {
      // Salto local: avanza la parabola (Y), la deformacion del pato y el
      // desplazamiento horizontal en la direccion del salto. Se recorta a
      // los limites del area para que el avance no saque al jugador del
      // recinto. Mientras dura se reenvia la posicion para que los demas
      // jugadores vean el salto completo.
      if (salto?.actualizar(delta)) {
        jugador.position.x = Math.max(-LIMITE_X, Math.min(LIMITE_X, jugador.position.x));
        jugador.position.z = Math.max(LIMITE_Z_MIN, Math.min(LIMITE_Z_MAX, jugador.position.z));
        if (typeof alMoverJugador === 'function') {
          alMoverJugador(jugador.position, jugador.rotation.y);
        }
      }

      // Giro interpolado hacia la direccion de movimiento. Se va por el
      // camino angular mas corto (normalizado a [-PI, PI]) para no dar la
      // vuelta larga al girar 180 grados. Mientras siga girando se reenvia
      // la rotacion (con la posicion) para que los demas vean el giro
      // completo, no solo el valor final y con un movimiento de retraso.
      const girando = girarHacia(jugador, rotObjetivo, delta);
      if (girando && typeof alMoverJugador === 'function') {
        alMoverJugador(jugador.position, jugador.rotation.y);
      }

      // Avatares remotos: sus saltos, mixers y giros avanzan con el mismo
      // reloj, asi la pausa congela todo por igual.
      remotos.forEach((entrada) => {
        entrada.salto.actualizar(delta);
        entrada.mezclador?.update(delta);
        girarHacia(entrada.avatar, entrada.rotObjetivo, delta);
      });

      // Decorativos (spring, escudo, radar): animacion procedural.
      decorativos.forEach((entrada) => entrada.animacion.actualizar(delta));

      renderer.render(scene, camera);
    }
  }

  /* ---------- Jugadores remotos (multijugador) ---------- */
  // El Map (declarado arriba) guarda { avatar, cubo, salto, mezclador, rotObjetivo }.

  // Interpola la rotacion de un objeto hacia un angulo destino en
  // DURACION_GIRO segundos, por el camino angular mas corto. Devuelve
  // true mientras siga girando (para reenviar la orientacion).
  function girarHacia(objeto, objetivo, delta) {
    const paso = Math.min(1, delta / DURACION_GIRO);
    let diferencia = objetivo - objeto.rotation.y;
    diferencia = Math.atan2(Math.sin(diferencia), Math.cos(diferencia));

    if (Math.abs(diferencia) < 1e-4) {
      objeto.rotation.y = objetivo;
      return false;
    }

    objeto.rotation.y += diferencia * paso;
    return true;
  }

  // Pinta el jugador local con el color que el servidor le asigno, para
  // que en su propia pantalla se vea igual que como lo ven los demas.
  // El color va solo al cubo; el pato conserva sus colores originales.
  function identificarJugador(jugador) {
    if (!jugador || !jugador.color) {
      return;
    }

    cube.material.color.set(jugador.color);
  }

  function agregarJugadorRemoto(remoto) {
    if (!remoto) {
      return;
    }

    // Si el avatar ya existe (porque llego antes un "jugador-movio" que
    // lo creo sin color), ahora que conocemos color/nombre se actualizan.
    const existente = remotos.get(remoto.id);
    if (existente) {
      if (remoto.color) {
        existente.cubo.material.color.set(remoto.color);
      }
      if (remoto.nombre) {
        existente.avatar.name = remoto.nombre;
      }
      return;
    }

    const color = remoto.color || '#ffffff';

    const avatar = new THREE.Group();
    avatar.name = remoto.nombre || remoto.id;

    const cubo = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshPhongMaterial({ color })
    );
    avatar.add(cubo);

    let pato = null;
    if (plantillaPato) {
      // El clon conserva los colores originales del pato; el color del
      // jugador va solo al cubo. Se apoya sobre el cubo (techo en y = 0.5).
      pato = plantillaPato.clone();
      pato.position.set(0, 0.5, 0);
      avatar.add(pato);
    }

    avatar.position.set(remoto.x || 0, remoto.y || 0, remoto.z || 0);
    scene.add(avatar);

    const entrada = {
      avatar,
      cubo,
      rotObjetivo: remoto.rotY || 0,
      salto: crearSalto(avatar, pato),
      mezclador: crearMezclador(pato, pistasDe(plantillaPato))
    };

    // Se arranca ya orientado (sin giro) para que no aparezca mirando
    // al frente y gire de golpe al llegar el primer paquete.
    avatar.rotation.y = entrada.rotObjetivo;

    // Si el jugador entro a mitad de un vuelo, se lanza su salto para
    // que no quede flotando sin animar.
    if (avatar.position.y > 0.05) {
      entrada.salto.iniciarSalto();
    }

    remotos.set(remoto.id, entrada);
  }

  function moverJugadorRemoto(remoto) {
    // Si llega un movimiento antes que su "jugador-entro" (carrera entre
    // eventos), se crea el avatar aqui mismo para no perder ese primer
    // paquete y que el otro jugador aparezca ya en su posicion real.
    if (!remotos.has(remoto.id)) {
      agregarJugadorRemoto(remoto);
    }

    const entrada = remotos.get(remoto.id);
    if (!entrada) {
      return;
    }

    const { avatar, salto } = entrada;

    // X y Z llegan del servidor. La Y del vuelo la calcula el salto
    // local (misma duracion y altura que el que salta), asi la
    // deformacion acompaña la trayectoria sin saltos por la frecuencia
    // de los paquetes. La orientacion llega en rotY y se interpola.
    avatar.position.x = remoto.x;
    avatar.position.z = remoto.z;
    if (typeof remoto.rotY === 'number') {
      entrada.rotObjetivo = remoto.rotY;
    }

    if (!salto.estaEnSalto()) {
      avatar.position.y = remoto.y;
      // Un salto ajeno se detecta porque la Y se separa del suelo.
      if (remoto.y > 0.05) {
        salto.iniciarSalto();
      }
    }
  }

  function quitarJugadorRemoto(id) {
    const entrada = remotos.get(id);
    if (entrada) {
      entrada.mezclador?.stopAllAction();
      scene.remove(entrada.avatar);
      remotos.delete(id);
    }
  }

  return {
    scene,
    jugador,
    identificarJugador,
    agregarJugadorRemoto,
    moverJugadorRemoto,
    quitarJugadorRemoto,
  };
}
