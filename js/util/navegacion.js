import { iniciarPreferencias } from '../config/preferencias.js';
import { cargarPuntuaciones } from '../red/puntuaciones.js';

let alCambiarVista = null;
let vistaActual = null;

export function mostrarVista(id, datos = {}) {
  const anterior = vistaActual;

  document.querySelectorAll('.vista').forEach((vista) => {
    vista.classList.toggle('activa', vista.id === id);
  });

  vistaActual = id;

  if (id === 'vista-puntuaciones') {
    cargarPuntuaciones();
  }

  if (typeof alCambiarVista === 'function') {
    alCambiarVista(anterior, id, datos);
  }
}

export function iniciarNavegacion({ alCambiarVista: callback } = {}) {
  alCambiarVista = typeof callback === 'function' ? callback : null;
  iniciarPreferencias();
  mostrarVista('vista-menu');

  document.addEventListener('click', (event) => {
    const boton = event.target.closest('[data-vista]');
    if (boton) {
      mostrarVista(boton.getAttribute('data-vista'), {
        modo: boton.getAttribute('data-modo')
      });
    }
  });

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