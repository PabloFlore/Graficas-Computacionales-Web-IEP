<?php
header('Content-Type: text/plain; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:4000');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

include("conexion.php");

$nombre = isset($_GET['nombre']) ? trim($_GET['nombre']) : '';
$score  = isset($_GET['score']) ? trim($_GET['score']) : '';

if ($nombre === '' || $score === '') {
  http_response_code(400);
  exit('Faltan datos: nombre y score son obligatorios.');
}

if (!is_numeric($score)) {
  http_response_code(400);
  exit('El score debe ser un numero.');
}

$score = (int) $score;

$conn = conexion();

if (!$conn) {
  http_response_code(500);
  exit('No se pudo conectar con la base de datos.');
}

addScore($conn, $nombre, $score);

?>
