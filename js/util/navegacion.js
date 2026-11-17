import { iniciarPreferencias } from '../config/preferencias.js';
import { cargarPuntuaciones } from '../red/puntuaciones.js';
import { sonidoClick } from '../motor/sonidos.js';

const OVERLAY_VISTAS = new Set(['vista-pausa', 'vista-configuraciones']);

export function mostrarVista(id) {
  if (OVERLAY_VISTAS.has(id)) {
    document.getElementById(id)?.classList.add('activa');
    return;
  }
  // Al navegar a cualquier vista normal, cerramos los overlays
  OVERLAY_VISTAS.forEach(ov => document.getElementById(ov)?.classList.remove('activa'));
  document.querySelectorAll('.vista:not(#vista-pausa)').forEach((vista) => {
    vista.classList.toggle('activa', vista.id === id);
  });

  // La tabla se rellena cada vez que se entra a Puntuaciones, para
  // reflejar los scores que se hayan guardado en esta sesión.
  if (id === 'vista-puntuaciones') {
    cargarPuntuaciones();
  }
}

export function iniciarNavegacion() {
  iniciarPreferencias();
  mostrarVista('vista-menu');

  document.addEventListener('click', (event) => {
    const boton = event.target.closest('[data-vista], button, .boton--multi-opcion');
    if (boton) sonidoClick();

    const navBoton = event.target.closest('[data-vista]');
    if (navBoton) {
      mostrarVista(navBoton.getAttribute('data-vista'));
    }

    if (event.target.closest('[data-cerrar-overlay]')) {
      OVERLAY_VISTAS.forEach(ov => document.getElementById(ov)?.classList.remove('activa'));
    }
  });

  // Escape abre/cierra la pausa mientras se está en el juego.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    const juego = document.getElementById('vista-juego');
    const pausa = document.getElementById('vista-pausa');

    if (pausa.classList.contains('activa')) {
      mostrarVista('vista-juego');
    } else if (juego.classList.contains('activa')) {
      mostrarVista('vista-pausa');
    }
  });
}