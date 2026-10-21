import { iniciarPreferencias } from '../config/preferencias.js';
import { cargarPuntuaciones } from '../red/puntuaciones.js';

// Callback opcional que se avisa en cada cambio de vista, con la vista
// anterior y la nueva. Lo usa main.js para sacar al jugador del juego.
let alCambiarVista = null;
let vistaActual = null;

export function mostrarVista(id) {
  const anterior = vistaActual;

  document.querySelectorAll('.vista').forEach((vista) => {
    vista.classList.toggle('activa', vista.id === id);
  });

  vistaActual = id;

  // La tabla se rellena cada vez que se entra a Puntuaciones, para
  // reflejar los scores que se hayan guardado en esta sesión.
  if (id === 'vista-puntuaciones') {
    cargarPuntuaciones();
  }

  if (typeof alCambiarVista === 'function') {
    alCambiarVista(anterior, id);
  }
}

export function iniciarNavegacion({ alCambiarVista: callback } = {}) {
  alCambiarVista = typeof callback === 'function' ? callback : null;
  iniciarPreferencias();
  mostrarVista('vista-menu');

  document.addEventListener('click', (event) => {
    const boton = event.target.closest('[data-vista]');
    if (boton) {
      mostrarVista(boton.getAttribute('data-vista'));
    }
  });

  // Escape abre/cierra la pausa mientras se está en el juego.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    const juego = document.getElementById('vista-juego');
    const pausa = document.getElementById('vista-pausa');

    if (juego.classList.contains('activa')) {
      mostrarVista('vista-pausa');
    } else if (pausa.classList.contains('activa')) {
      mostrarVista('vista-juego');
    }
  });
}