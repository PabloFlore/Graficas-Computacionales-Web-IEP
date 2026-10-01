-- Esquema de la base de datos del WebService.
-- Ejecuta este archivo desde la consola de MySQL o phpMyAdmin.
-- En Laragon la consola se abre en Menu > MySQL > Console.

CREATE DATABASE IF NOT EXISTS gcw
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gcw;

CREATE TABLE IF NOT EXISTS score (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  score      INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Datos de ejemplo para que la tabla de puntuaciones no arranque vacia.
-- Comenta este bloque si ya tienes registros y no quieres duplicarlos.
INSERT INTO score (nombre, score) VALUES
  ('Jugador uno', 120),
  ('Jugador dos', 95),
  ('Jugador tres', 70);