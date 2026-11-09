-- Migracion para agregar los modos de juego a la tabla score.
-- Ejecutar UNA sola vez sobre la base gcw existente (XAMPP/Laragon).
--
-- En XAMPP:  C:\xampp\mysql\bin\mysql.exe -u root gcw < api\migracion_modos.sql
-- En phpMyAdmin: seleccionar la base gcw y pegar este contenido.

USE gcw;

ALTER TABLE score
  ADD COLUMN modo ENUM('clasico', 'arcade') NOT NULL DEFAULT 'clasico' AFTER nombre,
  ADD COLUMN nivel TINYINT UNSIGNED NULL AFTER modo,
  ADD COLUMN movimientos INT UNSIGNED NULL AFTER nivel,
  ADD COLUMN tiempo_cima DECIMAL(7, 2) NULL AFTER movimientos,
  ADD COLUMN jugador_id VARCHAR(64) NULL AFTER tiempo_cima,
  ADD COLUMN foto VARCHAR(255) NULL AFTER jugador_id,
  ADD COLUMN origen ENUM('manual', 'facebook') NOT NULL DEFAULT 'manual' AFTER foto;

ALTER TABLE score
  ADD INDEX idx_score_modo_puntos (modo, score);

-- Limpia los registros de ejemplo duplicados de schema.sql y deja una muestra
-- de cada modo. Si ya tienes puntuaciones reales, comenta el TRUNCATE.
TRUNCATE TABLE score;

INSERT INTO score (nombre, modo, nivel, movimientos, tiempo_cima, origen, score) VALUES
  ('Pato veloz', 'clasico', 3, 42, NULL, 'manual', 299958),
  ('Pato saltarin', 'clasico', 2, 30, NULL, 'manual', 199970),
  ('Pato campeon', 'arcade', NULL, NULL, 12.50, 'manual', 1250),
  ('Pato rapido', 'arcade', NULL, NULL, 8.20, 'manual', 820);
