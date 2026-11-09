const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

const PUERTO = process.env.PORT || 4000;

app.use('/api', (req, res) => {
  res.status(404).send(
    'El WebService PHP se ejecuta en Apache (puerto 80), no en Express. ' +
      'Configura el alias /api siguiendo api/apache-alias.conf.'
  );
});

app.use(express.static(join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

const jugadores = new Map();
const jugadoresArcade = new Map();

const NIVELES_DIFICULTAD = ['facil', 'normal', 'dificil'];
let dificultad = 'normal';

// La dificultad solo se puede cambiar cuando no hay jugadores conectados.
function estadoDificultad() {
  return { nivel: dificultad, bloqueada: jugadores.size > 0 };
}

// Jugadores que siguen en juego (no han perdido todas sus vidas).
function jugadoresActivos() {
  return [...jugadores.values()].filter((jugador) => jugador.vidas > 0);
}

function estadoJugadores() {
  return {
    activos: jugadoresActivos().length,
    conectados: jugadores.size
  };
}

function emitirJugadoresActivos() {
  io.emit('jugadores-activos', estadoJugadores());
}

const PALETA = ['#39ff14', '#00a2ff', '#ff4dd2', '#ffb000', '#9d4dff', '#00e0c6', '#ff3b30', '#f5f5f5'];
const SPAWN = { x: 0, y: 1, z: 4 };
const SPAWNS = [
  { x: 0, z: 4 },
  { x: 4, z: 0 },
  { x: 0, z: -4 },
  { x: -4, z: 0 },
  { x: 2, z: 4 },
  { x: -2, z: 4 },
  { x: 4, z: 2 },
  { x: 4, z: -2 }
];

/*
 * Copia de la logica de js/motor/piramide.js (minas y powerups). Cliente y
 * servidor deben calcular lo mismo: si cambia una formula, cambiar las dos.
 */
const RADIO = 4;
const RADIO_ARCADE = 7;
const TOTAL_NIVELES = 3;
const MODOS = { clasico: 'clasico', arcade: 'arcade' };
const RADIO_POR_MODO = { [MODOS.clasico]: RADIO, [MODOS.arcade]: RADIO_ARCADE };
const SPAWNS_ARCADE = [
  { x: 0, z: RADIO_ARCADE },
  { x: RADIO_ARCADE, z: 0 },
  { x: 0, z: -RADIO_ARCADE },
  { x: -RADIO_ARCADE, z: 0 },
  { x: 3, z: RADIO_ARCADE },
  { x: -3, z: RADIO_ARCADE },
  { x: RADIO_ARCADE, z: 3 },
  { x: RADIO_ARCADE, z: -3 }
];
const SPAWNS_POR_MODO = { [MODOS.clasico]: SPAWNS, [MODOS.arcade]: SPAWNS_ARCADE };
const DIFICULTADES = { facil: 0.17, normal: 0.26, dificil: 0.33 };
const TIPOS_POWERUP = ['resorte', 'escudo', 'radar'];
const OBJETIVO_POWERUPS = 12;
const DISTANCIA_MINIMA_POWERUP = 2;
const HASH_POWERUP_ORDEN = 301;
const HASH_POWERUP_ROTACION = 401;
const VIDAS_INICIALES = 3;
const ENFRIAMIENTO_MINA = 600;
const DEMORA_REINICIO_TODOS = 3000;
const DURACION_ARCADE = Number(process.env.ARCADE_DURACION) > 0
  ? Number(process.env.ARCADE_DURACION)
  : 90;
const CUENTA_ARCADE = 3;
const REINICIO_ARCADE = 5;
const TICK_ARCADE = 250;
const UMBRAL_EMPUJE = 0.5;

function isqrt(valor) {
  let raiz = 0;
  while ((raiz + 1) * (raiz + 1) <= valor) {
    raiz += 1;
  }
  return raiz;
}

/*
 * Copia de alturaEn en js/motor/piramide.js. Nivel 1: piramide clasica;
 * nivel 2: monticulo circular; nivel 3: estrella con pico central.
 */
function alturaEn(ix, iz, nivelJuego = 1, modo = MODOS.clasico) {
  const x = Math.abs(ix);
  const z = Math.abs(iz);

  if (modo === MODOS.arcade) {
    return Math.min(7, 8 - Math.max(x, z));
  }

  if (nivelJuego === 2) {
    return Math.max(1, 6 - isqrt(ix * ix + iz * iz));
  }

  if (nivelJuego === 3) {
    return Math.max(1, 6 - (x + z), 5 - Math.abs(x - z));
  }

  return RADIO + 1 - Math.max(x, z);
}

function esSpawn(ix, iz, modo = MODOS.clasico) {
  return SPAWNS_POR_MODO[modo].some((spawn) => spawn.x === ix && spawn.z === iz);
}

function radioDe(modo = MODOS.clasico) {
  return RADIO_POR_MODO[modo] || RADIO;
}

function esCimaArcade(ix, iz) {
  return Math.abs(ix) <= 1 && Math.abs(iz) <= 1;
}

function jugadorArcadeEnCelda(ix, iz, exceptoId = null) {
  for (const jugador of jugadoresArcade.values()) {
    if (jugador.id === exceptoId) {
      continue;
    }
    if (Math.round(jugador.x) === ix && Math.round(jugador.z) === iz) {
      return jugador;
    }
  }
  return null;
}

function resolverEmpujeArcade(empujador, objetivo, dx, dz) {
  if (!empujador || !objetivo || arcade.estado !== 'jugando') {
    return null;
  }

  if (Math.abs(dx) + Math.abs(dz) !== 1) {
    return null;
  }

  const px = Math.round(empujador.x);
  const pz = Math.round(empujador.z);
  const ox = Math.round(objetivo.x);
  const oz = Math.round(objetivo.z);

  if (ox - px !== dx || oz - pz !== dz) {
    return null;
  }

  const alineacion = Math.sin(objetivo.rotY) * dx + Math.cos(objetivo.rotY) * dz;
  if (alineacion < UMBRAL_EMPUJE) {
    return null;
  }

  const alturaEmpujador = alturaEn(px, pz, 1, MODOS.arcade);
  const alturaObjetivo = alturaEn(ox, oz, 1, MODOS.arcade);

  if (Math.abs(empujador.y - alturaEmpujador) > 0.1
    || Math.abs(objetivo.y - alturaObjetivo) > 0.1) {
    return null;
  }

  if (alturaObjetivo > alturaEmpujador + 1) {
    return null;
  }

  const nx = ox + dx;
  const nz = oz + dz;
  const radio = radioDe(MODOS.arcade);

  if (Math.abs(nx) > radio || Math.abs(nz) > radio) {
    return null;
  }

  if (jugadorArcadeEnCelda(nx, nz, objetivo.id)) {
    return null;
  }

  const alturaNueva = alturaEn(nx, nz, 1, MODOS.arcade);
  if (alturaNueva > alturaObjetivo + 1) {
    return null;
  }

  return { ox, oz, nx, nz, alturaObjetivo, alturaNueva };
}

function nuevaSemilla() {
  return Math.floor(Math.random() * 0x7fffffff);
}

/*
 * Copia exacta de hash01 en js/motor/piramide.js. Cliente y servidor deben
 * calcular el mismo tablero con la misma semilla.
 */
function hash01(ix, iz, capa, semilla) {
  let h = Math.imul(ix | 0, 374761393);
  h = (h + Math.imul(iz | 0, 668265263)) | 0;
  h = (h + Math.imul(capa | 0, 2147483647)) | 0;
  h = (h + Math.imul(semilla | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function esMina(ix, iz, probabilidad, semilla, nivelJuego = 1, modo = MODOS.clasico) {
  if (modo === MODOS.arcade) {
    return false;
  }

  if ((ix === 0 && iz === 0) || esSpawn(ix, iz, modo)) {
    return false;
  }
  const capa = alturaEn(ix, iz, nivelJuego, modo) - 1;
  return hash01(ix, iz, capa, semilla) < probabilidad;
}

function celdasElegiblesPowerup(semilla, nivelJuego, modo = MODOS.clasico) {
  const celdas = [];
  const radio = radioDe(modo);

  if (modo === MODOS.arcade) {
    return celdas;
  }

  for (let ix = -radio; ix <= radio; ix += 1) {
    for (let iz = -radio; iz <= radio; iz += 1) {
      if (ix === 0 && iz === 0) {
        continue;
      }
      if (esSpawn(ix, iz, modo) || esMina(ix, iz, DIFICULTADES.dificil, semilla, nivelJuego, modo)) {
        continue;
      }
      celdas.push({ ix, iz, orden: hash01(ix, iz, HASH_POWERUP_ORDEN, semilla) });
    }
  }
  celdas.sort((a, b) => a.orden - b.orden || a.ix - b.ix || a.iz - b.iz);
  return celdas;
}

function seleccionarPowerups(semilla, nivelJuego = 1, modo = MODOS.clasico) {
  const elegibles = celdasElegiblesPowerup(semilla, nivelJuego, modo);
  const objetivo = Math.min(OBJETIVO_POWERUPS, elegibles.length);
  const elegidas = [];

  for (const celda of elegibles) {
    if (elegidas.length >= objetivo) {
      break;
    }
    const separada = elegidas.every((otra) =>
      Math.max(Math.abs(celda.ix - otra.ix), Math.abs(celda.iz - otra.iz)) >= DISTANCIA_MINIMA_POWERUP
    );
    if (separada) {
      elegidas.push(celda);
    }
  }

  if (elegidas.length < objetivo) {
    for (const celda of elegibles) {
      if (elegidas.length >= objetivo) {
        break;
      }
      if (!elegidas.some((otra) => otra.ix === celda.ix && otra.iz === celda.iz)) {
        elegidas.push(celda);
      }
    }
  }

  const rotacion = Math.floor(hash01(0, 0, HASH_POWERUP_ROTACION, semilla) * TIPOS_POWERUP.length);
  const mapa = new Map();
  elegidas.forEach((celda, indice) => {
    mapa.set(`${celda.ix},${celda.iz}`, TIPOS_POWERUP[(indice + rotacion) % TIPOS_POWERUP.length]);
  });
  return mapa;
}

function powerupEn(ix, iz, semilla, nivelJuego = 1, modo = MODOS.clasico) {
  return seleccionarPowerups(semilla, nivelJuego, modo).get(`${ix},${iz}`) || null;
}

function listaPowerups(semilla, nivelJuego = 1, modo = MODOS.clasico) {
  const mapa = seleccionarPowerups(semilla, nivelJuego, modo);
  return [...mapa].map(([clave, tipo]) => {
    const [x, z] = clave.split(',').map(Number);
    return { x, z, tipo };
  });
}

// Estado de la partida compartida. Se reinicia cuando no queda nadie conectado.
const partida = {
  ronda: 1,
  nivel: 1,
  semilla: nuevaSemilla(),
  ganador: null,
  movimientos: 0,
  tomados: new Map(),
  ultimoGolpe: new Map()
};

let reinicioPendiente = null;

function reiniciarPartida() {
  cancelarReinicioPendiente();
  partida.ronda = 1;
  partida.nivel = 1;
  partida.semilla = nuevaSemilla();
  partida.ganador = null;
  partida.movimientos = 0;
  partida.tomados.clear();
  partida.ultimoGolpe.clear();
  console.log('Partida reiniciada (sin jugadores).');
}

function todosEliminados() {
  return jugadores.size > 0 && jugadoresActivos().length === 0;
}

function cancelarReinicioPendiente() {
  if (reinicioPendiente) {
    clearTimeout(reinicioPendiente);
    reinicioPendiente = null;
  }
}

// Ronda nueva para todos: vidas, powerups y posiciones. La usa el avance de
// nivel, el reinicio al ganar la partida y el reinicio por eliminacion.
function iniciarNuevaRonda({
  ganador = null,
  movimientos = 0,
  motivo = 'cima',
  nivel = partida.nivel
} = {}) {
  cancelarReinicioPendiente();

  partida.ganador = ganador;
  partida.movimientos = 0;
  partida.ronda += 1;
  partida.nivel = nivel;
  partida.semilla = nuevaSemilla();
  partida.tomados.clear();
  partida.ultimoGolpe.clear();

  const spawns = repartirSpawns();
  const jugadoresRonda = [];
  jugadores.forEach((otro, id) => {
    const spawn = spawns.get(id);
    otro.x = spawn.x;
    otro.y = alturaEn(spawn.x, spawn.z, partida.nivel);
    otro.z = spawn.z;
    otro.rotY = 0;
    otro.vidas = VIDAS_INICIALES;
    jugadoresRonda.push({ id, x: otro.x, y: otro.y, z: otro.z, rotY: 0, vidas: otro.vidas });
  });

  io.to(MODOS.clasico).emit('nueva-ronda', {
    ronda: partida.ronda,
    nivel: partida.nivel,
    semilla: partida.semilla,
    ganador: partida.ganador,
    movimientos,
    motivo,
    jugadores: jugadoresRonda
  });

  emitirJugadoresActivos();

  if (ganador) {
    console.log(
      `Nivel ${partida.nivel} alcanzado por ${ganador.nombre} en ${movimientos} movimientos (${motivo}).`
    );
  } else {
    console.log(`Ronda reiniciada en nivel ${partida.nivel}:`, motivo);
  }
}

// Alguien llego a la cima: avanza de nivel o, si era el ultimo, reinicia la
// partida completa en el nivel 1.
function avanzarNivel({ ganador, movimientos }) {
  if (partida.nivel < TOTAL_NIVELES) {
    iniciarNuevaRonda({
      ganador,
      movimientos,
      motivo: 'nivel',
      nivel: partida.nivel + 1
    });
    return;
  }

  iniciarNuevaRonda({
    ganador,
    movimientos,
    motivo: 'partida',
    nivel: 1
  });
}

function programarReinicioSiTodosEliminados() {
  if (reinicioPendiente || !todosEliminados()) {
    return;
  }

  reinicioPendiente = setTimeout(() => {
    reinicioPendiente = null;
    if (!todosEliminados()) {
      return;
    }
    iniciarNuevaRonda({ motivo: 'todos-eliminados', nivel: 1 });
  }, DEMORA_REINICIO_TODOS);

  console.log(`Todos eliminados: ronda nueva en ${DEMORA_REINICIO_TODOS / 1000} s.`);
}

function estadoPartida() {
  return {
    ...estadoJugadores(),
    ronda: partida.ronda,
    nivel: partida.nivel,
    semilla: partida.semilla,
    ganador: partida.ganador,
    movimientos: partida.movimientos,
    tomados: [...partida.tomados].map(([clave, datos]) => {
      const [x, z] = clave.split(',').map(Number);
      return { x, z, id: datos.id, tipo: datos.tipo };
    }),
    vidas: [...jugadores.values()].map((jugador) => ({ id: jugador.id, vidas: jugador.vidas })),
    powerups: listaPowerups(partida.semilla, partida.nivel)
  };
}

/* ---------- Estado arcade ---------- */

const arcade = {
  estado: 'espera',
  ronda: 0,
  inicio: 0,
  fin: 0,
  restante: DURACION_ARCADE,
  transcurrido: 0,
  ultimoTick: 0,
  ranking: []
};

let intervaloArcade = null;

function redondearTiempo(valor) {
  return Math.round(valor * 10) / 10;
}

function estadoJugadoresArcade() {
  return { activos: jugadoresArcade.size, conectados: jugadoresArcade.size };
}

function emitirJugadoresArcade() {
  io.emit('arcade-jugadores', estadoJugadoresArcade());
}

function listaJugadoresArcade() {
  return [...jugadoresArcade.values()].map((jugador) => ({
    id: jugador.id,
    nombre: jugador.nombre,
    color: jugador.color,
    x: jugador.x,
    y: jugador.y,
    z: jugador.z,
    rotY: jugador.rotY,
    tiempoCima: redondearTiempo(jugador.tiempoCima),
    enCima: jugador.enCima
  }));
}

function rankingArcade() {
  return [...jugadoresArcade.values()]
    .map((jugador) => ({
      id: jugador.id,
      nombre: jugador.nombre,
      tiempoCima: redondearTiempo(jugador.tiempoCima)
    }))
    .sort((a, b) => b.tiempoCima - a.tiempoCima || a.nombre.localeCompare(b.nombre));
}

function estadoArcadePayload() {
  const ahora = Date.now();
  let restante = arcade.restante;
  let transcurrido = arcade.transcurrido;
  let cuentaRestante = 0;

  if (arcade.estado === 'cuenta') {
    cuentaRestante = Math.max(0, (arcade.inicio - ahora) / 1000);
  } else if (arcade.estado === 'jugando') {
    transcurrido = Math.min(DURACION_ARCADE, Math.max(0, (ahora - arcade.inicio) / 1000));
    restante = Math.max(0, DURACION_ARCADE - transcurrido);
  }

  return {
    estado: arcade.estado,
    ronda: arcade.ronda,
    restante: redondearTiempo(restante),
    transcurrido: redondearTiempo(transcurrido),
    duracion: DURACION_ARCADE,
    cuentaRestante: redondearTiempo(cuentaRestante),
    jugadores: listaJugadoresArcade(),
    ranking: rankingArcade()
  };
}

function emitirEstadoArcade() {
  io.to(MODOS.arcade).emit('arcade-estado', estadoArcadePayload());
}

function detenerTickArcade() {
  if (intervaloArcade) {
    clearInterval(intervaloArcade);
    intervaloArcade = null;
  }
}

function iniciarTickArcade() {
  if (!intervaloArcade) {
    intervaloArcade = setInterval(tickArcade, TICK_ARCADE);
  }
}

function acumularTiempoArcade(delta) {
  jugadoresArcade.forEach((jugador) => {
    jugador.enCima = esCimaArcade(Math.round(jugador.x), Math.round(jugador.z));
    if (jugador.enCima) {
      jugador.tiempoCima = Math.min(DURACION_ARCADE, jugador.tiempoCima + delta);
    }
  });
}

function prepararJugadoresArcade() {
  [...jugadoresArcade.values()].forEach((jugador, indice) => {
    const spawn = SPAWNS_ARCADE[indice % SPAWNS_ARCADE.length];
    jugador.x = spawn.x;
    jugador.z = spawn.z;
    jugador.y = alturaEn(spawn.x, spawn.z, 1, MODOS.arcade);
    jugador.rotY = 0;
    jugador.tiempoCima = 0;
    jugador.enCima = false;
    jugador.cimaPisada = false;
  });
}

function iniciarCuentaArcade() {
  arcade.estado = 'cuenta';
  arcade.ronda += 1;
  arcade.inicio = Date.now() + CUENTA_ARCADE * 1000;
  arcade.fin = 0;
  arcade.restante = DURACION_ARCADE;
  arcade.transcurrido = 0;
  arcade.ultimoTick = 0;
  arcade.ranking = [];
  emitirEstadoArcade();
}

function reiniciarRondaArcade() {
  if (jugadoresArcade.size === 0) {
    reiniciarArcadeVacio();
    return;
  }

  prepararJugadoresArcade();
  iniciarCuentaArcade();
  console.log('Ronda arcade reiniciada.');
}

function reiniciarArcadeVacio() {
  detenerTickArcade();
  jugadoresArcade.clear();
  arcade.estado = 'espera';
  arcade.ronda = 0;
  arcade.inicio = 0;
  arcade.fin = 0;
  arcade.restante = DURACION_ARCADE;
  arcade.transcurrido = 0;
  arcade.ultimoTick = 0;
  arcade.ranking = [];
  emitirEstadoArcade();
  emitirJugadoresArcade();
}

function finalizarArcade() {
  arcade.estado = 'fin';
  arcade.fin = Date.now() + REINICIO_ARCADE * 1000;
  arcade.restante = 0;
  arcade.transcurrido = DURACION_ARCADE;

  const ranking = rankingArcade();
  const maximo = ranking.length > 0 ? ranking[0].tiempoCima : 0;
  const empatados = ranking.filter((entrada) => Math.abs(entrada.tiempoCima - maximo) <= 0.05);
  const empate = empatados.length > 1;
  const ganador = ranking.length > 0
    ? { id: ranking[0].id, nombre: ranking[0].nombre, tiempoCima: ranking[0].tiempoCima }
    : null;

  arcade.ranking = ranking;
  io.to(MODOS.arcade).emit('arcade-fin', { ganador, empate, ranking });
  emitirEstadoArcade();
  console.log('Fin arcade.', ganador ? `Ganador: ${ganador.nombre} (${ganador.tiempoCima} s)` : 'Sin jugadores');
}

function tickArcade() {
  const ahora = Date.now();

  if (jugadoresArcade.size === 0) {
    reiniciarArcadeVacio();
    return;
  }

  if (arcade.estado === 'cuenta') {
    if (ahora >= arcade.inicio) {
      arcade.estado = 'jugando';
      arcade.inicio = ahora;
      arcade.ultimoTick = ahora;
      arcade.transcurrido = 0;
      arcade.restante = DURACION_ARCADE;
    } else {
      emitirEstadoArcade();
      return;
    }
  }

  if (arcade.estado === 'jugando') {
    const delta = Math.max(0, (ahora - arcade.ultimoTick) / 1000);
    arcade.ultimoTick = ahora;
    acumularTiempoArcade(delta);

    arcade.transcurrido = Math.min(DURACION_ARCADE, Math.max(0, (ahora - arcade.inicio) / 1000));
    arcade.restante = Math.max(0, DURACION_ARCADE - arcade.transcurrido);

    if (arcade.restante <= 0) {
      finalizarArcade();
      return;
    }

    emitirEstadoArcade();
    return;
  }

  if (arcade.estado === 'fin' && ahora >= arcade.fin) {
    reiniciarRondaArcade();
  }
}

function elegirSpawnArcade() {
  const ocupadas = new Set(
    [...jugadoresArcade.values()].map((jugador) => `${Math.round(jugador.x)},${Math.round(jugador.z)}`)
  );
  return SPAWNS_ARCADE.find((spawn) => !ocupadas.has(`${spawn.x},${spawn.z}`)) || SPAWNS_ARCADE[0];
}

function elegirSpawn() {
  const ocupadas = new Set(
    [...jugadores.values()].map((jugador) => `${Math.round(jugador.x)},${Math.round(jugador.z)}`)
  );
  return SPAWNS.find((spawn) => !ocupadas.has(`${spawn.x},${spawn.z}`)) || SPAWN;
}

function teletransportarJugadorArcade(jugador) {
  const spawn = elegirSpawnArcade();
  jugador.x = spawn.x;
  jugador.z = spawn.z;
  jugador.y = alturaEn(spawn.x, spawn.z, 1, MODOS.arcade);
  jugador.enCima = false;
  jugador.cimaPisada = false;

  return {
    id: jugador.id,
    x: jugador.x,
    y: jugador.y,
    z: jugador.z,
    rotY: jugador.rotY
  };
}

// Reparte los spawns del borde entre todos los jugadores. Se usa al empezar
// una ronda nueva, para que nadie quede sobre otro.
function repartirSpawns() {
  const posiciones = new Map();
  [...jugadores.keys()].forEach((id, indice) => {
    posiciones.set(id, SPAWNS[indice % SPAWNS.length]);
  });
  return posiciones;
}

function elegirColor(id, coleccion = jugadores) {
  const enUso = new Set([...coleccion.values()].map((jugador) => jugador.color));
  const libre = PALETA.find((color) => !enUso.has(color));
  if (libre) {
    return libre;
  }

  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 80%, 55%)`;
}

function quitarJugador(socket) {
  const jugador = jugadores.get(socket.id);
  if (!jugador) {
    return;
  }

  jugadores.delete(socket.id);
  partida.ultimoGolpe.delete(socket.id);
  socket.to(MODOS.clasico).emit('jugador-salio', socket.id);
  io.emit('dificultad', estadoDificultad());
  emitirJugadoresActivos();
  socket.leave(MODOS.clasico);
  console.log('Jugador salio:', jugador.nombre, socket.id);

  if (jugadores.size === 0) {
    reiniciarPartida();
    return;
  }

  programarReinicioSiTodosEliminados();
}

function quitarJugadorArcade(socket) {
  const jugador = jugadoresArcade.get(socket.id);
  if (!jugador) {
    socket.leave(MODOS.arcade);
    return;
  }

  jugadoresArcade.delete(socket.id);
  socket.to(MODOS.arcade).emit('jugador-salio', socket.id);
  socket.leave(MODOS.arcade);
  emitirJugadoresArcade();
  console.log('Jugador arcade salio:', jugador.nombre, socket.id);

  if (jugadoresArcade.size === 0) {
    reiniciarArcadeVacio();
  }
}

function iniciarJugadorClasico(socket, nombre) {
  const existente = jugadores.get(socket.id);
  const spawn = existente ? null : elegirSpawn();
  const x = existente ? existente.x : spawn.x;
  const z = existente ? existente.z : spawn.z;

  const jugador = {
    id: socket.id,
    nombre,
    color: existente ? existente.color : elegirColor(socket.id),
    x,
    y: alturaEn(x, z, partida.nivel),
    z,
    rotY: existente ? existente.rotY : 0,
    vidas: existente ? existente.vidas : VIDAS_INICIALES
  };

  const otros = [...jugadores.values()].filter((otro) => otro.id !== socket.id);
  socket.emit('jugadores', otros);

  jugadores.set(socket.id, jugador);

  socket.emit('tu-jugador', {
    ...jugador,
    modo: MODOS.clasico,
    nivel: partida.nivel,
    semilla: partida.semilla
  });
  socket.emit('estado-partida', estadoPartida());
  emitirJugadoresActivos();

  if (!existente) {
    socket.to(MODOS.clasico).emit('jugador-entro', jugador);
    io.emit('dificultad', estadoDificultad());
    console.log('Jugador inicio:', nombre, socket.id, jugador.color);
  }
}

function iniciarJugadorArcade(socket, nombre) {
  const existente = jugadoresArcade.get(socket.id);
  const spawn = existente ? null : elegirSpawnArcade();
  const x = existente ? existente.x : spawn.x;
  const z = existente ? existente.z : spawn.z;

  const jugador = {
    id: socket.id,
    nombre,
    color: existente ? existente.color : elegirColor(socket.id, jugadoresArcade),
    x,
    y: existente ? existente.y : alturaEn(x, z, 1, MODOS.arcade),
    z,
    rotY: existente ? existente.rotY : 0,
    tiempoCima: existente ? existente.tiempoCima : 0,
    enCima: existente ? existente.enCima : false,
    cimaPisada: existente ? existente.cimaPisada : false
  };

  const otros = [...jugadoresArcade.values()].filter((otro) => otro.id !== socket.id);
  socket.emit('jugadores', otros);

  jugadoresArcade.set(socket.id, jugador);

  socket.emit('tu-jugador', { ...jugador, modo: MODOS.arcade });
  emitirJugadoresArcade();

  if (!existente) {
    socket.to(MODOS.arcade).emit('jugador-entro', jugador);
    console.log('Jugador arcade inicio:', nombre, socket.id, jugador.color);
  }

  iniciarTickArcade();
  if (arcade.estado === 'espera') {
    iniciarCuentaArcade();
  } else {
    emitirEstadoArcade();
  }
}

function salirDeModo(socket) {
  const modo = socket.data.modo;
  if (modo === MODOS.arcade) {
    quitarJugadorArcade(socket);
  } else if (modo === MODOS.clasico) {
    quitarJugador(socket);
  }

  socket.leave(MODOS.clasico);
  socket.leave(MODOS.arcade);
  socket.data.modo = null;
}

io.on('connection', (socket) => {
  console.log('Jugador conectado:', socket.id);
  socket.emit('jugadores-activos', estadoJugadores());
  socket.emit('arcade-jugadores', estadoJugadoresArcade());

  socket.on('PedirJugadores', () => {
    socket.emit('jugadores-activos', estadoJugadores());
  });

  socket.on('Iniciar', (datos) => {
    const objeto = datos && typeof datos === 'object';
    const nombre = String(objeto ? datos.nombre : datos).trim();
    const modo = objeto && datos.modo === MODOS.arcade ? MODOS.arcade : MODOS.clasico;
    const modoAnterior = socket.data.modo;

    if (!nombre) {
      return;
    }

    if (modoAnterior && modoAnterior !== modo) {
      if (modoAnterior === MODOS.arcade) {
        quitarJugadorArcade(socket);
      } else {
        quitarJugador(socket);
      }
    }

    socket.data.modo = modo;
    socket.join(modo);

    if (modo === MODOS.arcade) {
      iniciarJugadorArcade(socket, nombre);
    } else {
      iniciarJugadorClasico(socket, nombre);
    }
  });

  socket.on('Salir', () => {
    salirDeModo(socket);
  });

  socket.on('PedirDificultad', () => {
    socket.emit('dificultad', estadoDificultad());
  });

  socket.on('Dificultad', (nivel) => {
    if (!NIVELES_DIFICULTAD.includes(nivel) || jugadores.size > 0) {
      // Rechazado: se devuelve el estado real para que el cliente lo corrija.
      socket.emit('dificultad', estadoDificultad());
      return;
    }

    dificultad = nivel;
    io.emit('dificultad', estadoDificultad());
    console.log('Dificultad cambiada a:', dificultad, 'por', socket.id);
  });

  socket.on('Posicion', (posicion) => {
    if (!posicion || !Number.isFinite(posicion.x) || !Number.isFinite(posicion.y)
      || !Number.isFinite(posicion.z)) {
      return;
    }

    if (socket.data.modo === MODOS.arcade) {
      const jugador = jugadoresArcade.get(socket.id);
      if (!jugador) {
        return;
      }

      jugador.x = posicion.x;
      jugador.y = posicion.y;
      jugador.z = posicion.z;
      jugador.rotY = posicion.rotY;

      const ix = Math.round(posicion.x);
      const iz = Math.round(posicion.z);
      const enCima = esCimaArcade(ix, iz);
      const enAltura = Math.abs(jugador.y - alturaEn(ix, iz, 1, MODOS.arcade)) <= 0.1;
      jugador.enCima = enCima;

      if (enCima && enAltura && arcade.estado === 'jugando') {
        jugador.cimaPisada = true;
      } else if (!enCima && jugador.cimaPisada && enAltura
        && arcade.estado === 'jugando') {
        const datos = teletransportarJugadorArcade(jugador);
        socket.to(MODOS.arcade).emit('jugador-movio', datos);
        socket.emit('arcade-teletransporte', datos);
        return;
      }

      socket.to(MODOS.arcade).emit('jugador-movio', {
        id: socket.id,
        x: posicion.x,
        y: posicion.y,
        z: posicion.z,
        rotY: posicion.rotY
      });
      return;
    }

    const jugador = jugadores.get(socket.id);
    if (!jugador) {
      return;
    }

    jugador.x = posicion.x;
    jugador.y = posicion.y;
    jugador.z = posicion.z;
    jugador.rotY = posicion.rotY;

    socket.to(MODOS.clasico).emit('jugador-movio', {
      id: socket.id,
      x: posicion.x,
      y: posicion.y,
      z: posicion.z,
      rotY: posicion.rotY
    });
  });

  socket.on('Empujar', (datos) => {
    if (socket.data.modo !== MODOS.arcade) {
      return;
    }

    const objetivoId = datos && datos.objetivoId;
    const dx = Number(datos && datos.dx);
    const dz = Number(datos && datos.dz);

    if (typeof objetivoId !== 'string' || objetivoId === socket.id) {
      return;
    }

    const empujador = jugadoresArcade.get(socket.id);
    const objetivo = jugadoresArcade.get(objetivoId);
    const resultado = resolverEmpujeArcade(empujador, objetivo, dx, dz);

    if (!resultado) {
      return;
    }

    const { ox, oz, nx, nz, alturaObjetivo, alturaNueva } = resultado;
    const objetivoEstabaEnCima = objetivo.enCima;

    empujador.x = ox;
    empujador.y = alturaObjetivo;
    empujador.z = oz;
    empujador.enCima = esCimaArcade(ox, oz);
    if (empujador.enCima) {
      empujador.cimaPisada = true;
    }

    let datosObjetivo;
    let objetivoTeletransportado = false;

    if (objetivoEstabaEnCima && !esCimaArcade(nx, nz)) {
      datosObjetivo = teletransportarJugadorArcade(objetivo);
      objetivoTeletransportado = true;
    } else {
      objetivo.x = nx;
      objetivo.y = alturaNueva;
      objetivo.z = nz;
      objetivo.enCima = esCimaArcade(nx, nz);
      if (objetivo.enCima) {
        objetivo.cimaPisada = true;
      }

      datosObjetivo = {
        id: objetivo.id,
        x: objetivo.x,
        y: objetivo.y,
        z: objetivo.z,
        rotY: objetivo.rotY
      };
    }

    const datosEmpujador = {
      id: empujador.id,
      x: empujador.x,
      y: empujador.y,
      z: empujador.z,
      rotY: empujador.rotY
    };

    io.to(MODOS.arcade).except(socket.id).emit('jugador-movio', datosEmpujador);
    io.to(MODOS.arcade).except(objetivoId).except(socket.id)
      .emit('jugador-movio', datosObjetivo);

    if (objetivoTeletransportado) {
      io.to(objetivoId).emit('arcade-teletransporte', datosObjetivo);
    } else {
      io.to(objetivoId).emit('empujado', {
        x: objetivo.x,
        y: objetivo.y,
        z: objetivo.z
      });
    }

    socket.emit('empujado-ok', {
      x: empujador.x,
      z: empujador.z,
      objetivoId,
      objetivoX: datosObjetivo.x,
      objetivoZ: datosObjetivo.z
    });
  });

  // Recogida de powerup: el primero que llega se lo queda. Si no es valida,
  // se devuelve el estado real para que el cliente se corrija.
  socket.on('Recoger', (celda) => {
    if (socket.data.modo !== MODOS.clasico) {
      return;
    }

    const jugador = jugadores.get(socket.id);
    const valida = jugador && jugador.vidas > 0 && celda
      && Number.isInteger(celda.x) && Number.isInteger(celda.z);

    if (!valida) {
      socket.emit('estado-partida', estadoPartida());
      return;
    }

    const { x, z } = celda;
    const clave = `${x},${z}`;
    const tipo = powerupEn(x, z, partida.semilla, partida.nivel);
    const enCelda = Math.round(jugador.x) === x && Math.round(jugador.z) === z;

    if (!tipo || partida.tomados.has(clave) || !enCelda) {
      socket.emit('estado-partida', estadoPartida());
      return;
    }

    partida.tomados.set(clave, { id: socket.id, tipo });
    io.to(MODOS.clasico).emit('powerup-tomado', { x, z, id: socket.id, tipo });
  });

  // Golpe de mina: el cliente avisa la celda donde la piso. Se valida contra
  // el tablero de la dificultad activa y se descuenta una vida. El escudo no
  // llega hasta aca: el cliente lo absorbe antes de avisar.
  socket.on('Mina', (celda) => {
    if (socket.data.modo !== MODOS.clasico) {
      return;
    }

    const jugador = jugadores.get(socket.id);
    const valida = jugador && jugador.vidas > 0 && celda
      && Number.isInteger(celda.x) && Number.isInteger(celda.z)
      && Math.abs(celda.x) <= RADIO && Math.abs(celda.z) <= RADIO;

    if (!valida) {
      socket.emit('estado-partida', estadoPartida());
      return;
    }

    const ahora = Date.now();
    const ultimo = partida.ultimoGolpe.get(socket.id) || 0;
    if (ahora - ultimo < ENFRIAMIENTO_MINA) {
      return;
    }

    const { x, z } = celda;
    const distancia = Math.max(
      Math.abs(Math.round(jugador.x) - x),
      Math.abs(Math.round(jugador.z) - z)
    );
    if (!esMina(x, z, DIFICULTADES[dificultad], partida.semilla, partida.nivel) || distancia > 2) {
      socket.emit('estado-partida', estadoPartida());
      return;
    }

    partida.ultimoGolpe.set(socket.id, ahora);
    jugador.vidas = Math.max(0, jugador.vidas - 1);
    io.to(MODOS.clasico).emit('vidas', { id: socket.id, nombre: jugador.nombre, vidas: jugador.vidas });
    emitirJugadoresActivos();
    console.log('Mina pisada por', jugador.nombre, '- vidas:', jugador.vidas);
    programarReinicioSiTodosEliminados();
  });

  // Llegada a la cima (0, 0). La cuenta de movimientos la envia el cliente.
  // Un ganador inicia una ronda nueva para todos: vidas, powerups y posiciones.
  socket.on('Cima', (datos) => {
    if (socket.data.modo !== MODOS.clasico) {
      return;
    }

    const jugador = jugadores.get(socket.id);
    const movimientos = datos && Number.isInteger(datos.movimientos) ? datos.movimientos : 0;
    const valida = jugador && jugador.vidas > 0 && movimientos >= 1 && movimientos <= 100000
      && Math.round(jugador.x) === 0 && Math.round(jugador.z) === 0;

    if (!valida) {
      socket.emit('estado-partida', estadoPartida());
      return;
    }

    avanzarNivel({
      ganador: { id: socket.id, nombre: jugador.nombre },
      movimientos
    });
  });

  socket.on('disconnect', () => {
    if (socket.data.modo === MODOS.arcade) {
      quitarJugadorArcade(socket);
    } else if (socket.data.modo === MODOS.clasico) {
      quitarJugador(socket);
    }
    console.log('Jugador desconectado:', socket.id);
  });
});

server.listen(PUERTO, () => {
  console.log(`server running at http://localhost:${PUERTO}`);
});
