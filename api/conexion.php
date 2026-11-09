<?php

define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'gcw');

function conexion() {
  $mysqli = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, (int) DB_PORT);

  if ($mysqli->connect_errno) {
    return null;
  }

  $mysqli->set_charset("utf8");

  return $mysqli;
}

/**
 * Cabeceras CORS para el frontend de Express. Si la peticion no trae Origin
 * (por ejemplo, al abrir el PHP directamente), no se agrega la cabecera.
 */
function aplicarCors($metodos = 'GET, POST, OPTIONS') {
  $origen = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
  $permitido = preg_match(
    '#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#',
    $origen
  ) === 1;

  if ($permitido) {
    header('Access-Control-Allow-Origin: ' . $origen);
    header('Vary: Origin');
  }

  header('Access-Control-Allow-Methods: ' . $metodos);
  header('Access-Control-Allow-Headers: Content-Type');
}

function modoValido($modo) {
  return in_array($modo, array('clasico', 'arcade'), true);
}

/**
 * Inserta una puntuacion. Devuelve true o un mensaje de error.
 * Los campos null (nivel/movimientos/tiempo y perfil) se guardan como NULL.
 */
function addScore($mysqli, $nombre, $modo, $puntos, $nivel, $movimientos, $tiempoCima, $jugadorId, $foto, $origen) {

  $stmt = $mysqli->prepare(
    "INSERT INTO score
       (nombre, modo, score, nivel, movimientos, tiempo_cima, jugador_id, foto, origen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  if (!$stmt) {
    return "Error al preparar la consulta: " . $mysqli->error;
  }

  $stmt->bind_param(
    "ssissssss",
    $nombre,
    $modo,
    $puntos,
    $nivel,
    $movimientos,
    $tiempoCima,
    $jugadorId,
    $foto,
    $origen
  );

  if (!$stmt->execute()) {
    $error = "Error: " . $stmt->error;
    $stmt->close();
    return $error;
  }

  $stmt->close();
  return true;
}

/**
 * Devuelve las mejores puntuaciones de un modo como arreglo de assoc.
 */
function registros($mysqli, $modo = 'clasico') {

  $stmt = $mysqli->prepare(
    "SELECT nombre, score, nivel, movimientos, tiempo_cima, foto, origen
     FROM score
     WHERE modo = ?
     ORDER BY score DESC, created_at DESC
     LIMIT 10"
  );

  if (!$stmt) {
    return array();
  }

  $stmt->bind_param("s", $modo);
  $stmt->execute();
  $resultado = $stmt->get_result();
  $filas = array();

  while ($fila = $resultado->fetch_assoc()) {
    $filas[] = $fila;
  }

  $stmt->close();

  return $filas;
}

function cerrarBd($mysqli) {
  if ($mysqli) {
    mysqli_close($mysqli);
  }
}

?>
