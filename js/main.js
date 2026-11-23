import { iniciarNavegacion, mostrarVista } from './util/navegacion.js';
import { iniciarEscena } from './motor/escena.js';
import { iniciarFormulario } from './red/formulario.js';
import { iniciarMultijugador, conectarJugador, enviarPosicion, emitirEscenario } from './red/multijugador.js';
import { iniciarSelectorPatos } from './motor/selector-patos.js';
import { iniciarPatoMenu } from './motor/pato-menu.js';
import { cargarPuntuaciones, enviarPuntuacion } from './red/puntuaciones.js';
import { iniciarPreviewsEscenario } from './motor/previews-escenario.js';

let escenarioPendiente = 'piramide';
let modoPendiente = 'carrera';
let dificultadPendiente = 'normal';

document.addEventListener('DOMContentLoaded', async () => {
  iniciarNavegacion();
  iniciarFormulario();
  iniciarPatoMenu();
  cargarRankingMenu();
  iniciarPreviewsEscenario();

  const escena        = await iniciarEscena({
    alMoverJugador: enviarPosicion,
    alGanar: async ({ nombre, score }) => {
      try { await enviarPuntuacion(nombre, score); } catch {}
      cargarRankingMenu();
    },
  });
  const selectorPatos = iniciarSelectorPatos();

  iniciarMultijugador({
    alEntrar: (jugador) => escena.agregarJugadorRemoto(jugador),
    alMover:  (jugador) => escena.moverJugadorRemoto(jugador),
    alSalir:  (id)      => escena.quitarJugadorRemoto(id),
    alCambiarEscenario: ({ escenario }) => escena.reiniciar(escenario),
  });

  engancharConexion();
  engancharSeleccion(escena);
  engancharColores(escena, selectorPatos);
  engancharPausa(escena);
  engancharPanelesPausa();
});

async function cargarRankingMenu() {
  const lista = document.getElementById('ranking-menu-lista');
  if (!lista) return;
  try {
    const res = await fetch('/api/scores');
    const scores = await res.json();
    if (scores.length === 0) {
      lista.innerHTML = '<li class="ranking-menu__cargando">Sin puntuaciones aún</li>';
      return;
    }
    lista.innerHTML = scores
      .map((s, i) => `<li>
        <span class="ranking__pos">${String(i + 1).padStart(2, '0')}.</span>
        <span class="ranking__nombre">${s.nombre}</span>
        <span class="ranking__pts">${s.puntos}</span>
      </li>`)
      .join('');
  } catch {
    lista.innerHTML = '<li class="ranking-menu__cargando">No disponible</li>';
  }
}

function engancharConexion() {
  const boton = document.getElementById('boton-conectar');
  const campo = document.getElementById('nombre-jugador');
  if (!boton || !campo) return;

  boton.addEventListener('click', () => {
    const nombre = campo.value.trim();
    if (nombre) conectarJugador(nombre);
  });
}

function engancharSeleccion(escena) {
  document.addEventListener('click', (e) => {
    const tarjeta = e.target.closest('.tarjeta-escenario');
    if (tarjeta) {
      document.querySelectorAll('.tarjeta-escenario').forEach((t) =>
        t.classList.remove('tarjeta-escenario--activa')
      );
      tarjeta.classList.add('tarjeta-escenario--activa');
      escenarioPendiente = tarjeta.dataset.escenario || 'piramide';
    }

    const mundoCard = e.target.closest('.mundo-card');
    if (mundoCard) {
      document.querySelectorAll('.mundo-card').forEach((c) =>
        c.classList.remove('mundo-card--activo')
      );
      mundoCard.classList.add('mundo-card--activo');
    }

    const botonModo = e.target.closest('.boton--modo');
    if (botonModo) {
      const grupo = botonModo.closest('.modos');
      grupo?.querySelectorAll('.boton--modo').forEach((b) =>
        b.classList.remove('boton--modo-activo')
      );
      botonModo.classList.add('boton--modo-activo');
      modoPendiente = botonModo.dataset.modo || 'carrera';
    }

    const botonDif = e.target.closest('.boton--dificultad');
    if (botonDif) {
      document.querySelectorAll('.boton--dificultad').forEach((b) =>
        b.classList.remove('boton--dificultad--activo')
      );
      botonDif.classList.add('boton--dificultad--activo');
      dificultadPendiente = botonDif.dataset.dificultad || 'normal';
    }

    const nav = e.target.closest('[data-vista]');
    if (nav?.dataset.vista === 'vista-dificultad') {
      document.querySelectorAll('.boton--dificultad').forEach((b) =>
        b.classList.remove('boton--dificultad--activo')
      );
      dificultadPendiente = null;
    }
  });
}

function engancharColores(escena, selectorPatos) {
  document.addEventListener('click', (e) => {
    const botonConfirmar = e.target.closest('#boton-confirmar-color');
    if (!botonConfirmar) return;

    const campoNombre = document.getElementById('nombre-jugador');
    const nombre = campoNombre?.value.trim();
    if (!nombre) {
      campoNombre.classList.add('campo--error');
      campoNombre.focus();
      campoNombre.addEventListener('input', () => campoNombre.classList.remove('campo--error'), { once: true });
      return;
    }

    const cfg = selectorPatos.getPatolSeleccionado();
    escena.reiniciar(escenarioPendiente, cfg.colorCuerpo, cfg.colorOjo, dificultadPendiente ?? 'normal');
    emitirEscenario(escenarioPendiente, modoPendiente);
    mostrarVista('vista-juego');
  });
}

function engancharPanelesPausa() {
  document.getElementById('pausa-btn-config')?.addEventListener('click', () => {
    document.querySelector('.pausa-panel--menu').hidden = true;
    document.querySelector('.pausa-panel--config').hidden = false;
  });
  document.getElementById('pausa-btn-volver')?.addEventListener('click', () => {
    document.querySelector('.pausa-panel--config').hidden = true;
    document.querySelector('.pausa-panel--menu').hidden = false;
  });
}

function engancharPausa(escena) {
  document.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-vista]');
    if (!boton) return;
    const destino = boton.getAttribute('data-vista');
    if (destino === 'vista-pausa') escena.pausarCronometro();
    if (destino === 'vista-juego') escena.reanudarCronometro();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const juego = document.getElementById('vista-juego');
    const pausa = document.getElementById('vista-pausa');
    if (juego.classList.contains('activa')) escena.pausarCronometro();
    if (pausa.classList.contains('activa')) escena.reanudarCronometro();
  });
}
