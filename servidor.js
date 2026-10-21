const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

const PUERTO = process.env.PORT || 4000;

// La carpeta api/ contiene el codigo PHP del WebService, que ejecuta Apache.
// Express solo sirve archivos estaticos: si se dejara accesible, bajaria el
// codigo fuente en crudo (con las credenciales de MySQL) en lugar de correrlo.
// Por eso se bloquea aqui y el frontend lo consume por Apache en el puerto 80.
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

// Multijugador: cada socket conectado es un jugador. Se identifica por
// socket.id (no por nombre) para evitar colisiones entre nombres iguales.
const jugadores = new Map();

// Paleta de colores bien separados. El servidor es la unica fuente del
// color de cada jugador, asi todos (incluido uno mismo) lo ven igual.
const PALETA = ['#39ff14', '#00a2ff', '#ff4dd2', '#ffb000', '#9d4dff', '#00e0c6', '#ff3b30', '#f5f5f5'];

// Devuelve el primer color libre de la paleta. Si se agotan, deriva uno
// del id para que ningun jugador quede sin color.
function elegirColor(id) {
  const enUso = new Set([...jugadores.values()].map((jugador) => jugador.color));
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

// Saca al jugador del mapa y avisa a los demas. Se usa tanto al salir
// del juego (evento Salir) como al cerrar la pestaña (disconnect).
function quitarJugador(socket) {
  const jugador = jugadores.get(socket.id);
  if (!jugador) {
    return;
  }

  jugadores.delete(socket.id);
  socket.broadcast.emit('jugador-salio', socket.id);
  console.log('Jugador salio:', jugador.nombre, socket.id);
}

io.on('connection', (socket) => {
  console.log('Jugador conectado:', socket.id);

  socket.on('Iniciar', (nombre) => {
    const existente = jugadores.get(socket.id);

    // Iniciar es idempotente: si el socket ya estaba registrado se conserva
    // su color para que no cambie entre pantallas ni se duplique.
    const jugador = {
      id: socket.id,
      nombre,
      color: existente ? existente.color : elegirColor(socket.id),
      x: 0,
      y: 0,
      z: 0,
      rotY: 0
    };

    // Al recien llegado se le manda la lista de los demas (sin el mismo,
    // que todavia no esta registrado o ya lo estaba) para que los dibuje.
    const otros = [...jugadores.values()].filter((otro) => otro.id !== socket.id);
    socket.emit('jugadores', otros);

    // Y tambien su propia identidad (id + color) para que se pinte igual
    // que los demas lo ven.
    socket.emit('tu-jugador', jugador);

    jugadores.set(socket.id, jugador);

    // Solo se avisa a los demas si es realmente un jugador nuevo.
    if (!existente) {
      socket.broadcast.emit('jugador-entro', jugador);
      console.log('Jugador inicio:', nombre, socket.id, jugador.color);
    }
  });

  // Salir del juego sin cerrar la pestaña: el socket sigue vivo, pero el
  // jugador se elimina para que desaparezca en las demas pantallas.
  socket.on('Salir', () => {
    quitarJugador(socket);
  });

  socket.on('Posicion', (posicion) => {
    const jugador = jugadores.get(socket.id);
    if (!jugador) {
      return;
    }

    jugador.x = posicion.x;
    jugador.y = posicion.y;
    jugador.z = posicion.z;
    jugador.rotY = posicion.rotY;

    // Solo a los demas: el emisor ya tiene su propia posicion.
    socket.broadcast.emit('jugador-movio', {
      id: socket.id,
      x: posicion.x,
      y: posicion.y,
      z: posicion.z,
      rotY: posicion.rotY
    });
  });

  socket.on('disconnect', () => {
    quitarJugador(socket);
    console.log('Jugador desconectado:', socket.id);
  });
});

server.listen(PUERTO, () => {
  console.log(`server running at http://localhost:${PUERTO}`);
});