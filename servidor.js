const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const fs = require('node:fs');

const SCORES_FILE = join(__dirname, 'data', 'scores.json');

function leerScores() {
  try {
    return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function guardarScores(scores) {
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2), 'utf8');
}

const app = express();
const server = createServer(app);
const io = new Server(server);

const PUERTO = process.env.PORT || 4000;

app.use(express.json());

// GET /api/scores → top 10 ordenados por puntos
app.get('/api/scores', (req, res) => {
  const scores = leerScores()
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 10);
  res.json(scores);
});

// POST /api/scores { nombre, puntos } → guarda un nuevo score
app.post('/api/scores', (req, res) => {
  const { nombre, puntos } = req.body;
  if (!nombre || puntos === undefined || isNaN(Number(puntos))) {
    return res.status(400).json({ error: 'Faltan datos: nombre y puntos son obligatorios.' });
  }
  const scores = leerScores();
  scores.push({ nombre: String(nombre).trim(), puntos: Number(puntos) });
  guardarScores(scores);
  res.json({ ok: true });
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