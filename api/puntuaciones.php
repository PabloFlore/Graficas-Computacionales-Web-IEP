<?php
header('Content-Type: application/json; charset=utf-8');

include("conexion.php");
aplicarCors('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

$modo = isset($_GET['modo']) ? strtolower(trim($_GET['modo'])) : 'clasico';

if (!modoValido($modo)) {
  http_response_code(400);
  echo json_encode(array('error' => 'Modo invalido. Usa clasico o arcade.'));
  exit;
}

$conn = conexion();

if (!$conn) {
  http_response_code(500);
  echo json_encode(array('error' => 'No se pudo conectar con la base de datos.'));
  exit;
}

$puntuaciones = array();

foreach (registros($conn, $modo) as $fila) {
  $puntuaciones[] = array(
    'nombre'      => $fila['nombre'],
    'puntos'      => (int) $fila['score'],
    'nivel'       => $fila['nivel'] !== null ? (int) $fila['nivel'] : null,
    'movimientos' => $fila['movimientos'] !== null ? (int) $fila['movimientos'] : null,
    'tiempoCima'  => $fila['tiempo_cima'] !== null ? (float) $fila['tiempo_cima'] : null,
    'foto'        => $fila['foto'] ? $fila['foto'] : null,
    'origen'      => $fila['origen']
  );
}

cerrarBd($conn);

echo json_encode(
  array('modo' => $modo, 'puntuaciones' => $puntuaciones),
  JSON_UNESCAPED_UNICODE
);
