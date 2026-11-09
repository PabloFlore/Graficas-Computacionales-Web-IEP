<?php
header('Content-Type: application/json; charset=utf-8');

include("conexion.php");
aplicarCors('GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

function responderError($codigo, $mensaje) {
  http_response_code($codigo);
  echo json_encode(
    array('ok' => false, 'mensaje' => $mensaje),
    JSON_UNESCAPED_UNICODE
  );
  exit;
}

function dato($datos, $clave, $defecto = null) {
  if (isset($datos[$clave])) {
    return $datos[$clave];
  }
  if (isset($_GET[$clave])) {
    return $_GET[$clave];
  }
  return $defecto;
}

$cuerpo = file_get_contents('php://input');
$datos = array();

if ($cuerpo !== false && trim($cuerpo) !== '') {
  $json = json_decode($cuerpo, true);
  if (is_array($json)) {
    $datos = $json;
  }
}

if (empty($datos)) {
  $datos = $_POST;
}

$nombre    = trim((string) dato($datos, 'nombre', ''));
$modo      = strtolower(trim((string) dato($datos, 'modo', 'clasico')));
$origen    = strtolower(trim((string) dato($datos, 'origen', 'manual')));
$jugadorId = trim((string) dato($datos, 'jugadorId', dato($datos, 'jugador_id', '')));
$foto      = trim((string) dato($datos, 'foto', ''));

if ($nombre === '' || mb_strlen($nombre) > 100) {
  responderError(400, 'El nombre es obligatorio (maximo 100 caracteres).');
}

if (!modoValido($modo)) {
  responderError(400, 'Modo invalido. Usa clasico o arcade.');
}

if (!in_array($origen, array('manual', 'facebook'), true)) {
  $origen = 'manual';
}

if (mb_strlen($jugadorId) > 64) {
  $jugadorId = mb_substr($jugadorId, 0, 64);
}

if (mb_strlen($foto) > 255) {
  $foto = mb_substr($foto, 0, 255);
}

$nivel = null;
$movimientos = null;
$tiempoCima = null;
$puntos = null;

if ($modo === 'clasico') {
  $nivel = dato($datos, 'nivel', null);
  $movimientos = dato($datos, 'movimientos', null);
  $nivel = $nivel === null ? null : (int) $nivel;
  $movimientos = $movimientos === null ? null : (int) $movimientos;

  if ($nivel === null || $nivel < 1 || $nivel > 3) {
    responderError(400, 'El nivel debe estar entre 1 y 3.');
  }

  if ($movimientos === null || $movimientos < 0 || $movimientos > 1000000) {
    responderError(400, 'Movimientos invalidos.');
  }

  $puntos = $nivel * 100000 - $movimientos;
  if ($puntos < 0) {
    $puntos = 0;
  }
} else {
  $tiempoCima = dato($datos, 'tiempoCima', dato($datos, 'tiempo_cima', null));

  if ($tiempoCima === null || !is_numeric($tiempoCima)) {
    responderError(400, 'El tiempo en cima es obligatorio.');
  }

  $tiempoCima = round((float) $tiempoCima, 2);

  if ($tiempoCima < 0 || $tiempoCima > 3600) {
    responderError(400, 'Tiempo en cima fuera de rango.');
  }

  $puntos = (int) round($tiempoCima * 100);
}

$conn = conexion();

if (!$conn) {
  responderError(500, 'No se pudo conectar con la base de datos.');
}

$resultado = addScore(
  $conn,
  $nombre,
  $modo,
  $puntos,
  $nivel === null ? null : (string) $nivel,
  $movimientos === null ? null : (string) $movimientos,
  $tiempoCima === null ? null : (string) $tiempoCima,
  $jugadorId !== '' ? $jugadorId : null,
  $foto !== '' ? $foto : null,
  $origen
);

cerrarBd($conn);

if ($resultado !== true) {
  responderError(500, $resultado);
}

echo json_encode(
  array(
    'ok' => true,
    'mensaje' => 'Registro agregado correctamente.',
    'puntos' => $puntos
  ),
  JSON_UNESCAPED_UNICODE
);
