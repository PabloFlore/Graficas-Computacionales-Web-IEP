/**
 * Cliente multijugador (Socket.IO) — sistema de emparejamiento automático.
 *
 * El servidor expone el cliente en /socket.io/socket.io.js, que define el
 * global `io`. Se carga en index.html antes que este módulo.
 */
const socket = typeof window.io === 'function' ? window.io() : null;

/**
 * Registra los callbacks de partida.
 * - alEncontrarPartida({ sala, semilla, dificultad, oponente })
 * - alMover({ id, x, y, z, rotationY })
 * - alSalir(id)
 * - alRivalEliminado(id)
 */
export function iniciarMultijugador({ alEncontrarPartida, alMover, alSalir, alRivalEliminado } = {}) {
  if (!socket) {
    console.error('Socket.IO no está disponible: falta el cliente en index.html.');
    return;
  }

  socket.on('partida-encontrada', (data) => {
    if (typeof alEncontrarPartida === 'function') alEncontrarPartida(data);
  });
  socket.on('jugador-movio',    (j)  => { if (typeof alMover === 'function')           alMover(j); });
  socket.on('jugador-salio',    (id) => { if (typeof alSalir === 'function')            alSalir(id); });
  socket.on('rival-eliminado',  (id) => { if (typeof alRivalEliminado === 'function')   alRivalEliminado(id); });
}

/** Entra en la cola de emparejamiento. */
export function buscarPartida(nombre, colorCuerpo, colorOjo, dificultad) {
  if (socket) socket.emit('BuscarPartida', { nombre, colorCuerpo, colorOjo, dificultad });
}

/** Sale de la cola sin iniciar partida. */
export function cancelarBusqueda() {
  if (socket) socket.emit('CancelarBusqueda');
}

/** Avisa al servidor que este jugador fue eliminado (vidas = 0 en batalla). */
export function reportarEliminado() {
  if (socket) socket.emit('BatallaEliminado');
}

/** Envía la posición del jugador local. */
export function enviarPosicion(posicion) {
  if (socket) {
    socket.emit('Posicion', { x: posicion.x, y: posicion.y, z: posicion.z, rotationY: posicion.rotationY });
  }
}
