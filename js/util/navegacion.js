import { iniciarPreferencias } from '../config/preferencias.js';
import { cargarPuntuaciones } from '../red/puntuaciones.js';

export function mostrarVista(id) {
  document.querySelectorAll('.vista').forEach((vista) => {
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