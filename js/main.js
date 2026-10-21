import { iniciarNavegacion } from './util/navegacion.js';
import { iniciarEscena } from './motor/escena.js';
import { iniciarFormulario } from './red/formulario.js';
import {
  iniciarMultijugador,
  conectarJugador,
  desconectarJugador,
  reingresarJugador,
  estaConectado,
  enviarPosicion
} from './red/multijugador.js';

// Vistas que cuentan como "dentro del juego".
const VISTAS_DE_JUEGO = ['vista-juego', 'vista-pausa'];

// La escena se arma de forma asincrona (carga modelos). Queda en null
// hasta que termina; el reingreso al juego espera a que exista.
let escena = null;

document.addEventListener('DOMContentLoaded', async () => {
  iniciarNavegacion({ alCambiarVista: manejarCambioVista });
  iniciarFormulario();

  escena = await iniciarEscena({ alMoverJugador: enviarPosicion });

  iniciarMultijugador({
    alEntrar: (jugador) => escena.agregarJugadorRemoto(jugador),
    alMover: (jugador) => escena.moverJugadorRemoto(jugador),
    alSalir: (id) => escena.quitarJugadorRemoto(id),
    alIdentificarse: (jugador) => escena.identificarJugador(jugador)
  });

  engancharConexion();

  // Si se entro al juego mientras la escena cargaba, recien ahora se puede
  // reingresar (la escena existe y los eventos estan enganchados).
  sincronizarJuego();
});

// Al salir de las vistas de juego (por ejemplo "Salir" desde la pausa) el
// jugador se saca del servidor, y al volver a entrar se reingresa solo.
function manejarCambioVista(anterior, nueva) {
  const saliaDeJuego = VISTAS_DE_JUEGO.includes(anterior);
  const entraAJuego = VISTAS_DE_JUEGO.includes(nueva);

  if (saliaDeJuego && !entraAJuego) {
    desconectarJugador();
  }

  if (!saliaDeJuego && entraAJuego) {
    entrarAlJuego();
  }
}

// Jugar implica estar en linea: si hay un nombre (el del campo o el ultimo
// recordado) se reingresa sin pulsar Conectar.
function entrarAlJuego() {
  if (!escena || estaConectado()) {
    return;
  }

  const campo = document.getElementById('nombre-jugador');
  reingresarJugador(campo ? campo.value : '');
}

function sincronizarJuego() {
  const enJuego = VISTAS_DE_JUEGO.some((id) => {
    const vista = document.getElementById(id);
    return vista && vista.classList.contains('activa');
  });

  if (enJuego) {
    entrarAlJuego();
  }
}

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