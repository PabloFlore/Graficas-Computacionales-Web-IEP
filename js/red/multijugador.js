/**
 * Cliente multijugador (Socket.IO).
 *
 * El servidor expone el cliente en /socket.io/socket.io.js, que define el
 * global `io`. Se carga en index.html antes que este modulo.
 */
const socket = typeof window.io === 'function' ? window.io() : null;

// Nombre con el que el jugador local se registro. Se guarda para poder
// reingresar solo cuando Socket.IO se reconecta tras un corte, y para
// saber si hay que avisar una salida. `ultimoNombre` se conserva aun
// despues de salir, para reingresar al volver a jugar.
let nombreJugador = null;
let ultimoNombre = null;

// Reconexion automatica: si el socket se cae y vuelve, se reingresa al
// jugador con el mismo nombre para que reaparezca en las demas pantallas.
if (socket) {
  socket.on('connect', () => {
    if (nombreJugador) {
      socket.emit('Iniciar', nombreJugador);
    }
  });
}

/**
 * Engancha los eventos de multijugador. `alEntrar` recibe { id, nombre, color },
 * `alMover` recibe { id, x, y, z }, `alSalir` recibe el id del jugador y
 * `alIdentificarse` recibe la identidad propia { id, nombre, color }.
 */
export function iniciarMultijugador({ alEntrar, alMover, alSalir, alIdentificarse }) {
  if (!socket) {
    console.error('Socket.IO no esta disponible: falta el cliente en index.html.');
    return;
  }

  // Lista inicial que manda el servidor cuando este jugador se registra.
  socket.on('jugadores', (lista) => {
    lista.forEach((jugador) => alEntrar(jugador));
  });

  socket.on('jugador-entro', (jugador) => alEntrar(jugador));
  socket.on('jugador-movio', (jugador) => alMover(jugador));
  socket.on('jugador-salio', (id) => alSalir(id));

  // Identidad propia (id + color) para pintar el jugador local igual
  // que los demas lo ven.
  socket.on('tu-jugador', (jugador) => {
    if (typeof alIdentificarse === 'function') {
      alIdentificarse(jugador);
    }
  });
}

/**
 * Indica si el jugador local esta registrado ahora mismo en el servidor.
 */
export function estaConectado() {
  return nombreJugador !== null;
}

/**
 * Registra al jugador en el servidor con su nombre.
 */
export function conectarJugador(nombre) {
  ultimoNombre = nombre;
  nombreJugador = nombre;
  if (socket) {
    socket.emit('Iniciar', nombre);
  }
}

/**
 * Saca al jugador del servidor (sin cerrar la pestaña). Asi desaparece en
 * las demas pantallas al salir del juego. El socket sigue vivo y el nombre
 * se recuerda para poder reingresar al volver a jugar.
 */
export function desconectarJugador() {
  if (!nombreJugador) {
    return;
  }

  nombreJugador = null;
  if (socket) {
    socket.emit('Salir');
  }
}

/**
 * Reingresa al jugador si no esta conectado, usando el nombre pasado o el
 * ultimo recordado. Se llama al entrar al juego para aparecer sin tener que
 * pulsar Conectar de nuevo.
 */
export function reingresarJugador(nombre) {
  if (nombreJugador !== null) {
    return;
  }

  const elegido = (nombre && nombre.trim()) || ultimoNombre;
  if (!elegido) {
    return;
  }

  conectarJugador(elegido);
}

/**
 * Envia la posicion y la orientacion (rotY) del jugador local al servidor.
 */
export function enviarPosicion(posicion, rotY = 0) {
  if (socket) {
    socket.emit('Posicion', { x: posicion.x, y: posicion.y, z: posicion.z, rotY });
  }
}
