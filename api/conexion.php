<?php

// Credenciales del entorno local de desarrollo. Ajústalas a tu instalación.
define('DB_HOST', 'localhost');
define('DB_PORT', '3307');
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

function addScore($mysqli, $nombre, $score) {

  $stmt = $mysqli->prepare("INSERT INTO score (nombre, score) VALUES (?, ?)");

  if (!$stmt) {
    echo "Error al preparar la consulta: " . $mysqli->error;
    return;
  }

  $stmt->bind_param("si", $nombre, $score);

  if ($stmt->execute()) {
    echo "Registro Agregado Correctamente!!!";
  } else {
    echo "Error: " . $stmt->error;
  }

  $stmt->close();
  $mysqli->close();
}

/**
 * Devuelve las mejores puntuaciones como arreglo de assoc.
 */
function registros($mysqli) {

  $stmt = $mysqli->prepare("SELECT nombre, score FROM score ORDER BY score DESC LIMIT 10");

  if (!$stmt) {
    return array();
  }

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
