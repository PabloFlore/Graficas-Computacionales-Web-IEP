const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');

const app = express();
const server = createServer(app);

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

server.listen(PUERTO, () => {
  console.log(`server running at http://localhost:${PUERTO}`);
});