-- Esquema de la base de datos del WebService.
-- Ejecuta este archivo desde la consola de MySQL o phpMyAdmin.
-- En Laragon: Menu > MySQL > Console.
-- En XAMPP:   Menu > MySQL > Console (o phpMyAdmin).

CREATE DATABASE IF NOT EXISTS gcw
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gcw;

CREATE TABLE IF NOT EXISTS score (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  modo        ENUM('clasico', 'arcade') NOT NULL DEFAULT 'clasico',
  nivel       TINYINT UNSIGNED NULL,
  movimientos INT UNSIGNED NULL,
  tiempo_cima DECIMAL(7, 2) NULL,
  jugador_id  VARCHAR(64) NULL,
  foto        VARCHAR(255) NULL,
  origen      ENUM('manual', 'facebook') NOT NULL DEFAULT 'manual',
  score       INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_score_modo_puntos (modo, score)
);

-- Datos de ejemplo para que las tablas de cada modo no arranquen vacias.
-- Clasico: puntos = nivel * 100000 - movimientos.
-- Arcade:  puntos = round(tiempo_cima * 100).
INSERT INTO score (nombre, modo, nivel, movimientos, tiempo_cima, origen, score) VALUES
  ('Pato veloz', 'clasico', 3, 42, NULL, 'manual', 299958),
  ('Pato saltarin', 'clasico', 2, 30, NULL, 'manual', 199970),
  ('Pato campeon', 'arcade', NULL, NULL, 12.50, 'manual', 1250),
  ('Pato rapido', 'arcade', NULL, NULL, 8.20, 'manual', 820);
