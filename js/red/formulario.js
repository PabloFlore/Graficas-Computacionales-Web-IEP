import { enviarPuntuacion, cargarPuntuaciones } from './red/puntuaciones.js';

const formulario = document.getElementById('formulario');
const campoUsuario = document.getElementById('usuario');
const campoScore = document.getElementById('score');

/**
 * Envía el score al WebService PHP y refresca la tabla.
 */
async function manejarEnvio(evento) {
  evento.preventDefault();

  const nombre = campoUsuario.value.trim();
  const score = campoScore.value.trim();

  if (!nombre || !score) {
    return;
  }

  const boton = formulario.querySelector('button');
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Guardando...';

  try {
    await enviarPuntuacion(nombre, score);
    formulario.reset();
    await cargarPuntuaciones();
  } catch (error) {
    console.error('No se pudo guardar la puntuación:', error);
    window.alert(error.message || 'No se pudo guardar la puntuación.');
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

export function iniciarFormulario() {
  if (!formulario) {
    return;
  }

  formulario.addEventListener('submit', manejarEnvio);
}