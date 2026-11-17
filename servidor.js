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
let escenarioActual = { escenario: 'piramide', modo: 'carrera' };

io.on('connection', (socket) => {
  console.log('Jugador conectado:', socket.id);

  socket.on('ElegirEscenario', (data) => {
    escenarioActual = data;
    io.emit('escenario-elegido', data);
  });

  socket.on('Iniciar', (nombre) => {
    socket.emit('jugadores', [...jugadores.values()]);
    socket.emit('escenario-elegido', escenarioActual);

    jugadores.set(socket.id, { id: socket.id, nombre, x: 0, y: 0, z: 0 });

    // A los demas se les avisa que entro un jugador nuevo.
    socket.broadcast.emit('jugador-entro', { id: socket.id, nombre, x: 0, y: 0, z: 0 });
    console.log('Jugador inicio:', nombre, socket.id);
  });

  socket.on('Posicion', (posicion) => {
    const jugador = jugadores.get(socket.id);
    if (!jugador) {
      return;
    }

    jugador.x = posicion.x;
    jugador.y = posicion.y;
    jugador.z = posicion.z;

    // Solo a los demas: el emisor ya tiene su propia posicion.
    socket.broadcast.emit('jugador-movio', {
      id: socket.id,
      x: posicion.x,
      y: posicion.y,
      z: posicion.z
    });
  });

  socket.on('disconnect', () => {
    jugadores.delete(socket.id);
    socket.broadcast.emit('jugador-salio', socket.id);
    console.log('Jugador desconectado:', socket.id);
  });
});

server.listen(PUERTO, () => {
  console.log(`server running at http://localhost:${PUERTO}`);
});