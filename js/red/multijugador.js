/**
 * Cliente multijugador (Socket.IO).
 *
 * El servidor expone el cliente en /socket.io/socket.io.js, que define el
 * global `io`. Se carga en index.html antes que este modulo.
 */
const socket = typeof window.io === 'function' ? window.io() : null;

/**
 * Engancha los eventos de multijugador. `alEntrar` recibe { id, nombre },
 * `alMover` recibe { id, x, y, z } y `alSalir` recibe el id del jugador.
 */
export function iniciarMultijugador({ alEntrar, alMover, alSalir }) {
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
}

/**
 * Registra al jugador en el servidor con su nombre.
 */
export function conectarJugador(nombre) {
  if (socket) {
    socket.emit('Iniciar', nombre);
  }
}

/**
 * Envia la posicion del jugador local al servidor.
 */
export function enviarPosicion(posicion) {
  if (socket) {
    socket.emit('Posicion', { x: posicion.x, y: posicion.y, z: posicion.z });
  }
}
