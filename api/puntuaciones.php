<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:4000');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

include("conexion.php");

$conn = conexion();

if (!$conn) {
  http_response_code(500);
  echo json_encode(['error' => 'No se pudo conectar con la base de datos.']);
  exit;
}

$puntuaciones = array();

foreach (registros($conn) as $fila) {
  $puntuaciones[] = array(
    'nombre' => $fila['nombre'],
    'puntos' => (int) $fila['score']
  );
}

cerrarBd($conn);

echo json_encode($puntuaciones);