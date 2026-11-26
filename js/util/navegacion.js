import { iniciarPreferencias } from '../config/preferencias.js';
import { cargarPuntuaciones } from '../red/puntuaciones.js';
import { sonidoClick } from '../motor/sonidos.js';

const OVERLAY_VISTAS = new Set(['vista-pausa', 'vista-configuraciones']);

let alCambiarVista = null;
let vistaActual = null;

function notificarCambio(anterior, nueva, datos) {
  if (typeof alCambiarVista === 'function') {
    alCambiarVista(anterior, nueva, datos);
  }
}

export function mostrarVista(id, datos = {}) {
  const anterior = vistaActual;

  if (OVERLAY_VISTAS.has(id)) {
    document.getElementById(id)?.classList.add('activa');
    vistaActual = id;
    notificarCambio(anterior, id, datos);
    return;
  }

  OVERLAY_VISTAS.forEach((ov) => document.getElementById(ov)?.classList.remove('activa'));

  document.querySelectorAll('.vista:not(#vista-pausa)').forEach((vista) => {
    vista.classList.toggle('activa', vista.id === id);
  });

  vistaActual = id;

  if (id === 'vista-puntuaciones') {
    cargarPuntuaciones();
  }

  notificarCambio(anterior, id, datos);
}

export function iniciarNavegacion({ alCambiarVista: callback } = {}) {
  alCambiarVista = typeof callback === 'function' ? callback : null;
  iniciarPreferencias();
  mostrarVista('vista-menu');

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-vista], button, .boton--multi-opcion')) {
      sonidoClick();
    }

    const navBoton = event.target.closest('[data-vista]');
    if (navBoton) {
      mostrarVista(navBoton.getAttribute('data-vista'), {
        modo: navBoton.getAttribute('data-modo')
      });
    }

    if (event.target.closest('[data-cerrar-overlay]')) {
      OVERLAY_VISTAS.forEach((ov) => document.getElementById(ov)?.classList.remove('activa'));
      const vistaBase = document.querySelector(
        '.vista.activa:not(#vista-pausa):not(#vista-configuraciones)'
      );
      if (vistaBase) {
        vistaActual = vistaBase.id;
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    const juego = document.getElementById('vista-juego');
    const pausa = document.getElementById('vista-pausa');

    if (pausa?.classList.contains('activa')) {
      mostrarVista('vista-juego');
    } else if (juego?.classList.contains('activa')) {
      mostrarVista('vista-pausa');
    }
  });
}
