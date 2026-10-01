import * as THREE from 'three';

export function iniciarEscena() {
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
  scene.add(cube);

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
}