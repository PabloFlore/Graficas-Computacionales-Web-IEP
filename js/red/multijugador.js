/**
 * Cliente multijugador (Socket.IO).
 *
 * El servidor expone el cliente en /socket.io/socket.io.js, que define el
 * global `io`. Se carga en index.html antes que este modulo.
 */
const socket = typeof window.io === 'function' ? window.io() : null;

let nombreJugador = null;
let ultimoNombre = null;
let modoJugador = null;

if (socket) {
  socket.on('connect', () => {
    if (nombreJugador) {
      socket.emit('Iniciar', { nombre: nombreJugador, modo: modoJugador || 'clasico' });
    }
  });
}

/**
 * Engancha los eventos de multijugador. `alEntrar` recibe { id, nombre, color },
 * `alMover` recibe { id, x, y, z }, `alSalir` recibe el id del jugador y
 * `alIdentificarse` recibe la identidad propia { id, nombre, color }.
 */
export function iniciarMultijugador({
  alEntrar,
  alMover,
  alSalir,
  alIdentificarse,
  alCambiarDificultad,
  alEstadoPartida,
  alPowerupTomado,
  alVidas,
  alNuevaRonda,
  alJugadoresActivos,
  alEstadoArcade,
  alFinArcade,
  alJugadoresArcade,
  alEmpujeConfirmado,
  alEmpujado,
  alTeletransporteArcade
}) {
  if (!socket) {
    console.error('Socket.IO no esta disponible: falta el cliente en index.html.');
    return;
  }

  socket.on('jugadores', (lista) => {
    lista.forEach((jugador) => alEntrar(jugador));
  });

  socket.on('jugador-entro', (jugador) => alEntrar(jugador));
  socket.on('jugador-movio', (jugador) => alMover(jugador));
  socket.on('jugador-salio', (id) => alSalir(id));

  socket.on('tu-jugador', (jugador) => {
    if (typeof alIdentificarse === 'function') {
      alIdentificarse(jugador);
    }
  });

  // Estado { nivel, bloqueada }: llega al entrar, al salir alguien, al cambiarla
  // y cuando el servidor rechaza un cambio.
  socket.on('dificultad', (estado) => {
    if (typeof alCambiarDificultad === 'function') {
      alCambiarDificultad(estado);
    }
  });

  socket.on('estado-partida', (estado) => {
    if (typeof alEstadoPartida === 'function') {
      alEstadoPartida(estado);
    }
  });

  socket.on('powerup-tomado', (datos) => {
    if (typeof alPowerupTomado === 'function') {
      alPowerupTomado(datos);
    }
  });

  socket.on('vidas', (datos) => {
    if (typeof alVidas === 'function') {
      alVidas(datos);
    }
  });

  socket.on('nueva-ronda', (datos) => {
    if (typeof alNuevaRonda === 'function') {
      alNuevaRonda(datos);
    }
  });

  // { activos, conectados }: llega al conectar, al entrar o salir alguien,
  // cuando alguien pierde una vida y al reiniciar la ronda.
  socket.on('jugadores-activos', (datos) => {
    if (typeof alJugadoresActivos === 'function') {
      alJugadoresActivos(datos);
    }
  });

  socket.on('arcade-estado', (estado) => {
    if (typeof alEstadoArcade === 'function') {
      alEstadoArcade(estado);
    }
  });

  socket.on('arcade-fin', (datos) => {
    if (typeof alFinArcade === 'function') {
      alFinArcade(datos);
    }
  });

  socket.on('arcade-jugadores', (datos) => {
    if (typeof alJugadoresArcade === 'function') {
      alJugadoresArcade(datos);
    }
  });

  socket.on('empujado-ok', (datos) => {
    if (typeof alEmpujeConfirmado === 'function') {
      alEmpujeConfirmado(datos);
    }
  });

  socket.on('empujado', (datos) => {
    if (typeof alEmpujado === 'function') {
      alEmpujado(datos);
    }
  });

  socket.on('arcade-teletransporte', (datos) => {
    if (typeof alTeletransporteArcade === 'function') {
      alTeletransporteArcade(datos);
    }
  });

  socket.emit('PedirJugadores');
  socket.emit('PedirDificultad');
}

/**
 * Pide al servidor el powerup de la celda. Devuelve false si no hay conexion
 * (el llamador decide como resolverlo sin servidor).
 */
export function enviarRecogida(x, z) {
  if (!socket || nombreJugador === null) {
    return false;
  }

  socket.emit('Recoger', { x, z });
  return true;
}

/**
 * Avisa al servidor que este jugador llego a la cima con `movimientos`.
 */
export function enviarCima(movimientos) {
  if (!socket || nombreJugador === null) {
    return false;
  }

  socket.emit('Cima', { movimientos });
  return true;
}

/**
 * Avisa al servidor que el jugador local piso la mina de la celda. El servidor
 * valida la celda y descuenta la vida. Devuelve false sin conexion.
 */
export function enviarMina(x, z) {
  if (!socket || nombreJugador === null) {
    return false;
  }

  socket.emit('Mina', { x, z });
  return true;
}

/**
 * Pide al servidor cambiar la dificultad compartida. Solo se acepta si no hay
 * jugadores conectados; el resultado llega como evento "dificultad".
 * Devuelve false si no hay socket (el llamador decide que hacer).
 */
export function cambiarDificultad(nivel) {
  if (!socket) {
    return false;
  }

  socket.emit('Dificultad', nivel);
  return true;
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
export function conectarJugador(nombre, modo = 'clasico') {
  ultimoNombre = nombre;
  nombreJugador = nombre;
  modoJugador = modo;
  if (socket) {
    socket.emit('Iniciar', { nombre, modo });
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
  modoJugador = null;
  if (socket) {
    socket.emit('Salir');
  }
}

/**
 * Reingresa al jugador si no esta conectado, usando el nombre pasado o el
 * ultimo recordado. Se llama al entrar al juego para aparecer sin tener que
 * pulsar Conectar de nuevo.
 */
export function reingresarJugador(nombre, modo = 'clasico') {
  if (nombreJugador !== null) {
    if (modo === modoJugador) {
      return;
    }
    conectarJugador(nombreJugador, modo);
    return;
  }

  const elegido = (nombre && nombre.trim()) || ultimoNombre;
  if (!elegido) {
    return;
  }

  conectarJugador(elegido, modo);
}

/**
 * Envia la posicion y la orientacion (rotY) del jugador local al servidor.
 */
export function enviarPosicion(posicion, rotY = 0) {
  if (socket) {
    socket.emit('Posicion', { x: posicion.x, y: posicion.y, z: posicion.z, rotY });
  }
}

/**
 * Pide al servidor empujar al jugador `objetivoId` una celda en (dx, dz).
 * Devuelve false sin conexion; el servidor valida y confirma con
 * `empujado-ok` / `empujado`.
 */
export function enviarEmpuje(objetivoId, dx, dz) {
  if (!socket || nombreJugador === null) {
    return false;
  }

  socket.emit('Empujar', { objetivoId, dx, dz });
  return true;
}
