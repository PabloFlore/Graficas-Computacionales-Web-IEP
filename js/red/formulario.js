import {
  modoPuntuacionesActual,
  enviarPuntuacion,
  cargarPuntuaciones
} from './puntuaciones.js';
import { nombreParaPuntaje, recordarNombre, obtenerPerfil } from './perfil.js';

export function iniciarFormulario() {
  const formulario = document.getElementById('formulario');
  if (!formulario) {
    return;
  }

  const boton = document.getElementById('miBoton');
  const campoNombre = document.getElementById('nombre-puntuacion');
  const campoNivel = document.getElementById('nivel');
  const campoMovimientos = document.getElementById('movimientos');
  const campoTiempo = document.getElementById('tiempo-cima');
  const vistaPrevia = document.getElementById('puntos-preview');

  const actualizarVistaPrevia = () => {
    if (!vistaPrevia) {
      return;
    }

    if (modoPuntuacionesActual() === 'arcade') {
      const tiempo = parseFloat(campoTiempo ? campoTiempo.value : '');
      vistaPrevia.textContent = Number.isFinite(tiempo) && tiempo >= 0
        ? `${Math.round(tiempo * 100)} pts`
        : '—';
      return;
    }

    const nivel = parseInt(campoNivel ? campoNivel.value : '', 10);
    const movimientos = parseInt(campoMovimientos ? campoMovimientos.value : '', 10);

    if (!Number.isInteger(nivel) || !Number.isInteger(movimientos)) {
      vistaPrevia.textContent = '—';
      return;
    }

    vistaPrevia.textContent = `${Math.max(0, nivel * 100000 - movimientos)} pts`;
  };

  [campoNivel, campoMovimientos, campoTiempo].forEach((campo) => {
    if (campo) {
      campo.addEventListener('input', actualizarVistaPrevia);
    }
  });

  document.querySelectorAll('[data-modo-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      window.setTimeout(actualizarVistaPrevia, 0);
    });
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const modo = modoPuntuacionesActual();
    const nombre = nombreParaPuntaje(true);

    if (!nombre) {
      alert('Escribe tu nombre antes de guardar la puntuación.');
      if (campoNombre) {
        campoNombre.focus();
      }
      return;
    }

    const datos = { nombre, modo, origen: 'manual' };

    if (modo === 'arcade') {
      const tiempo = parseFloat(campoTiempo ? campoTiempo.value : '');

      if (!Number.isFinite(tiempo) || tiempo < 0) {
        alert('Escribe un tiempo en cima válido (segundos).');
        if (campoTiempo) {
          campoTiempo.focus();
        }
        return;
      }

      datos.tiempoCima = tiempo;
    } else {
      const nivel = parseInt(campoNivel ? campoNivel.value : '', 10);
      const movimientos = parseInt(campoMovimientos ? campoMovimientos.value : '', 10);

      if (!Number.isInteger(nivel) || nivel < 1 || nivel > 3) {
        alert('El nivel debe estar entre 1 y 3.');
        if (campoNivel) {
          campoNivel.focus();
        }
        return;
      }

      if (!Number.isInteger(movimientos) || movimientos < 0) {
        alert('Escribe un número de movimientos válido.');
        if (campoMovimientos) {
          campoMovimientos.focus();
        }
        return;
      }

      datos.nivel = nivel;
      datos.movimientos = movimientos;
    }

    const perfil = obtenerPerfil();
    if (perfil) {
      datos.jugadorId = perfil.id;
      datos.foto = perfil.foto;
      datos.origen = 'facebook';
    } else {
      recordarNombre(nombre);
    }

    if (boton) {
      boton.disabled = true;
    }

    try {
      const resultado = await enviarPuntuacion(datos);
      alert(`Puntuación guardada: ${resultado.puntos} pts`);
      formulario.reset();
      actualizarVistaPrevia();
      await cargarPuntuaciones(modo);
    } catch (error) {
      console.error('Error guardando puntuación:', error);
      alert(`No se pudo guardar la puntuación: ${error.message}`);
    } finally {
      if (boton) {
        boton.disabled = false;
      }
    }
  });

  actualizarVistaPrevia();
}
