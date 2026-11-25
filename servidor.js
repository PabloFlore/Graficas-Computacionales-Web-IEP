const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { readFileSync, writeFileSync } = require('node:fs');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

const PUERTO = process.env.PORT || 4000;
const SCORES_FILE = join(__dirname, 'data', 'scores.json');

function leerScores() {
  try { return JSON.parse(readFileSync(SCORES_FILE, 'utf8')); }
  catch { return []; }
}

function guardarScores(scores) {
  writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2), 'utf8');
}

app.get('/api/puntuaciones', (_req, res) => {
  const scores = leerScores().sort((a, b) => b.puntos - a.puntos);
  res.json(scores.slice(0, 10));
});

app.post('/api/WebServices', (req, res) => {
  const nombre = (req.query.nombre || '').trim();
  const puntos = parseInt(req.query.score || '0', 10);
  if (!nombre || isNaN(puntos)) return res.status(400).send('Faltan datos');
  const scores = leerScores();
  scores.push({ nombre, puntos });
  guardarScores(scores);
  res.send('OK');
});

app.use(express.static(join(__dirname)));
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

const jugadores = new Map(); // socket.id → { id, nombre, sala, x, y, z, colorCuerpo, colorOjo }
const cola = [];             // [{ socket, nombre, colorCuerpo, colorOjo, dificultad }]

function emparejar(a, b) {
  const sala = `${a.socket.id.slice(0, 4)}-${b.socket.id.slice(0, 4)}`;
  const semilla = Math.floor(Math.random() * 0xFFFFFF);
  const dificultad = a.dificultad || 'normal';

  a.socket.join(sala);
  b.socket.join(sala);

  // Posiciones iniciales opuestas (tile*2 = coordenada mundo)
  const spawnA = { tileX: 0, tileZ:  8, x: 0, y: 1, z:  16 };
  const spawnB = { tileX: 0, tileZ: -8, x: 0, y: 1, z: -16 };

  jugadores.set(a.socket.id, { id: a.socket.id, nombre: a.nombre, sala, colorCuerpo: a.colorCuerpo, colorOjo: a.colorOjo, ...spawnA });
  jugadores.set(b.socket.id, { id: b.socket.id, nombre: b.nombre, sala, colorCuerpo: b.colorCuerpo, colorOjo: b.colorOjo, ...spawnB });

  a.socket.emit('partida-encontrada', {
    sala, semilla, dificultad,
    spawn: { x: spawnA.tileX, z: spawnA.tileZ },
    oponente: { id: b.socket.id, nombre: b.nombre, colorCuerpo: b.colorCuerpo, colorOjo: b.colorOjo, x: spawnB.x, y: spawnB.y, z: spawnB.z },
  });
  b.socket.emit('partida-encontrada', {
    sala, semilla, dificultad,
    spawn: { x: spawnB.tileX, z: spawnB.tileZ },
    oponente: { id: a.socket.id, nombre: a.nombre, colorCuerpo: a.colorCuerpo, colorOjo: a.colorOjo, x: spawnA.x, y: spawnA.y, z: spawnA.z },
  });

  console.log(`Partida: ${a.nombre} vs ${b.nombre}  sala:${sala}  semilla:${semilla}`);
}

io.on('connection', (socket) => {
  console.log('Jugador conectado:', socket.id);

  socket.on('BuscarPartida', ({ nombre, colorCuerpo, colorOjo, dificultad }) => {
    if (cola.some(p => p.socket.id === socket.id)) return; // ya en cola

    cola.push({ socket, nombre, colorCuerpo, colorOjo, dificultad });
    console.log(`En cola: ${nombre}  (${cola.length} esperando)`);

    if (cola.length >= 2) {
      const [a, b] = cola.splice(0, 2);
      emparejar(a, b);
    }
  });

  socket.on('CancelarBusqueda', () => {
    const idx = cola.findIndex(p => p.socket.id === socket.id);
    if (idx !== -1) {
      cola.splice(idx, 1);
      console.log(`Canceló búsqueda: ${socket.id}  (${cola.length} esperando)`);
    }
  });

  socket.on('Posicion', (posicion) => {
    const jugador = jugadores.get(socket.id);
    if (!jugador) return;
    jugador.x = posicion.x;
    jugador.y = posicion.y;
    jugador.z = posicion.z;
    jugador.rotationY = posicion.rotationY;
    socket.to(jugador.sala).emit('jugador-movio', {
      id: socket.id,
      x: posicion.x,
      y: posicion.y,
      z: posicion.z,
      rotationY: posicion.rotationY,
    });
  });

  socket.on('BatallaEliminado', () => {
    const jugador = jugadores.get(socket.id);
    if (!jugador) return;
    socket.to(jugador.sala).emit('rival-eliminado', socket.id);
    console.log(`Eliminado en batalla: ${jugador.nombre}  sala:${jugador.sala}`);
  });

  socket.on('disconnect', () => {
    const idx = cola.findIndex(p => p.socket.id === socket.id);
    if (idx !== -1) cola.splice(idx, 1);

    const jugador = jugadores.get(socket.id);
    if (jugador) {
      socket.to(jugador.sala).emit('jugador-salio', socket.id);
      jugadores.delete(socket.id);
    }
    console.log('Jugador desconectado:', socket.id);
  });
});

server.listen(PUERTO, () => {
  console.log(`server running at http://localhost:${PUERTO}`);
});
