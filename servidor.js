const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');

const app = express();
const server = createServer(app);

app.use(express.static(join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

server.listen(4000, () => {
  console.log('server running at http://localhost:4000');
});