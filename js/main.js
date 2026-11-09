import { iniciarNavegacion } from './util/navegacion.js';
import { iniciarEscena } from './motor/escena.js';
import { iniciarFormulario } from './red/formulario.js';
import {
  iniciarPuntuaciones,
  cargarPuntuaciones,
  enviarPuntuacion
} from './red/puntuaciones.js';
import { iniciarPerfil, obtenerPerfil, nombreParaPuntaje } from './red/perfil.js';
import {
  iniciarMultijugador,
  conectarJugador,
  desconectarJugador,
  reingresarJugador,
  enviarPosicion,
  cambiarDificultad,
  enviarRecogida,
  enviarCima,
  enviarMina,
  enviarEmpuje
} from './red/multijugador.js';
import { cargarPreferencias, fijarDificultad } from './config/preferencias.js';
import { actualizarContadorMenu } from './motor/hud.js';

const VISTAS_DE_JUEGO = ['vista-juego', 'vista-pausa'];

let escena = null;
let modoActual = 'clasico';

document.addEventListener('DOMContentLoaded', async () => {
  iniciarPerfil();
  iniciarPuntuaciones();
  iniciarNavegacion({ alCambiarVista: manejarCambioVista });
  iniciarFormulario();

  escena = await iniciarEscena({
    alMoverJugador: enviarPosicion,
    dificultad: cargarPreferencias().dificultad,
    alRecogerPowerup: (x, z) => enviarRecogida(x, z),
    alLlegarCima: (movimientos) => enviarCima(movimientos),
    alPisarMina: (x, z) => enviarMina(x, z),
    alEmpujar: (id, dx, dz) => enviarEmpuje(id, dx, dz),
    alRegistrarPuntaje: registrarPuntajePartida
  });

  iniciarMultijugador({
    alEntrar: (jugador) => escena.agregarJugadorRemoto(jugador),
    alMover: (jugador) => escena.moverJugadorRemoto(jugador),
    alSalir: (id) => escena.quitarJugadorRemoto(id),
    alIdentificarse: (jugador) => escena.identificarJugador(jugador),
    alCambiarDificultad: (estado) => {
      fijarDificultad(estado.nivel, estado.bloqueada);
      escena.aplicarDificultad(estado.nivel);
    },
    alEstadoPartida: (estado) => escena.aplicarEstadoPartida(estado),
    alPowerupTomado: (datos) => escena.registrarPowerupTomado(datos),
    alVidas: (datos) => escena.aplicarVidas(datos),
    alNuevaRonda: (datos) => escena.aplicarNuevaRonda(datos),
    alJugadoresActivos: (datos) => {
      escena.aplicarJugadoresActivos(datos);
      actualizarContadorMenu(datos, 'clasico');
    },
    alEstadoArcade: (estado) => escena.aplicarEstadoArcade(estado),
    alFinArcade: (datos) => escena.aplicarFinArcade(datos),
    alJugadoresArcade: (datos) => actualizarContadorMenu(datos, 'arcade'),
    alEmpujeConfirmado: (datos) => escena.aplicarEmpujeConfirmado(datos),
    alEmpujado: (datos) => escena.aplicarEmpujado(datos),
    alTeletransporteArcade: (datos) => escena.aplicarTeletransporteArcade(datos)
  });

  engancharConexion();
  engancharDificultad();

  sincronizarJuego();
});

function manejarCambioVista(anterior, nueva, datos = {}) {
  const saliaDeJuego = VISTAS_DE_JUEGO.includes(anterior);
  const entraAJuego = VISTAS_DE_JUEGO.includes(nueva);

  if (entraAJuego && datos.modo) {
    modoActual = datos.modo === 'arcade' ? 'arcade' : 'clasico';
  }

  if (saliaDeJuego && !entraAJuego) {
    desconectarJugador();
  }

  if (!saliaDeJuego && entraAJuego) {
    entrarAlJuego(true);
  }
}

function entrarAlJuego(reiniciar = false) {
  if (!escena) {
    return;
  }

  escena.cambiarModo(modoActual, { reiniciar });

  const campo = document.getElementById('nombre-jugador');
  reingresarJugador(campo ? campo.value : '', modoActual);
}

async function registrarPuntajePartida(datos) {
  if (!datos || !['clasico', 'arcade'].includes(datos.modo)) {
    return;
  }

  const nombre = nombreParaPuntaje() || 'Pato anónimo';
  const perfil = obtenerPerfil();
  const envio = {
    nombre,
    modo: datos.modo,
    origen: perfil ? 'facebook' : 'manual'
  };

  if (perfil) {
    envio.jugadorId = perfil.id;
    envio.foto = perfil.foto;
  }

  if (datos.modo === 'arcade') {
    const tiempo = Number(datos.tiempoCima);
    if (!Number.isFinite(tiempo) || tiempo <= 0) {
      return;
    }
    envio.tiempoCima = tiempo;
  } else {
    const nivel = Number(datos.nivel);
    const movimientos = Number(datos.movimientos);
    if (!Number.isInteger(nivel) || !Number.isInteger(movimientos)) {
      return;
    }
    envio.nivel = nivel;
    envio.movimientos = movimientos;
  }

  try {
    await enviarPuntuacion(envio);
    await cargarPuntuaciones(datos.modo);
  } catch (error) {
    console.error('No se pudo guardar la puntuación de la partida:', error);
  }
}

function sincronizarJuego() {
  const enJuego = VISTAS_DE_JUEGO.some((id) => {
    const vista = document.getElementById(id);
    return vista && vista.classList.contains('activa');
  });

  if (enJuego) {
    entrarAlJuego(true);
  }
}

// Al cambiar el selector se pide el cambio al servidor; el valor real llega
// como estado compartido. Si no hay socket, se aplica solo en esta pantalla.
function engancharDificultad() {
  const campo = document.getElementById('cfg-dificultad');
  if (!campo) {
    return;
  }

  campo.addEventListener('change', () => {
    if (!cambiarDificultad(campo.value)) {
      escena.aplicarDificultad(campo.value);
    }
  });
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