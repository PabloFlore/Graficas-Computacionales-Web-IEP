import * as THREE from 'three';
import { crearPato } from './pato.js';

export const PATOS_DISPONIBLES = {
  amarillo: { colorCuerpo: 0xffd45e, colorOjo: 0x1a1a2e, nombre: 'Clásico'  },
  blanco:   { colorCuerpo: 0xf2f0eb, colorOjo: 0x1a1a2e, nombre: 'Polar'    },
  negro:    { colorCuerpo: 0x2d2d42, colorOjo: 0xffffff, nombre: 'Oscuro'   },
  verde:    { colorCuerpo: 0x4ecca3, colorOjo: 0x1a1a2e, nombre: 'Jungla'   },
};

/* ---------- Síntesis de cuak ---------- */
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function cuak() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const osc    = ctx.createOscillator();
    const gain   = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 1.5;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    const t = ctx.currentTime;

    // Dos sílabas: "cua" + "k"
    osc.frequency.setValueAtTime(560, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.08);
    osc.frequency.setValueAtTime(490, t + 0.10);
    osc.frequency.exponentialRampToValueAtTime(190, t + 0.20);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.45, t + 0.015);
    gain.gain.setValueAtTime(0.45, t + 0.07);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.09);
    gain.gain.setValueAtTime(0.35, t + 0.11);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.21);

    osc.start(t);
    osc.stop(t + 0.22);
  } catch (_) {}
}

/* ---------- Inicializar selector ---------- */
export function iniciarSelectorPatos() {
  const cards = document.querySelectorAll('.pato-card');
  if (cards.length === 0) return { getPatolSeleccionado: () => PATOS_DISPONIBLES.amarillo };

  const instancias = [];

  cards.forEach((card, index) => {
    const id  = card.dataset.pato;
    const cfg = PATOS_DISPONIBLES[id];
    if (!cfg) return;

    const lienzo = card.querySelector('.pato-card__lienzo');
    if (!lienzo) return;

    const W = 170, H = 170;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    lienzo.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
    camera.position.set(1.6, 2.1, 2.6);
    camera.lookAt(0, 0.6, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sol = new THREE.DirectionalLight(0xffffff, 1.1);
    sol.position.set(3, 5, 3);
    scene.add(sol);

    const pato = crearPato(cfg.colorCuerpo, cfg.colorOjo);
    pato.scale.setScalar(1.15);
    scene.add(pato);

    instancias.push({ renderer, scene, camera, pato, phase: index * (Math.PI / 2) });

    // Sonido al pasar el mouse
    card.addEventListener('mouseenter', () => cuak());

    // Seleccionar al hacer clic
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('pato-card--activo'));
      card.classList.add('pato-card--activo');
    });
  });

  /* ---------- Loop compartido ---------- */
  function loop() {
    requestAnimationFrame(loop);
    const t = performance.now() / 1000;
    instancias.forEach((inst) => {
      inst.pato.position.y = 0.45 + Math.sin(t * 2.2 + inst.phase) * 0.11;
      inst.pato.rotation.y = t * 0.75;
      inst.renderer.render(inst.scene, inst.camera);
    });
  }
  loop();

  return {
    getPatolSeleccionado() {
      const activo = document.querySelector('.pato-card--activo');
      const id = activo?.dataset.pato || 'amarillo';
      return PATOS_DISPONIBLES[id] || PATOS_DISPONIBLES.amarillo;
    },
  };
}
