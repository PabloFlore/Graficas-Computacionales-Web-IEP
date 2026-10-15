import { iniciarNavegacion } from './util/navegacion.js';
import { iniciarEscena } from './motor/escena.js';
import { iniciarFormulario } from './red/formulario.js';
import { iniciarMultijugador, conectarJugador, enviarPosicion } from './red/multijugador.js';

document.addEventListener('DOMContentLoaded', async () => {
  iniciarNavegacion();
  iniciarFormulario();

  const escena = await iniciarEscena({ alMoverJugador: enviarPosicion });

  iniciarMultijugador({
    alEntrar: (jugador) => escena.agregarJugadorRemoto(jugador),
    alMover: (jugador) => escena.moverJugadorRemoto(jugador),
    alSalir: (id) => escena.quitarJugadorRemoto(id)
  });

  engancharConexion();
});

function engancharConexion() {
  const boton = document.getElementById('boton-conectar');
  const campo = document.getElementById('nombre-jugador');

  if (!boton || !campo) {
    return;
  }

  boton.addEventListener('click', () => {
    const nombre = campo.value.trim();
    if (nombre) {
      conectarJugador(nombre);
    }
  });
}