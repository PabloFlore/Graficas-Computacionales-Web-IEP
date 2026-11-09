# Graficas-Computacionales-Web-IEP

Juego web 3D para la materia de Gráficas Computacionales Web. Interfaz HTML/CSS,
motor 3D con Three.js, servidor Express, un WebService en PHP/MySQL para la tabla de
puntuaciones e inicio de sesión con Facebook (Meta).

---

## 1. Requisitos

| Herramienta | Para qué |
|---|---|
| Node.js 18+ | Servidor Express |
| Laragon (o XAMPP/WAMP) | Ejecutar el WebService PHP y MySQL |

---

## 2. Instalación

### 2.1 Dependencias de Node

```bash
npm install
```

### 2.2 Base de datos

Abre la consola de MySQL (en Laragon: **Menu > MySQL > Console**) y ejecuta:

```bash
source api/schema.sql
```

Eso crea la base `gcw`, la tabla `score` con la columna `modo` y cuatro registros de
ejemplo (dos clásicos y dos arcade).

Si ya tenías la base `gcw` con la tabla `score` vieja (sin `modo`), ejecuta una sola vez
la migración:

```bash
source api/migracion_modos.sql
```

La migración agrega las columnas nuevas, limpia los registros de ejemplo duplicados y
deja una muestra de cada modo. Si ya tienes puntuaciones reales, comentá el `TRUNCATE`
antes de ejecutarla.

Si tu consola no soporta `source`, abre el archivo desde phpMyAdmin (Menu > MySQL >
phpMyAdmin), seleccioná la base `gcw` y pegá el contenido.

### 2.3 WebService PHP en Apache

El código PHP **no puede ejecutarse desde Express**, así que lo sirve Apache. Hay que
exponer la carpeta `api/` del proyecto bajo `http://localhost/api`.

Hay un archivo de ejemplo para cada entorno:

**Laragon**

```bash
copy api\apache-alias.conf C:\laragon\etc\apache2\alias\api.conf
```

Después reiniciá Apache desde Laragon (**Menu > Apache > Stop**, luego **Start All**).

**XAMPP**

```powershell
Copy-Item api\apache-alias-xampp.conf C:\xampp\apache\conf\extra\gcw-api.conf
```

Agregá esta línea en `C:\xampp\apache\conf\httpd.conf`:

```apache
Include "conf/extra/gcw-api.conf"
```

Y reiniciá Apache desde el Panel de Control de XAMPP (o con
`C:\xampp\apache\bin\httpd.exe -t` para validar la configuración).

Si clonaste el proyecto en otro directorio, **editá la ruta `Alias` dentro del archivo
antes de copiarlo**.

Verificá que responde:

```
http://localhost/api/puntuaciones.php
```

Debe devolver el JSON con las puntuaciones.

### 2.4 Arrancar el juego

```bash
npm start
```

Abrí `http://localhost:4000`.

El puerto se puede cambiar con la variable de entorno `PORT`:

```bash
PORT=8080 npm start
```

---

## 3. Estructura

```
├── index.html              Vistas de la interfaz (menú, juego, pausa, config, puntuaciones)
├── servidor.js             Servidor Express en el puerto 4000
├── api/                    WebService PHP (lo ejecuta Apache, no Express)
│   ├── conexion.php        Conexión MySQL y consultas
│   ├── WebServices.php     INSERT de puntuaciones (POST JSON)
│   ├── puntuaciones.php    GET de puntuaciones por modo en JSON
│   ├── schema.sql          Creación de la base y datos de ejemplo
│   ├── migracion_modos.sql Migración de una tabla score vieja
│   ├── apache-alias.conf   Configuración para Laragon
│   └── apache-alias-xampp.conf Configuración para XAMPP
├── css/
│   └── estilos.css         Estilos de todas las vistas
├── docs/
│   └── GuiaVisualPatoenlaCima.pdf  Guía visual del rediseño (paleta, HUD, pirámide)
├── js/
│   ├── main.js             Punto de entrada
│   ├── config/
│   │   └── preferencias.js Guardado en LocalStorage
│   ├── motor/
│   │   ├── escena.js       Escena 3D (Three.js) + jugador + salto + remotos
│   │   ├── modelos.js      Carga de modelos OBJ/MTL y GLB (con Draco)
│   │   ├── piramide.js     Pirámide escalonada de cubos (niveles y minas)
│   │   ├── animaciones.js  Salto (squash & stretch) + AnimationMixer + decorativos
│   │   ├── hud.js          HUD de partida (clásico y arcade)
│   │   └── particulas.js   Sistema local de partículas cosméticas
│   ├── red/
│   │   ├── formulario.js   Formulario manual de clasico/arcade
│   │   ├── perfil.js       Perfil de Facebook y nombre recordado
│   │   ├── puntuaciones.js Lectura, ranking y envío contra el WebService
│   │   └── multijugador.js Cliente Socket.IO
│   └── util/
│       └── navegacion.js   Transición entre vistas
└── assets/                 Modelos, texturas y audio
    ├── audio/
    ├── models/             Modelos 3D (duck.obj + duck/spring/escudo/radar).glb
    │   └── glb/
    └── textures/
```

El botón de inicio de sesión con Facebook (`<fb:login-button>`, `FB.init` y la carga del
SDK) vive directamente en `index.html`, y sus estilos en `css/estilos.css`.

---

## 4. Cómo funciona la comunicación

El frontend corre en Express (`:4000`) y el backend en Apache (`:80`). Son orígenes
distintos, así que los PHP envían cabeceras `Access-Control-Allow-Origin`.

```
Navegador ──POST /api/WebServices.php──►  Apache  ──INSERT──►  MySQL (gcw.score)
Navegador ──GET  /api/puntuaciones.php──►  Apache  ──SELECT──►  MySQL
```

`js/red/puntuaciones.js` concentra las dos llamadas:

- `enviarPuntuacion({ nombre, modo, nivel, movimientos, tiempoCima, ... })` → POST JSON,
  calcula los puntos en PHP y hace el INSERT
- `cargarPuntuaciones(modo)` → GET `?modo=clasico|arcade` y pinta el ranking

Fórmulas de puntuación:

- **Clásico:** `puntos = nivel * 100000 - movimientos` (se registra al llegar a la cima).
- **Arcade:** `puntos = round(tiempo_cima * 100)` (se registra al terminar la partida).

`servidor.js` bloquea `/api` a propósito: Express solo sirve archivos estáticos, así que
dejarlo pasar descargaría el código PHP en crudo (con las credenciales de MySQL) en vez
de ejecutarlo.

### Credenciales

`api/conexion.php` tiene la configuración al inicio del archivo:

```php
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'gcw');
```

Son valores de desarrollo local. Ajustalos a tu instalación si tu MySQL corre en otro
puerto o tiene contraseña.

---

## 5. Pantallas

| Vista | Estado |
|---|---|
| Menú inicial | Lista. Jugar, Configuraciones, Puntuaciones, conexión multijugador |
| Configuraciones | Lista. Volumen, sonido y dificultad compartida (solo cambiable sin jugadores conectados; persisten en LocalStorage) |
| Puntuaciones | Lista. Formulario para guardar score + tabla desde MySQL |
| Pausa | Lista. Reanudar y salir |
| HUD de juego | Funcional. Indicador de los 3 niveles de juego y contadores de vidas, movimientos, objeto y jugadores |

---

## 6. Motor 3D

`js/motor/escena.js` arma la escena con Three.js (WebGL) en **vista isométrica**: la
cámara se sitúa en `(14, 14, 14)` y mira al centro de la pirámide (`lookAt(0, 2, 0)`), con
FOV de `60` para reducir la deformación de perspectiva. La tecla `V` alterna a una vista
cenital solo para ese cliente (ver sección 15.3).

La escena se compone de:

- **Mapas por nivel de juego** (`js/motor/piramide.js`): los tres usan una base de `9×9`
  columnas, pero cambian la altura de cada columna y la paleta. El nivel 1 es la pirámide
  clásica por distancia de Chebyshev (alturas 1–5); el nivel 2 es un montículo circular
  con raíz cuadrada entera (1–6); el nivel 3 es una estrella con pico central único (2–6).
  Cada cubo tiene tres tonos de color y un contorno negro (técnica del cubo ligeramente
  agrandado con `BackSide`). La tapa de algunas columnas es una **mina** (rojo) en lugar
  de un cubo seguro.
- **Jugador**: un grupo `jugador` con un subgrupo `bob` que contiene únicamente el pato
  (`assets/models/duck.glb`); ya no hay cubo hitbox visible. El `bob` sube y baja con un
  `NumberKeyframeTrack` (de `-0.5` a `-0.42`), de modo que el pato queda apoyado
  directamente sobre la columna y respira suavemente. En modo local aparece en el borde
  `(0, 1, 4)`; al conectarse, adopta la celda de spawn libre que le asigna el servidor.
  Se mueve con **WASD** o las **flechas**, en pasos de `1` sobre el plano X/Z, con límites
  `X ∈ [-4, 4]` y `Z ∈ [-4, 4]`. Si no mira hacia la dirección pulsada, la **primera
  pulsación solo lo gira** y la **segunda lo mueve** (aunque el giro no haya terminado);
  si ya mira, una sola pulsación mueve. Mantener la tecla no cuenta como segunda
  pulsación. Las cajas `Box3` de colisión se conservan aunque no haya malla de cubo: solo
  se ven al pulsar `C`.
- **Colisiones**: cada movimiento consulta la altura de la columna destino con
  `alturaEn()` y la caja `Box3` del jugador contra la columna. Se puede subir o bajar
  un nivel; un salto de más de un nivel, un límite del tablero o una mina bloquean el
  paso. Al chocar con una mina, el jugador retrocede una celda (si la celda de retroceso
  es válida) con una animación corta de rebote.
- **Colisiones entre jugadores**: antes de mover o aterrizar, se comprueba si la celda
  destino está ocupada por otro pato remoto (comparando las coordenadas X/Z redondeadas).
  Si lo está, el movimiento se bloquea igual que contra un muro. Cada cliente valida su
  propio movimiento con la última posición recibida de los demás.
- **Minas deterministas**: la celda con mina se calcula con un hash por celda y una
  **semilla por ronda**, no con `Math.random()` celda a celda, para que todas las pestañas
  vean el mismo tablero. La cima `(0,0)` y las celdas de spawn quedan excluidas. Las tapas
  nacen neutras y la mina solo se pinta en rojo mientras el jugador tiene el **radar**
  activo (ver sección 15).
- **Decorativos**: los modelos GLB `spring`, `escudo` y `radar` colocados en una fila por
  delante de la pirámide, con animación procedural (ver sección 12.3).
- **Luces**: ambiental (`0xffffff`, `0.55`), direccional (`0xffffff`, `1.1`) desde
  `(10, 12, 10)` y focal `SpotLight` que sigue al jugador con sombras de `1024 × 1024`.
  La pirámide usa `MeshLambertMaterial` para reaccionar a las tres luces.
- **Depuración**: `C` muestra/oculta las cajas `Box3` del jugador y de la columna
  objetivo; `L` enciende/apaga la luz focal (sin cono de depuración). La leyenda de
  controles queda visible en el HUD durante la partida.

Con la **barra espaciadora** el pato **salta y avanza 1 unidad hacia donde mira**, con
deformación *squash & stretch*; el grupo además **gira hacia la dirección de movimiento**
de forma interpolada (~0,15 s), por el camino angular más corto (ver secciones 12 y 13).
Si el pato no mira hacia la dirección deseada, primero se pulsa la **tecla de dirección**
(lo gira) y después **Espacio**; el salto usa la dirección objetivo y puede comenzar antes
de que termine el giro.

El render solo corre cuando la vista de juego está activa, así que en el menú y durante
la pausa el bucle se detiene.

### 6.1 Evidencia de rúbrica: colisiones e iluminación

**Detección y uso de colisiones.** La escena usa cajas alineadas a los ejes (`THREE.Box3`)
y una grilla de enteros para decidir si un movimiento es válido:

| Elemento | Ubicación | Comportamiento |
|---|---|---|
| Caja del jugador y de la columna | `js/motor/escena.js:206-219` | `Box3` de `1×1×1` por celda |
| Ocupación por otro jugador | `js/motor/escena.js:229-240` | Compara la celda X/Z redondeada de cada avatar remoto |
| Evaluación de celda destino | `js/motor/escena.js:242-266` | Bloquea límites, minas, jugadores y muros de más de un nivel |
| Giro y confirmación de movimiento | `js/motor/escena.js:281-315` | Primera pulsación gira; la segunda mueve, aunque el giro siga en curso |
| Movimiento con colisión | `js/motor/escena.js:317-343` | Solo actualiza la posición si `evaluarCelda()` devuelve `ok` |
| Rebote al pisar una mina | `js/motor/escena.js:345-384` | Retrocede una celda con animación corta |
| Validación del salto | `js/motor/escena.js:386-424` | Evalúa la celda destino antes de iniciar el salto |
| Depuración visual | `js/motor/escena.js:440-448` | Tecla `C`: muestra las cajas `Box3` del jugador y del destino |

**Iluminación ambiental y focal.**

| Tipo | Ubicación | Detalle |
|---|---|---|
| Ambiental | `js/motor/escena.js:95-96` | `AmbientLight` blanca con intensidad `0.55` |
| Direccional (sol) | `js/motor/escena.js:98-100` | `DirectionalLight` desde `(10, 12, 10)` |
| Focal | `js/motor/escena.js:102-111` | `SpotLight` cálida con sombras `1024×1024` |
| Seguimiento | `js/motor/escena.js:426-429` | La luz focal acompaña al jugador |
| Control | `js/motor/escena.js:431-433` y `451-454` | Tecla `L`: enciende/apaga la luz focal |

Los cubos usan `MeshLambertMaterial` (`js/motor/piramide.js:63-73`) para que las tres
luces modifiquen su tono, y el renderer tiene `shadowMap` con `PCFSoftShadowMap`
(`js/motor/escena.js:64-65`).

**Prueba sugerida (con `npm start` en `http://localhost:4000`):**

1. Caminar mirando en la dirección actual: una pulsación mueve.
2. Pulsar otra dirección: la primera pulsación solo gira; la segunda mueve.
3. Mantener una tecla de dirección: no se encadenan pasos.
4. Saltar ya encarado: un solo `Espacio`.
5. Saltar hacia otra dirección: pulsar la tecla de dirección y después `Espacio`.
6. Caminar contra un muro de dos niveles: el movimiento se bloquea.
7. Subir un escalón de un nivel: el movimiento se permite.
8. Salir del tablero: el límite bloquea el paso.
9. Pisar una mina: el pato retrocede con un rebote.
10. Pulsar `C`: aparecen las cajas de colisión del jugador y de la celda destino.
11. Pulsar `L`: la luz focal se apaga; otro pulso la vuelve a encender.
12. Con dos pestañas conectadas, comprobar que cada pato aparece en una celda de spawn distinta.
13. Intentar caminar o saltar a la celda ocupada por el otro pato: el movimiento se bloquea.

### 6.2 Evidencia de rúbrica: niveles de dificultad

Hay dos ejes distintos que no deben confundirse:

- **Nivel de juego (1–3):** cambia el mapa y la probabilidad de mina. Se avanza al llegar a
  la cima y es compartido por todos los jugadores de la partida.
- **Dificultad de minas (Fácil/Normal/Difícil):** se elige en **Configuraciones** y solo
  cambia el umbral de mina dentro del mapa actual. El tiempo no es una variable.

| Dificultad | Probabilidad de mina |
|---|---|
| Fácil | `0.17` |
| Normal | `0.26` (valor por defecto) |
| Difícil | `0.33` |

- **Mapas:** `alturaEn(ix, iz, nivelJuego)` devuelve la altura de la columna para el nivel
  de juego. Nivel 1: pirámide clásica 1–5; nivel 2: montículo circular 1–6 con `isqrt`;
  nivel 3: estrella 2–6 con pico central único. Las tres formas respetan el movimiento de
  una capa por paso.
- **Qué cambia la dificultad:** solo la densidad de minas. El hash por celda es el mismo
  para las tres dificultades; cambia el umbral (`esCeldaMina`). Para una misma semilla, las
  minas de Fácil están contenidas en las de Normal, y éstas en las de Difícil. La cima
  `(0,0)` y los spawns nunca son mina.
- **Semilla por ronda y por nivel:** `nuevaSemilla()` genera la semilla y `hash01()` reparte
  minas con `Math.imul`, idéntico en cliente y servidor. El servidor guarda
  `partida.semilla` y `partida.nivel`, y los envía en `estado-partida`, `tu-jugador` y
  `nueva-ronda`; al empezar una ronda o un nivel nuevo se regenera la semilla. En local
  (sin servidor) el cliente genera su propia semilla.
- **Cálculo del tablero:** `celdasMina(probabilidad, semilla, nivelJuego)` devuelve el
  conjunto de minas; `crearPiramide(scene, minas, nivelJuego)` construye la geometría y
  `marcarMinas(cubos, minas, nivelJuego)` marca las tapas.
- **Powerups:** `powerupsDelTablero(semilla, nivelJuego)` es determinista y coloca **12
  objetos fijos (4 de cada tipo: resorte, escudo y radar)**. Elige las celdas en orden
  pseudoaleatorio derivado de la semilla y exige una separación de Chebyshev de 2 celdas
  para que queden repartidos; si el tablero no permite llegar a 12 con esa separación,
  completa con las celdas restantes. Excluye la cima, los spawns y las minas de la
  dificultad Difícil del nivel actual: como las minas de Fácil y Normal son un subconjunto
  de las de Difícil, un powerup nunca queda sobre una mina de ninguna dificultad.
- **Resorte:** al usarlo con `E`, el pato salta dos celdas en línea recta. El salto admite
  `maxSubida: 2`, así que puede aterrizar hasta dos niveles más arriba; el salto normal
  sigue limitado a un nivel.
- **Cambio de dificultad en caliente:** `aplicarDificultad(dificultad)` recalcula el
  conjunto y cambia solo el color de la tapa de cada columna con `marcarMinas()` y
  `aplicarTipoTapa()`. No reconstruye la geometría ni los powerups. Si el jugador está sobre
  una celda que pasa a ser mina, no pasa nada hasta que intente entrar en ella.
- **Cambio de nivel de juego:** `aplicarTablero(semilla, nivelJuego)` destruye el tablero
  anterior y crea el nuevo cuando cambia el nivel; si no cambia, solo recalcula minas y
  powerups. `aplicarEstadoPartida` y `aplicarNuevaRonda` pasan el nivel recibido del
  servidor.
- **Compartida:** el servidor guarda la dificultad (`let dificultad`) y el nivel de juego
  (`partida.nivel`). La dificultad se difunde como `dificultad` con `{ nivel, bloqueada }`;
  el nivel de juego viaja dentro del estado y de `nueva-ronda`.
- **Bloqueo:** solo se puede cambiar la dificultad cuando no hay jugadores conectados. Si
  hay alguno, el servidor rechaza `Dificultad`, responde con el estado real y el selector se
  deshabilita con una nota (`js/config/preferencias.js`, `index.html`,
  `#cfg-dificultad-nota`).
- **Cliente:** el selector envía el cambio al servidor con `cambiarDificultad()`
  (`js/red/multijugador.js`) y se aplica al recibir el estado. Sin socket, se aplica solo en
  la pantalla local (`js/main.js`).

**Prueba sugerida:**

1. Con nadie conectado, cambiar a Difícil en Configuraciones: al usar un radar aparecen más
   tapas rojas en la pirámide. Volver a Fácil: quedan menos.
2. Abrir una segunda pestaña: su selector muestra el mismo nivel.
3. Pulsar **Conectar** en una pestaña: el selector de todas las pestañas se deshabilita y
   aparece la nota.
4. Con un jugador conectado, enviar `Dificultad` desde un observador Socket.IO: el servidor
   rechaza el cambio y responde con el nivel actual.
5. Salir al menú de la pestaña conectada: el selector vuelve a habilitarse en todas las
   pestañas.
6. Llegar a la cima tres veces seguidas: se pasa por los mapas 2 y 3 y, al ganar el 3,
   se vuelve al mapa 1; cada transición reparte minas y powerups distintos porque el
   servidor genera una semilla nueva.
7. Agotar las vidas de todos: tras 3 s se vuelve al mapa 1 con 3 vidas y semilla nueva.

---

## 7. Estado del proyecto

Funciona:

- Transición entre las cinco vistas
- Preferencias persistentes en LocalStorage
- WebService PHP/MySQL: guardar y leer puntuaciones
- Inicio de sesión con Facebook (SDK JS) mostrando nombre y foto del perfil
- Vista isométrica con tres mapas de cubos (pirámide, círculo y estrella) y minas (`js/motor/piramide.js`)
- Carga de modelos 3D (OBJ/MTL y GLB) con `LoadingManager` compartido y soporte Draco
- Movimiento del jugador por teclado (WASD + flechas) con límites; si no mira, la primera pulsación gira y la segunda mueve
- Colisiones por columna: escalones de un nivel, muros, límites y minas con rebote
- Colisiones entre jugadores: la celda ocupada por otro pato bloquea el paso y el aterrizaje
- Spawns repartidos: el servidor asigna a cada jugador una celda libre del borde sin mina
- Minas ocultas hasta usar el radar; pisar una mina sin escudo resta una vida y aturde 2 s
- Powerups deterministas: 12 por tablero (4 resortes, 4 escudos y 4 radares), repartidos con separación mínima de 2 celdas y nunca sobre una mina
- Vidas: 3 por jugador; al llegar a 0 queda como espectador hasta que el nivel avance o todos queden eliminados
- Reinicio automático: si **todos** los jugadores llegan a 0 vidas, a los 3 s se vuelve al nivel 1 para todos
- Progresión de niveles: al llegar a la cima `(0,0)` se avanza al siguiente mapa y se reinician vidas, powerups, contador y spawns; al ganar el nivel 3 se vuelve al 1
- HUD de partida: indicador de los 3 niveles, vidas, movimientos, objeto y avisos de aturdimiento, radar y eliminado
- Vista cenital local con `V`, sin afectar a los demás jugadores (ver sección 15)
- Salto direccional con animación *squash & stretch* (Espacio, avanza hacia donde mira; si no mira, tecla de dirección + Espacio), validado contra la celda destino y sincronizado en multijugador
- Iluminación ambiental, direccional y focal (`SpotLight`) con sombras y materiales reactivos
- Modo de depuración `C` (cajas de colisión) y `L` (luz focal)
- Giro del jugador hacia la dirección de movimiento, sincronizado (ver sección 13)
- `AnimationMixer` listo para reproducir pistas de modelos GLTF/GLB (ver sección 12)
- Objetos decorativos animados: spring, escudo y radar (ver sección 12.3)
- Multijugador con Socket.IO: pato por jugador (sin cubo), color del cuerpo, orientación
  (rotY), salto, vidas y entrada/salida
- Contador de jugadores activos en HUD y menú (`activos/conectados`) con reinicio local
  cuando no hay servidor
- Tablero con **semilla por ronda y nivel**: minas y powerups cambian entre rondas y
  coinciden en todas las pestañas (`estado-partida`/`nueva-ronda` envían `semilla` y `nivel`)
- Multijugador verificado extremo a extremo contra el servidor: `jugadores`,
  `jugadores-activos`, `tu-jugador`, `jugador-entro`, `jugador-movio` (con `rotY`),
  `jugador-salio`, `Mina`/`vidas` y `nueva-ronda` (con `nivel` y `motivo`; ver secciones 14.2 y 15)
- **Modo arcade** local y multijugador: mapa 15×15, sin minas/vidas/powerups, partida
  de 90 s, cuenta regresiva, tiempo acumulado en la cima 3×3, ranking autoritativo del
  servidor y reinicio automático (ver sección 16)
- **Salas paralelas** `clasico`/`arcade` con contadores separados en el menú; el modo
  clásico y el arcade pueden coexistir sin recibir movimiento ni estados del otro
- **Empuje arcade.** En arcade multijugador, caminar hacia otro pato desde atrás lo
  desplaza una celda; de frente, de lado o contra un borde/muro/otro jugador el
  movimiento se bloquea. Se prueba con dos pestañas conectadas a la sala arcade.
- **Salir de la cima arcade.** Si un jugador pisa el 3×3 central y después sale
  caminando, saltando o por un empuje, vuelve al spawn inicial de la partida. El
  tiempo que ya acumuló en la cima se conserva.
- Carga de GLB comprobada en el navegador: los cinco archivos responden
  `Content-Type: model/gltf-binary`
- **Puntuaciones reales por modo.** El modo clásico registra `nivel * 100000 - movimientos`
  al llegar a la cima; el arcade registra `round(tiempo_cima * 100)` al terminar. El
  ranking se consulta por separado con pestañas Clásico/Arcade.
- **Perfil de Facebook en las puntuaciones.** El nombre y la foto del perfil se guardan en
  `localStorage`, se autocompletan en el formulario y se envían con el score (`origen =
  facebook`). Sin Facebook se usa el nombre manual.

Pendiente:

- **Cronómetro clásico.** El cronómetro del modo arcade es real; el panel de tiempo del
  modo clásico sigue mostrando `00:00`. El indicador de niveles sí es dinámico (1–3).
- **Sonido.** Las preferencias de volumen y sonido se guardan, pero no hay audio que
  reproducir ni archivos en `assets/audio`.
- **Posición de los decorativos.** `escudo` y `radar` quedan medio cuerpo **por debajo**
  del nivel base de la pirámide (`y = -0.5`) porque su malla viene centrada verticalmente.
  Corregir `posicion.y` a `-0.214` y `+0.074` respectivamente (ver sección 12.4).
- **Vidas al reconectar.** Un jugador eliminado que sale y vuelve a entrar recibe 3 vidas
  nuevas, porque el servidor lo trata como un jugador nuevo.

---

## 8. Notas

- El proyecto usa Three.js desde unpkg mediante `importmap`, no desde npm.
- El decodificador Draco también se carga desde unpkg (ver sección 10.1).

---

## 9. Inicio de sesión con Facebook (Meta)

El menú inicial incluye un botón para iniciar sesión con Facebook mediante el **SDK de
JavaScript**. Al autenticarse, el juego muestra el nombre y la foto del perfil.

### 9.1 Datos de la app

| Dato | Valor |
|---|---|
| App ID | `1664395638440492` |
| Versión de Graph API | `v26.0` |
| Permisos solicitados | `public_profile`, `email` |

El **App Secret nunca se sube al repositorio**: solo se usa el App ID, que es un
identificador de cliente y no un secreto.

### 9.2 Configuración en Meta for Developers

1. Entrá a [developers.facebook.com](https://developers.facebook.com) e iniciá sesión con
   tu cuenta; si es la primera vez, completá el registro como desarrollador.
2. Creá la app en [developers.facebook.com/apps/creation](https://developers.facebook.com/apps/creation)
   con nombre, correo de contacto y, como caso de uso, **"Inicio de sesión con Facebook"**.
3. En **Ajustes → Básico**, agregá `localhost` en **Dominios de la app**. Ahí mismo figura
   el **App ID**.
4. En **Facebook Login → Configuración**, dentro de *Configuración de OAuth del cliente*:
   - **Inicio de sesión de OAuth web**: Sí
   - **Usar modo estricto para URI de redireccionamiento**: Sí
   - **Dominios permitidos para el SDK de JavaScript**: `localhost`
   - **Inicio de sesión con el SDK de JavaScript**: Sí
   - **URI de redireccionamiento de OAuth válidos**: `http://localhost:4000/`
5. Guardá los cambios.

### 9.3 Qué se tocó en el proyecto

- `index.html`: el botón `<fb:login-button scope="public_profile,email" onlogin="checkLoginState();">`,
  el contenedor `#sesion-facebook`, la inicialización `FB.init({ appId, cookie, xfbml, version })`
  junto con el loader del SDK, y la función `checkLoginState()`, que consulta
  `FB.api('/me', { fields: 'name,picture' })`, muestra la respuesta y pinta el nombre y la
  foto.
- `css/estilos.css`: estilos de `.facebook` y `.sesion-facebook` (foto redonda + nombre).

### 9.4 Notas

- La app queda en **modo desarrollo**: solo pueden iniciar sesión las cuentas con un rol
  (administrador, desarrollador o probador). Para abrirla al público hay que pasar por la
  App Review.
- El aviso rojo de **"No cumple los requisitos"** (Política de privacidad y Eliminación de
  datos de usuario) solo es necesario para **publicar** la app; no bloquea el login en modo
  desarrollo.
- En desarrollo se permite `http://localhost`. Si Meta rechaza el login por exigir HTTPS,
  una alternativa es exponer el puerto con un túnel (por ejemplo ngrok).

### 9.5 Evidencias de la práctica

1. Captura de la app creada en Meta for Developers.
2. Captura de la configuración de la API mostrando el App ID propio.
3. Captura del inicio de sesión desde el botón agregado en el juego.

---

## 10. Carga de modelos 3D

`js/motor/modelos.js` concentra la carga de modelos con Three.js:

- `crearGestorCarga()` → devuelve un `LoadingManager` compartido (logs de progreso).
- `cargarModeloOBJ(ruta, nombre, escala, posicion, gestor)` → carga `.mtl` y luego `.obj`
  (la ruta va **sin** extensión).
- `cargarModeloGLB(ruta, nombre, escala, posicion, gestor)` → carga `.glb`/`.gltf`.
- `cargarModelos(lista, gestor)` → carga la lista en paralelo (`Promise.allSettled`) y
  devuelve solo las que cargaron.

Los modelos se declaran en la constante `MODELOS` de `js/motor/escena.js`; agregar un
elemento basta para que aparezca en la escena. Las rutas son:

| Formato | Carpeta |
|---|---|
| OBJ + MTL (+ texturas) | `assets/models/` |
| GLB / GLTF | `assets/models/` |

Como Express sirve todo el repositorio, quedan accesibles en
`http://localhost:4000/assets/models/...` sin cambios en el servidor.

### 10.1 Modelos comprimidos con Draco

Los GLB `escudo` y `radar` (y el reservado `resorte`) usan la extensión
`KHR_draco_mesh_compression`, que el `GLTFLoader` **no decodifica por sí solo**: sin el
decodificador, la carga falla y el modelo se descarta en silencio. Por eso
`js/motor/modelos.js` instancia un `DRACOLoader` y lo engancha al cargador GLB:

```js
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.155.0/examples/jsm/libs/draco/');
// ...
loader.setDRACOLoader(dracoLoader);
```

El decodificador se descarga de la **misma versión de Three.js** que usa el `importmap`
(`0.155.0`), así que el proyecto sigue dependiendo de internet como hasta ahora (Three
también se carga desde unpkg). Para trabajar sin conexión habría que copiar el build de
Three y la carpeta `draco` a `assets/` y reapuntar el `importmap` y el `setDecoderPath`.

> `spring.glb` **no** usa Draco: es un GLB sin comprimir (unos 387 KB) cuya malla viene
> repartida en varios nodos (`Sketchfab_model`, `Root`, `Lamp`, `Circle`). El decodificador
> solo hace falta para `escudo`, `radar` y `resorte`.

### 10.2 Modelos incluidos

| Archivo | Uso | Tamaño | Compresión |
|---|---|---|---|
| `assets/models/duck.obj` (+ `.mtl`, `.png`) | Alternativa texturizada (no usada en escena) | ≈ 863 KB en 3 archivos | — |
| `assets/models/duck.glb` | El pato del jugador (low-poly, sin textura) | 15,3 KB | GLB (sin Draco) |
| `assets/models/spring.glb` | Decorativo: resorte | 387 KB | GLB **sin Draco** |
| `assets/models/escudo.glb` | Decorativo: escudo | 43,6 KB | GLB con Draco |
| `assets/models/radar.glb` | Decorativo: radar | 5,7 KB | GLB con Draco |
| `assets/models/resorte.glb` | Reservado (no se usa en escena) | 7 KB | GLB con Draco |

### 10.3 El pato del jugador en `duck.glb`

> **Estado: aplicado.** La escena usa `duck.glb` con escala `0.51` y `posicion.y = 0.2`.
> Abajo queda la comparación con `duck.obj` como referencia.

La migración fue barata en código (tres puntos y sin build ni empaquetado), pero `duck.glb`
**no es el mismo pato**: es una versión
low-poly de colores planos, mientras que `duck.obj` es el pato texturizado de la guía
visual. Antes de decidir conviene ver los dos datos lado a lado:

| | `duck.obj` (el que está en escena) | `duck.glb` |
|---|---|---|
| Formato | OBJ + MTL + PNG (3 archivos) | GLB (1 archivo) |
| Descarga | 759,5 KB + 0,2 KB + 103,7 KB ≈ **863 KB** | **15,3 KB** (≈ 98 % menos) |
| Geometría | 5 538 vértices | 250 vértices / 265 triángulos, en 3 mallas (`Icosphere_Yellow` = cuerpo, `Cube_Orange` = pico, `Sphere_Black` = ojo) |
| Color | Textura `duck.png` con `map_Kd` | Colores planos por material (`Yellow`, `Orange`, `Black`), **sin textura** |
| Pivote | En los pies (`min Y = 0`) | **No** en los pies: el punto más bajo queda en `Y = -0.385` |
| Tamaño (ancho × alto × fondo) | `0.725 × 1.052 × 0.995` | `2.221 × 2.045 × 2.765` |
| Orientación | Mira a `+Z` | Mira a `+Z` (el pico queda en `Z ≈ +0.72`), así que el `OFFSET_ORIENTACION` sigue siendo `0` |
| Pistas de animación | 0 | 0 (los dos modelos) |

Los tres puntos que se tocaron:

1. **La entrada del pato en `MODELOS`** (`js/motor/escena.js`): cambiar `tipo` a `'glb'` y
   la ruta a `assets/models/duck.glb`, y ajustar `escala` y `posicion`:
   - `escala ≈ 0.51` para igualar la altura del OBJ (`1.052 / 2.045`).
   - `posicion.y ≈ +0.20` para que los pies queden en el origen (`0.385 × 0.51`), porque el
     pivote del GLB no está en los pies.
2. **El avatar remoto** (`js/motor/escena.js`, `agregarJugadorRemoto`): hoy hace
   `pato.position.set(0, 0.5, 0)`, que **asume que el origen del modelo está en los pies**
   (con el OBJ es cierto). Con el GLB hay que sumar el offset: `0.5 + 0.20`.
3. **La documentación**: este README y los comentarios que mencionan `duck.obj`.

Lo que **no** hay que tocar: `crearSalto()` captura la escala base del modelo, así que
funciona igual con una escala distinta de `1`; `crearMezclador()` se queda sin pistas en los
dos casos; y `pistasDe()` no cambia.

Un detalle a tener en cuenta: `Object3D.clone()` (el avatar remoto) copia `userData` con
`JSON.parse(JSON.stringify(...))`. Con `duck.glb` no hay problema porque el archivo no trae
pistas (`userData.animations` queda como `[]`), pero un GLB **con** animaciones reales
perdería los métodos de sus clips en el clon. El código ya lo evita pasando las pistas por
separado (`pistasDe(plantillaPato)`).

**Conclusión:** la migración ahorra unos 848 KB de descarga, a costa de un pato low-poly de
colores planos en lugar del pato texturizado de la guía. `duck.obj` queda en `assets/` como
la alternativa texturizada por si se quiere volver atrás.

---

## 11. Multijugador (Socket.IO)

El servidor usa Socket.IO sobre el mismo HTTP de Express, en el puerto **4000**.

### 11.1 Servidor (`servidor.js`)

- `const io = new Server(server)`.
- `jugadores`: un `Map` identificado por `socket.id` (evita colisiones de nombres) con
  `{ id, nombre, color, x, y, z, rotY, vidas }` (`rotY` es la orientación y `vidas`
  arranca en 3).
- `jugadoresArcade`: `Map` paralelo con `{ id, nombre, color, x, y, z, rotY,
  tiempoCima, enCima }`. El estado `arcade` guarda ronda, tiempos, ranking y fase.
- Salas Socket.IO `clasico` y `arcade`: las emisiones clásicas usan
  `socket.to('clasico')`/`io.to('clasico')` y las arcade su sala equivalente.
- `elegirColor()`: asigna a cada jugador el primer color libre de `PALETA`, así el
  servidor es la **única fuente del color** y todos (incluido uno mismo) lo ven igual.
- `elegirSpawn()`: elige la primera celda libre de `SPAWNS` (borde del tablero, sin
  minas). Evita que dos jugadores nuevos aparezcan superpuestos.
- Eventos recibidos: `Iniciar` (registra al jugador, le asigna color y spawn, y le manda
  la lista de los demás), `Posicion` (actualiza y reenvía a los demás, posición + `rotY`),
  `Mina` (valida la celda con la dificultad, el nivel y la semilla activos y resta una vida),
  `Recoger` (powerup de la celda), `Cima` (llegada a `(0,0)`, avanza de nivel),
  `Dificultad`/`PedirDificultad`, `PedirJugadores` y `Salir` (saca al jugador sin cerrar
  la pestaña, al volver al menú).
- Eventos emitidos: `jugadores`, `jugadores-activos` (`{ activos, conectados }`),
  `tu-jugador` (identidad propia: id + color + posición + vidas + nivel + semilla),
  `jugador-entro`, `jugador-movio`, `jugador-salio`, `dificultad` (`{ nivel, bloqueada }`),
  `estado-partida` (ronda, nivel de juego, semilla, jugadores activos/conectados, vidas y
  powerups), `powerup-tomado`, `vidas` y `nueva-ronda` (incluye `nivel`, `semilla`,
  `motivo` y, si corresponde, `ganador`).
- Eventos arcade: `arcade-estado` (fase, ronda, tiempos, jugadores y ranking),
  `arcade-fin` (ganador, empate y ranking), `arcade-jugadores` (contador del menú) y
  `arcade-teletransporte` (vuelta al spawn al salir de la cima). `Posicion` actualiza
  `enCima` y el tick acumula tiempo solo para la sala arcade.
- **Jugadores activos:** el servidor cuenta a los jugadores con `vidas > 0` y lo difunde en
  `jugadores-activos` y dentro de `estado-partida`; el HUD y el menú muestran
  `activos/conectados`. Al pedir `PedirJugadores` se reenvía el contador actual.
- **Vidas:** cada golpe de mina sin escudo descuenta una; con 0 el jugador queda
  eliminado y el servidor rechaza sus `Recoger` y `Cima`. El escudo no llega al servidor:
  el cliente lo absorbe antes de avisar.
- **Nivel nuevo:** cuando un jugador válido llega a la cima, `avanzarNivel()` pasa al
  siguiente mapa (o vuelve al 1 después del tercero), reparte spawns, repone las 3 vidas,
  limpia los powerups tomados, genera una **semilla nueva** y emite `nueva-ronda` con
  `motivo: 'nivel'` o `'partida'`, el nivel, el ganador, sus movimientos y las posiciones.
- **Reinicio por eliminación:** si todos los jugadores conectados quedan con 0 vidas (por
  minas o porque el último jugador con vidas se desconecta), el servidor espera 3 s y emite
  `nueva-ronda` con `ganador: null`, `motivo: 'todos-eliminados'`, `nivel: 1` y una semilla
  nueva; todos recuperan 3 vidas, vuelven al mapa 1 y reciben spawns nuevos. Un solo
  `reinicioPendiente` evita programar el reinicio dos veces.
- Dificultad: `Dificultad` (cambio) y `PedirDificultad` (estado actual). El cambio se
  acepta solo si `jugadores.size === 0`; si no, se responde con el estado real para que el
  cliente lo corrija (ver sección 6.2).
- `Iniciar` es **idempotente**: si el socket ya estaba registrado conserva su color,
  posición y spawn, y no vuelve a avisar `jugador-entro`, así no se duplica el avatar.
- `disconnect`: elimina al jugador y avisa al resto (misma lógica que `Salir`).

### 11.2 Cliente (`js/red/multijugador.js`)

- `conectarJugador(nombre, modo = 'clasico')` → guarda el nombre (también como último
  recordado), el modo y emite `Iniciar`.
- `desconectarJugador()` → emite `Salir` y olvida el nombre activo (pero recuerda el último).
- `reingresarJugador(nombre, modo = 'clasico')` → emite `Iniciar` con el nombre y el modo
  indicados; se usa al cambiar de vista o de modo aunque ya hubiera una conexión.
- `estaConectado()` → `true` si hay un nombre activo.
- `enviarPosicion(posicion, rotY)` → emite `Posicion` con posición y orientación (se llama
  en cada movimiento del jugador).
- `enviarRecogida(x, z)`, `enviarCima(movimientos)` y `enviarMina(x, z)` → avisan una
  recogida, la llegada a la cima y un golpe de mina. Devuelven `false` sin conexión para
  que la escena resuelva el caso local.
- `iniciarMultijugador({ alEntrar, alMover, alSalir, alIdentificarse, alCambiarDificultad,
  alEstadoPartida, alJugadoresActivos, alPowerupTomado, alVidas, alNuevaRonda,
  alEstadoArcade, alFinArcade, alJugadoresArcade })` → engancha los eventos;
  `alIdentificarse` recibe la identidad propia (`tu-jugador`), `alJugadoresActivos` el
  contador `{ activos, conectados }`, `alVidas` el cambio de vidas, `alNuevaRonda` el
  ganador/la semilla/las posiciones y los callbacks `al*Arcade` el estado autoritativo,
  el resultado y el contador del menú arcade.
- **Reconexión automática**: al evento `connect` de Socket.IO, si hay un nombre guardado
  se reemite `Iniciar` con el modo activo, así el jugador vuelve solo tras un corte de red.

Los avatares remotos son un clon del pato agregado a la escena desde
`js/motor/escena.js`; ya no llevan cubo. El color del jugador se aplica al material
`Yellow` del **cuerpo del pato** (local y remoto) clonando el material, mientras el pico
(`Orange`) y los ojos (`Black`) conservan sus colores originales. El jugador local lleva
el color que el servidor le asigna, así se ve igual en todas las pantallas. Al recibir
`tu-jugador`, `identificarJugador()` también coloca el pato local en la celda de spawn
asignada por el servidor, de modo que cada pestaña empieza en un borde distinto. Si un
`jugador-movio` llega antes que su `jugador-entro` (carrera entre eventos), el avatar se
crea igualmente con ese primer paquete; al llegar después el `jugador-entro` actualiza su
color y nombre.

La **colisión entre jugadores** se resuelve en el cliente: `evaluarCelda()` comprueba las
coordenadas X/Z redondeadas de los avatares remotos y bloquea el movimiento o el salto si
la celda destino está ocupada. No hace falta cambiar el protocolo; con latencia o
movimientos simultáneos puede haber solapamientos transitorios.

`js/util/navegacion.js` avisa cada cambio de vista; `main.js` usa ese aviso para llamar a
`desconectarJugador()` cuando se sale de `vista-juego`/`vista-pausa` hacia el menú, y a
`reingresarJugador()` al volver a entrar. Es decir, **jugar implica estar en línea**: si
hay un nombre en el campo (o uno recordado) se reingresa sin pulsar Conectar de nuevo.

El cliente se sirve desde el propio servidor (`/socket.io/socket.io.js`, incluido en
`index.html`), así que no hace falta CDN ni instalar nada extra.

### 11.3 Cómo probar

1. `npm start` y abrir `http://localhost:4000`.
2. Abrir una **segunda pestaña** en la misma dirección.
3. Escribir un **nombre distinto** en cada pestaña y pulsar **Conectar** en ambas.
4. Pulsar **Jugar** y moverse con **WASD** o las flechas: cada pestaña ve el pato de la
   otra, con el **cuerpo del color** que le asignó el servidor y **girando** igual que en
   la pantalla del otro. Si el pato no mira hacia la dirección pulsada, la primera
   pulsación lo gira y la segunda lo mueve; ambas pestañas ven el giro y el desplazamiento.
   Cada pato aparece en una celda de spawn distinta.
5. Intentar caminar hacia la celda ocupada por el otro pato: el movimiento se bloquea.
6. Para saltar, si el pato ya mira hacia la dirección deseada basta un `Espacio`; si no,
   pulsar primero la tecla de dirección y después `Espacio`. Si la celda de aterrizaje está
   ocupada por el otro pato, el salto no se inicia. Las dos pestañas ven
   el salto completo.
7. Para probar arcade, pulsar **Jugar arcade** en una o dos pestañas: verán el mapa
   15×15, la cuenta regresiva, el cronómetro y el ranking. Moverse a la plataforma
   central 3×3 acumula tiempo; al agotarse los 90 s aparece el ganador y, tras 5 s,
   comienza otra ronda. Las pestañas en clásico no reciben estos eventos.

---

## 12. Animaciones

`js/motor/animaciones.js` concentra las animaciones del jugador.

### 12.1 Salto del pato (squash & stretch)

`crearSalto(objetoVolar, objetoEscalar)` implementa el salto que pide la guía: al
brincar el pato **se estira al subir** y **se aplasta al caer**, deformando
dinámicamente `scale.y`, `scale.x` y `scale.z` en función del tiempo transcurrido
durante la trayectoria.

- **Tecla:** barra espaciadora (solo en la vista de juego; `preventDefault` evita que
  la página haga scroll). Los saltos **se pueden encadenar**: al aterrizar se puede
  volver a saltar (el salto en curso bloquea uno nuevo, pero se libera al terminar).
- **Desplazamiento:** el salto es **direccional**: además de subir, avanza **1 unidad**
  en el plano X/Z hacia la **orientación actual** del jugador (`jugador.rotation.y`),
  es decir hacia donde mira el pato. La dirección se normaliza y el avance es lineal a
  lo largo del salto.
- **Trayectoria:** parábola `y(t) = base(t) + altura · (1 − (2t/T − 1)²)` aplicada al
  **grupo** del jugador (`altura = 1.5`, `T = 0.7 s`, `desplazamiento = 1`). La base se
  interpola entre `yBase` (altura actual) y `yDestino` (altura de la celda destino), así
  el salto sube o baja de nivel y aterriza exactamente sobre la columna destino.
- **Validación:** antes de saltar se evalúa la celda destino con las mismas colisiones
  (límites, minas y muros de más de un nivel). Si es inválida, el salto no se inicia; si
  hay una mina, se aplica el rebote. Durante el salto no se aceptan nuevas órdenes de
  movimiento.
- **Deformación:** se aplica solo al modelo del pato, guardando su escala base.
  - *Subida:* `scale.y` crece hasta `+35 %` y `scale.x/z` encogen proporcionalmente
    (aprox. conservando volumen); la proporción es máxima al impulsarse y llega a
    neutro justo en el pico (sigue el módulo de la velocidad de la parábola).
  - *Bajada:* `scale.y` se encoge hasta `−30 %` y `scale.x/z` crecen; máximo justo
    antes de tocar el suelo.
  - *Aterrizaje:* un aplastamiento sobreactuado de `0.12 s` se recupera hasta la
    escala base, dando la sensación de **peso** al caer.
- **Pausa:** el salto se actualiza dentro del bucle solo con la vista de juego activa,
  así que con Escape (pausa) se congela a mitad de vuelo y continúa al reanudar.
- **Multijugador:** mientras dura el salto se reenvía la posición cada fotograma (el
  evento `Posicion` ya incluía la `y` y la X/Z). El cliente remoto compara la `y`
  entrante contra la altura base de su celda (`alturaEn`) y reproduce su propio salto
  con la misma duración y altura; su X/Z la fijan los paquetes recibidos (no recalcula
  el desplazamiento local), así la deformación acompaña la trayectoria sin doble
  movimiento ni depender de la frecuencia de los paquetes. Al aterrizar, el avatar se
  ajusta a la altura de la celda actual.

### 12.2 Pistas de modelos GLTF/GLB (`AnimationMixer`)

- `cargarModeloGLB` conserva `gltf.animations` en `objeto.userData.animations` (en el OBJ
  no hay pistas, por eso el pato actual no las tiene).
- `crearMezclador(objeto, pistas)` inicializa el **`AnimationMixer`** de Three.js y
  reproduce en loop las pistas incluidas en el archivo; devuelve el mixer para
  actualizarlo con `mixer.update(delta)` en cada fotograma, o **`null`** si el modelo
  no trae animaciones (el resto de la escena sigue funcionando igual).
- Las pistas se buscan tanto en `userData.animations` (como las guarda
  `cargarModeloGLB`) como en `animations` (propiedad directa del objeto), para no
  depender de una convención única.
- `Object3D.clone()` no copia las propiedades personalizadas, por eso cada clon (avatars
  remotos) recibe las pistas de la **plantilla**.
- Al quitar un avatar remoto se llama a `mixer.stopAllAction()` para liberar sus
  acciones.

Para usar un GLB animado basta agregarlo a `MODELOS` en `js/motor/escena.js`:

```js
{ tipo: 'glb', ruta: 'assets/models/mi-pato.glb', nombre: 'Pato', escala: new THREE.Vector3(1, 1, 1) }
```

El pato que se usa en la escena (`assets/models/duck.obj`) fue exportado **sin pistas de
animación**, así que el mixer del pato queda en `null` y el pato se mueve solo con el
squash & stretch procedural del salto y con el *bob* de espera (un `NumberKeyframeTrack`
sobre `bob.position[y]`, que lo sube de `0.5` a `0.58`).

### 12.3 Objetos decorativos animados (procedural)

Tres modelos decorativos se colocan **en una fila por delante de la pirámide** (a la
misma altura que su base, `y = -0.5`) y se animan de forma **procedural** (ninguno trae
pistas en su GLB). Se cargan desde `MODELOS` en `js/motor/escena.js` y se identifican
por `nombre`; el pato (`Duck`) se elige por nombre, no por el orden de la lista. Las
animaciones viven en `js/motor/animaciones.js` y cada una devuelve
`{ actualizar(delta) }`, que se llama dentro del bucle de la vista de juego (se
**congelan en la pausa**).

| Objeto | GLB | Animación | Función |
|---|---|---|---|
| Spring | `assets/models/spring.glb` | Rebote / compresión vertical (squash) | `crearRebote` |
| Escudo | `assets/models/escudo.glb` | Giro continuo sobre sí mismo | `crearGiro` |
| Radar | `assets/models/radar.glb` | Barrido giratorio + pulso leve | `crearBarrido` |

> Las **minas** del juego ya no son un decorativo: son parte de la pirámide
> (`js/motor/piramide.js`), donde la tapa de algunas columnas se dibuja en rojo.

Las funciones (`crearRebote`, `crearGiro`, `crearBarrido`) guardan la escala base del
objeto y oscilan alrededor de ella, sin acumular deriva. Para añadir otro decorativo
basta agregarlo a `MODELOS` y engancharlo en el mapa `DECORATIVOS` de
`js/motor/escena.js`.

### 12.4 Pivotes de los modelos y volteo del escudo

> **Estado: volteo aplicado, posición pendiente.** El escudo ya usa `rotacion` en `MODELOS`
> y `DoubleSide` en su material; falta corregir la altura de `escudo` y `radar` para que no
> queden enterrados. Acá queda la medición de los pivotes reales.

La pirámide no tiene plano de suelo: el nivel de referencia es la base de la fila inferior
de cubos (`y = -0.5`), que es donde se apoyan los decorativos. Para que eso funcione, el
**origen** de cada modelo tiene que quedar en su base, y no es el caso de todos: `escudo` y
`radar` traen la malla **centrada verticalmente** (el nodo del GLB lleva traslación), así
que su origen está en el medio del modelo y no en la base.

| Modelo | bbox del accessor `POSITION` | Traslación del nodo | `escala` | Base real (mundo) | `posicion.y` actual | `posicion.y` para apoyar en `y = -0.5` |
|---|---|---|---|---|---|---|
| Spring | `[-4.795, -1, -4.795]` → `[4.795, 28.2, 4.795]` | (sin traslación) | `0.04` | `-0.500` | `-0.46` | `-0.46` (ya está) |
| Escudo | `[-2.6, 0, -2.6]` → `[2.6, 2.6, 2.6]` | `[0, -1.3, 0]` | `0.22` | `-0.786` | `-0.5` | **`-0.214`** |
| Radar | `[-0.265, 0, -0.204]` → `[0.2, 0.359, 0.204]` | `[0.032, -0.179, 0]` | `3.2` | `-1.074` | `-0.5` | **`+0.074`** |

#### Voltear el escudo 180°

El escudo es un **hemisferio**: el accessor da un bbox de `5.2 × 2.6 × 5.2` (proporción 2:1
exacta, la de un hemisferio de radio `2.6`) y su material es de color por vértice
(`COLOR_0`), sin textura. Con eso:

- **Voltear en Y no se ve.** `crearGiro()` (`js/motor/animaciones.js`) le suma
  `rotation.y` en cada fotograma (`1,2 rad/s`), así que el modelo ya gira 360° de forma
  continua; además es simétrico respecto de Y. Un `rotation.y = Math.PI` inicial solo
  cambia la fase del giro.
- **Voltear en X o Z sí cambia la silueta** (cúpula ↔ cuenco), pero el material `lowpoly`
  viene con `doubleSided: false`: el *culling* de caras traseras está activo, así que al
  dar vuelta el modelo se ve el interior "calado" (con huecos). Para que el volteo se vea
  sólido hay que poner `material.side = THREE.DoubleSide` en su material.
- **Hoy no hay forma de pedir una rotación.** `aplicarTransformacion()`
  (`js/motor/modelos.js`) solo aplica **escala y posición**; para girar habría que agregar
  un campo `rotacion` a la entrada de `MODELOS` (o asignar `objeto.rotation.x` después de
  cargar el modelo).
- Como el color va por vértice, al girar se ve el degradado de la cúpula, no una cara
  nueva con otro diseño.

> El detalle que más afecta a la vista **no es el volteo, sino la posición**: el escudo y el
> radar están medio enterrados bajo el nivel de la base (columna "Base real" de la tabla).
> Corregir `posicion.y` los deja apoyados y ya se los ve completos.

### 12.5 Partículas de efectos

`js/motor/particulas.js` implementa un pool fijo de **480 partículas** dibujadas como un único
`THREE.Points` con `ShaderMaterial`. Cada partícula tiene color, tamaño y transparencia
propios; el círculo se dibuja con `gl_PointCoord`, así que no hacen falta texturas ni
dependencias nuevas. Las partículas son **locales y cosméticas**: no viajan por Socket.IO,
cada cliente las genera a partir de los eventos que recibe.

- **Efectos:** salto y aterrizaje (polvo), mina (chispas + humo), powerup (destello verde),
  llegada a la cima clásica (confeti), entrada/aura en la cima arcade, empuje (impacto),
  teletransporte al spawn y fin de arcade (confeti).
- **Integración:** `escena.js` crea el sistema con `crearParticulas()`, lo actualiza en el
  loop y lo limpia al cambiar de modo, reiniciar ronda o reiniciar arcade. Los emisores
  están centralizados en `emitirEnCelda()`, `emitirEnJugador()`, `emitirConfetiCima()`,
  `emitirAuraCima()`, `emitirImpacto()` y `emitirTeletransporte()`.
- **Apagado:** `?particulas=0` (también `off`, `false` o `no`) desactiva las emisiones. Con
  `prefers-reduced-motion: reduce` la cantidad se reduce a `0.35` y el aura de la cima se
  emite más espaciada.
- **Rendimiento:** no se crean objetos por emisión; el pool se reutiliza en anillo y el
  `delta` se limita a `0.05 s` para evitar saltos después de una pausa.

---

## 13. Orientación (giro hacia la dirección de movimiento)

El grupo del jugador **gira hacia donde avanza** (WASD/flechas), con una transición
suave de `0,15 s` (`DURACION_GIRO` en `js/motor/escena.js`). Si el pato no mira hacia la
dirección pulsada, la **primera pulsación solo lo gira** y la **segunda lo mueve**; si ya
mira, una sola pulsación mueve. Las repeticiones automáticas del teclado (`event.repeat`)
se ignoran, así que mantener la tecla no encadena pasos.

- **Ángulo destino:** al pulsar una tecla de movimiento se calcula con
  `anguloDeDireccion(dirX, dirZ)` → `atan2(dirX, dirZ) + OFFSET_ORIENTACION`, donde
  `dirX`/`dirZ` son −1/0/1 según la tecla. `atan2(dirX, dirZ)` da el ángulo del vector de
  movimiento y el `OFFSET_ORIENTACION` compensa hacia dónde "mira" el modelo por defecto
  (con el GLB actual el frente coincide con el cálculo, así que el offset es `0`).
- **Doble pulsación:** `intentarMovimiento()` compara el ángulo pulsado con `rotObjetivo`
  y con la rotación actual (`miraHacia`). Si no coinciden, solo actualiza `rotObjetivo`
  (y avisa a los demás clientes) y espera; la siguiente pulsación de la misma dirección
  llama a `moverLocal()`, aunque el giro de `0,15 s` siga en curso.
- **Salto:** `intentarSalto()` usa `rotObjetivo`, no la rotación visual. Por eso, si no
  mira hacia la dirección deseada, basta pulsar la tecla de dirección (que fija el
  objetivo) y luego `Espacio`; el salto puede empezar antes de terminar el giro.
- **Interpolación:** `girarHacia(objeto, objetivo, delta)` acerca `rotation.y` al destino
  con un factor `min(1, delta / 0.15)`. La diferencia se normaliza a `[-π, π]`
  (`atan2(sin, cos)`) para girar siempre por el **camino angular más corto** (un giro de
  180° no da la vuelta larga).
- **Sincronización:** la orientación viaja al servidor en `Posicion` (`rotY`) y se
  reenvía en `jugador-movio`. En cada pulsación se envía el **ángulo destino**
  (`rotObjetivo`), para que el receptor empiece a girar sin retraso; y mientras dura el
  giro (`girarHacia` devuelve `true`) se reenvía la rotación ya interpolada en cada
  fotograma, así el movimiento de giro se ve completo en las demás pantallas. Cada avatar
  remoto guarda su propio `rotObjetivo` y usa la misma función `girarHacia`, por lo que
  todos ven el giro igual (sección 11).
- El giro se actualiza dentro del bucle solo con la vista de juego activa, así que la
  pausa también lo congela.

---

## 14. Últimos cambios

### 14.1 Integración de modelos GLB animados y multijugador avanzado

Rama `integracion` (base: `main`, ya con el merge del PR #2), commit `27eb73a` — *Integrar
modelos GLB animados y multijugador avanzado sobre la base de Pato a la Cima* — publicado
en el **PR #3**. 13 archivos, +1091 / −73.

- **Carga de modelos (`js/motor/modelos.js`)**: `crearGestorCarga()` devuelve un
  `LoadingManager` compartido (OBJ y GLB reportan el mismo progreso), `cargarModeloOBJ()`
  carga `.mtl` + `.obj`, `cargarModeloGLB()` carga `.glb`/`.gltf` con el `DRACOLoader`
  enganchado, y `cargarModelos()` los carga en paralelo con `Promise.allSettled`: si un
  modelo falla, la escena sigue funcionando.
- **Animaciones (`js/motor/animaciones.js`, archivo nuevo)**: `crearSalto()` (trayectoria
  parabólica + *squash & stretch* + avance de 1 unidad hacia donde mira), `crearMezclador()`
  (reproduce las pistas de un GLTF/GLB con `AnimationMixer`) y las procedurales
  `crearPulso()`, `crearRebote()`, `crearGiro()` y `crearBarrido()` para los decorativos.
- **Escena (`js/motor/escena.js`)**: tabla `MODELOS` (el pato OBJ más `spring`, `escudo` y
  `radar` en GLB), mapa `DECORATIVOS` que engancha la animación de cada uno, el subgrupo
  `bob` con un `NumberKeyframeTrack` para la respiración del pato, el salto direccional y
  el giro del jugador hacia la dirección de movimiento (`girarHacia`, interpolado).
- **Multijugador (`servidor.js` y `js/red/multijugador.js`)**: color por jugador, `rotY`
  (orientación) y detección de salto en el servidor; reenvío de `jugador-entro`,
  `jugador-movio` y `jugador-salio`.
- **Recursos**: `duck.glb`, `escudo.glb`, `radar.glb`, `resorte.glb` y `spring.glb`
  agregados a `assets/models/`.
- **README**: secciones 10 (carga de modelos), 11 (multijugador), 12 (animaciones) y 13
  (orientación).

### 14.2 Verificaciones

- `node --check` sin errores en los 11 archivos JS del proyecto.
- Flujo de Socket.IO probado extremo a extremo contra el servidor en `:4000`: `jugadores`,
  `tu-jugador`, `jugador-entro`, `jugador-movio` (con `rotY`), `jugador-salio` y los colores
  `#39ff14` / `#00a2ff`.
- Los 11 JS que sirve el servidor por HTTP coinciden con el working tree.
- Los 5 GLB responden `Content-Type: model/gltf-binary`.

### 14.3 Modelos: qué se aplicó

- El pato del jugador pasó a `duck.glb` con escala `0.51` y `posicion.y = 0.2` (sección 10.3).
- El escudo se voltea 180° con el campo `rotacion` de `MODELOS` y su material usa
  `DoubleSide` (sección 12.4).
- Sigue pendiente corregir la altura de `escudo` y `radar`, que quedan medio enterrados
  (sección 12.4).

---

## 15. Vidas, rondas y vista cenital

### 15.1 Vidas

- Cada jugador arranca con **3 vidas**, dibujadas como tres círculos en el HUD
  (`#hud-vidas`, `js/motor/hud.js`).
- **Pisar una mina sin escudo** resta 1 vida, aplica el rebote de una celda y aturde 2 s
  (el pato parpadea). Con **escudo**, la mina se consume y el pato ocupa su celda: no resta
  vida, no aturde ni rebota, y el movimiento o salto continúa con normalidad. La mina sigue
  armada para el próximo paso sin escudo (`evaluarCelda`/`golpearMina`, `js/motor/escena.js`).
- Con **0 vidas** el pato queda como **espectador visible**: no se mueve, no salta y no
  recoge. El HUD muestra `Sin vidas · esperando al ganador` y el servidor rechaza sus
  `Recoger` y `Cima`.
- El servidor valida cada golpe en el evento `Mina`: la celda debe ser mina con la
  dificultad y la semilla activas, el jugador debe estar a 2 celdas o menos y hay un
  enfriamiento de 600 ms para ignorar avisos repetidos.
- Sin socket, la escena resta la vida localmente.

### 15.2 Rondas

- Al llegar a la cima `(0,0)`, el cliente emite `Cima` con la cuenta de movimientos.
- El servidor llama a `avanzarNivel()`: si estaba en el nivel 1 o 2, emite `nueva-ronda`
  con `motivo: 'nivel'` y el mapa siguiente; si estaba en el 3, emite `motivo: 'partida'`
  y vuelve al nivel 1. En ambos casos reparte **semilla nueva**, spawns y **3 vidas para
  todos**, y limpia powerups tomados y enfriamientos.
- **Todos eliminados:** si ningún jugador tiene vidas, el servidor espera 3 s (para que se
  vea el último rebote y aturdimiento) y emite `nueva-ronda` con `ganador: null`,
  `motivo: 'todos-eliminados'` y `nivel: 1`. La espera se cancela si alguien entra durante
  esos 3 s y vuelve a haber un jugador con vidas.
- El cliente reinicia inventario, contador, aturdimiento y radar, reconstruye el mapa si
  cambió el nivel, muestra el cartel (`Nivel 2 · …`, `¡Partida completa! …` o
  `Todos eliminados · volvemos al nivel 1`) durante 3,5 s y reubica al pato local y a los
  remotos en sus spawns.
- Sin socket, el cliente aplica la misma progresión solo en esa pantalla.
- **Limitación:** un eliminado que sale y vuelve a entrar recibe 3 vidas nuevas, porque el
  servidor lo registra como un jugador nuevo.

### 15.3 Vista cenital (`V`)

- La cámara isométrica sigue siendo la predeterminada. La tecla **`V`** alterna a una vista
  cenital (`0, 18, 0.01` mirando al centro) y vuelve a la isométrica.
- El cambio es **solo local**: no se envía al servidor y no altera la cámara de los demás.
- La vista cenital usa `camera.up = (0, 0, -1)` para evitar el `lookAt` degenerado al mirar
  desde arriba; al volver se restaura `up = (0, 1, 0)`.

**Prueba sugerida (dos pestañas conectadas):**

1. Pisar tres minas sin escudo: las vidas bajan de 3 a 0 y el HUD muestra el aviso de
   espectador; el pato deja de responder.
2. Agarrar un escudo y pisar (o saltar a) una mina: el escudo pasa a `Vacío`, el pato ocupa
   la celda y no pierde vida ni se aturde.
3. Sin escudo, volver a pisar esa misma mina: rebote, parpadeo, 2 s de aturdimiento y una
   vida menos.
4. Con un jugador eliminado, comprobar que el servidor rechaza su `Recoger` y su `Cima`.
5. Que **todos** los jugadores lleguen a 0 vidas: tras 3 s arranca una ronda nueva, ambos
   recuperan 3 vidas y cada pato vuelve a un spawn distinto (cartel `Todos eliminados`).
6. Que otro jugador llegue a la cima: ambos pasan al nivel 2, recuperan 3 vidas, los
   powerups reaparecen y cada pato vuelve a un spawn distinto.
7. Repetir la llegada en los niveles 2 y 3: al ganar el 3 se vuelve al nivel 1 con una
   semilla nueva.
8. Que todos lleguen a 0 vidas desde el nivel 2 o 3: tras 3 s la partida vuelve al nivel 1.
9. Pulsar `V`: solo la pestaña que lo pulsa cambia a vista cenital; la otra sigue igual.

---

## 16. Plan del modo arcade

> **Estado:** implementado. El modo clásico conserva su comportamiento y las salas
> `clasico` y `arcade` pueden coexistir en pestañas distintas.

### 16.1 Objetivo y reglas

- Añadir un modo **Arcade** separado del clásico de “llegar a la cima”.
- La partida dura **90 segundos** y gana quien acumule **más tiempo en la cima**.
  El tiempo es acumulado, no consecutivo: entrar y salir de la cima suma ratos.
- Empate técnico si dos o más jugadores terminan con el mismo tiempo máximo.
- Un solo mapa grande, sin niveles: radio **7** (**15×15**), altura máxima **7**.
- La cima es una plataforma **3×3** a altura 7.
- Sin minas, sin vidas y sin powerups.
- Ocho spawns en el borde:
  `(0,7)`, `(7,0)`, `(0,-7)`, `(-7,0)`, `(3,7)`, `(-3,7)`, `(7,3)`, `(7,-3)`.
- Salas separadas por modo: clásico y arcade pueden coexistir en pestañas distintas.
- Cuenta regresiva de **3 s** antes de empezar y reinicio automático a los **5 s**.
- Quien entra tarde arranca con **0 s** de tiempo en cima.
- El modo arcade funciona también sin servidor (partida local).
- Con servidor, el **tiempo y el ranking son autoritativos del servidor**.
- **Limitación de pausa:** en local la pausa congela el cronómetro; en multijugador
  el reloj del servidor sigue avanzando aunque la pestaña esté en pausa.
- Los resultados de arcade **no** se guardan en MySQL.

### 16.2 Arquitectura implementada

Se mantuvo el estado clásico y se añadió un estado arcade paralelo:

- `servidor.js` conserva `jugadores`/`partida` para el clásico y añade
  `jugadoresArcade`/`arcade` para el arcade. Los eventos se separan con las salas
  `clasico` y `arcade`.
- `js/motor/piramide.js` exporta `MODOS`, `radioDe`, `spawnsDe` y `esCimaArcade`;
  `alturaEn`, `crearPiramide`, `celdasMina`, `marcarMinas`, `aplicarTipoTapa` y
  `powerupsDelTablero` aceptan el modo con `clasico` por defecto.
- `js/motor/escena.js` mantiene `modoActual`/`radioActual`, reconstruye el tablero en
  `cambiarModo(modo)`, usa cámara y luz propias del arcade y ejecuta una partida local
  mientras no llega `arcade-estado` del servidor.
- `js/main.js` guarda el modo elegido en el menú, llama a `escena.cambiarModo()` y
  reingresa al jugador con ese modo.
- El arcade nunca toca minas, vidas, inventario ni powerups; la victoria clásica de
  `(0,0)` no se evalúa en arcade.

### 16.3 Mapa y contrato compartido

En `js/motor/piramide.js` y su copia de `servidor.js`:

- Añadir `MODOS = { clasico, arcade }`.
- Añadir `RADIO_POR_MODO = { clasico: 4, arcade: 7 }`.
- Añadir `SPAWNS_POR_MODO` con los spawns de cada modo.
- Generalizar las funciones:
  - `alturaEn(ix, iz, nivelJuego = 1, modo = 'clasico')`
  - `radioDe(modo)`
  - `spawnsDe(modo)`
  - `esCimaArcade(ix, iz)`
- Fórmula del mapa arcade:
  `Math.min(7, 8 - Math.max(|ix|, |iz|))`.
- La cima arcade cumple `|ix| <= 1 && |iz| <= 1` y queda a altura 7.
- Actualizar `crearPiramide`, `marcarMinas`, `celdasMina`, `powerupsDelTablero` y
  `aplicarTipoTapa` para aceptar el modo, manteniendo `clasico` como valor por defecto.
- Añadir una paleta arcade distinta; no reutilizar la paleta del nivel 1.
- En arcade no se generan minas ni powerups.

### 16.4 Servidor: salas paralelas sin reescribir el clásico

- Salas Socket.IO: `clasico` y `arcade`.
- `Iniciar` debe aceptar tanto `"nombre"` como `{ nombre, modo }`.
- Antes de registrar, sacar al socket de la sala/modo anterior para evitar duplicados.
- Clásico: `socket.join('clasico')`; cambiar sus emisiones de avatares y rondas a
  `socket.to('clasico')` / `io.to('clasico')`.
- Mantener `jugadores-activos` global para el contador del menú clásico y añadir un
  contador separado para arcade.

Estado arcade implementado:

| Constante | Valor |
|---|---|
| `DURACION_ARCADE` | 90 s |
| `CUENTA_ARCADE` | 3 s |
| `REINICIO_ARCADE` | 5 s |
| `TICK_ARCADE` | 250 ms |
| `RADIO_ARCADE` | 7 |

- `jugadoresArcade: Map` con
  `{ id, nombre, color, x, y, z, rotY, tiempoCima, enCima }`.
- Estado
  `arcade = { estado, ronda, inicio, fin, restante, transcurrido, ultimoTick, ranking }`.
- Estados: `espera | cuenta | jugando | fin`.
- `Iniciar` crea al jugador con `tiempoCima: 0`, `enCima: false`, color y spawn arcade.
- `Posicion` actualiza posición y `enCima`; emite `jugador-movio` solo a la sala arcade.
- El tick del servidor acumula `tiempoCima` mientras `enCima` sea verdadero.
- Al terminar: ranking por `tiempoCima` descendente, ganador o empate, y evento
  `arcade-fin`.
- Tras 5 s: reposicionar jugadores, resetear tiempos y volver a `cuenta` si queda alguien.
- Si no queda nadie: cancelar timers y volver a `espera`.
- Si todos salen durante `fin`, se cancela el reinicio pendiente.

Payload implementado de `arcade-estado`:

```json
{
  "estado": "jugando",
  "ronda": 4,
  "restante": 42.5,
  "transcurrido": 47.5,
  "duracion": 90,
  "cuentaRestante": 0,
  "jugadores": [
    {
      "id": "...",
      "nombre": "Pato",
      "color": "#39ff14",
      "x": 0,
      "y": 7,
      "z": 0,
      "rotY": 0,
      "tiempoCima": 12.3,
      "enCima": true
    }
  ],
  "ranking": [
    { "id": "...", "nombre": "Pato", "tiempoCima": 12.3 }
  ]
}
```

Payload implementado de `arcade-fin`:

```json
{
  "ganador": { "id": "...", "nombre": "Pato", "tiempoCima": 34.2 },
  "empate": false,
  "ranking": [
    { "id": "...", "nombre": "Pato", "tiempoCima": 34.2 }
  ]
}
```

Eventos nuevos: `arcade-estado`, `arcade-fin`, `arcade-jugadores`.

### 16.5 Cliente de red y navegación

- `conectarJugador(nombre, modo = 'clasico')`.
- `reingresarJugador(nombre, modo = 'clasico')`: si ya está conectado pero el modo
  cambió, reemitir `Iniciar` con el nuevo modo.
- Guardar `modoJugador` para la reconexión automática.
- Añadir callbacks `alEstadoArcade`, `alFinArcade`, `alJugadoresArcade` en
  `iniciarMultijugador`.
- `js/util/navegacion.js`: pasar los datos del botón, incluido `data-modo`, al callback
  de cambio de vista.
- `js/main.js`:
  - Mantener el estado `modoActual`.
  - Al entrar a `vista-juego`: `escena.cambiarModo(modoActual)` y luego
    `reingresarJugador(nombre, modoActual)`.
  - Al salir: `desconectarJugador()`.
  - Actualizar contadores de menú por modo.

### 16.6 Escena 3D

En `js/motor/escena.js`:

- `modoActual` y `radioActual` sustituyen al radio fijo del clásico.
- `cambiarModo(modo)` destruye y recrea el tablero, vacía minas/powerups en arcade,
  limpia avatares remotos, reposiciona al jugador en el spawn del modo y ajusta cámara
  y luz focal.
- `estaEnRango`, `cajaDeColumna`, `refrescarTapas`, `construirPowerups` y el movimiento
  de remotos usan `radioActual` y `alturaEn(..., modoActual)`.
- En arcade se omite por completo la lógica de minas, vidas, inventario, powerups y
  llegada a cima clásica.
- Estado arcade local: cuenta regresiva de 3 s, partida de 90 s, acumulación en cima
  cuando `|x| <= 1 && |z| <= 1`, resultado local y reinicio a los 5 s. Se desactiva en
  cuanto llega `arcade-estado` del servidor.
- Partículas de arcade: confeti al entrar a la cima, aura mientras se acumula tiempo,
  impacto al empujar, ráfaga al teletransportarse y confeti al terminar. Son locales y se
  apagan con `?particulas=0` (ver 12.5).
- El movimiento se bloquea durante `cuenta` y `fin`; `aplicarEstadoArcade(estado)` y
  `aplicarFinArcade(datos)` sincronizan el estado autoritativo y `identificarJugador`
  usa `datos.modo` y el spawn recibido.

Cámara y luz implementadas:

- Clásico: mantener `(14, 14, 14)` mirando a `(0, 2, 0)`.
- Arcade: subir la cámara a una posición aproximada `(24, 26, 24)` mirando a
  `(0, 3, 0)`.
- Aumentar el alcance de `luzFocal` a unos 60 y el `far` de sus sombras a unos 80.

### 16.7 HUD, menú y estilos

- Menú con dos botones:
  - `Jugar clásico` → `data-vista="vista-juego" data-modo="clasico"`.
  - `Jugar arcade` → `data-vista="vista-juego" data-modo="arcade"`.
- HUD arcade:
  - Indicador de modo.
  - Cronómetro de partida.
  - Tiempo personal en cima.
  - Ranking en vivo.
  - Ocultar nivel, vidas, movimientos e inventario.
  - Reutilizar `#hud-estado` para “Cuenta regresiva”, “Tiempo agotado” y
    “Esperando jugadores”.
  - Reutilizar `#fin-partida` para el resultado y el empate.
- IDs usados: `#hud-modo`, `#hud-arcade-tiempo`, `#hud-arcade-cima`,
  `#hud-arcade-ranking` y `#menu-jugadores-arcade`.
- CSS:
  - Clase `.modo-arcade` en `#vista-juego`.
  - Clases `.hud__panel--clasico` y `.hud__panel--arcade` para alternar paneles.
  - Estilos de ranking y botón `.boton--arcade`.

### 16.8 Orden de implementación

1. Mapa y contrato compartido (`piramide.js` + `servidor.js`).
2. Salas, estado arcade y tick del servidor.
3. Red cliente, navegación por modo y `main.js`.
4. Escena 3D, cámara, estado local y aplicación del estado del servidor.
5. HUD, menú y CSS.
6. Documentación final y pruebas.

### 16.9 Pruebas realizadas y criterios de aceptación

Verificado:

- `node --check servidor.js` y comprobación de sintaxis de los módulos ES modificados.
- Servidor Socket.IO con clientes de prueba: separación `clasico`/`arcade`,
  `Iniciar` con modo, cuenta regresiva, estado `jugando`, acumulación en cima,
  ranking y ausencia de cruce de `arcade-estado`/`jugador-movio` entre salas.
- Fin de partida y reinicio automático con una copia temporal de duración reducida:
  ranking ordenado, ganador, `arcade-fin`, nueva ronda y tiempos reseteados a 0.
- Navegador headless con `three` real: arcade local sin nombre, HUD de modo,
  cronómetro, ranking, desplazamiento hasta la cima, acumulación de tiempo en cima
  y regreso al HUD clásico al cambiar de modo.
- Navegador headless conectado al servidor: `Iniciar` con nombre y cambio a modo
  arcade, ranking recibido por `arcade-estado` y acumulación autoritativa tras llegar
  a la cima.
- Los resultados de arcade no llaman a `api/` ni a `puntuaciones.js`, por lo que no
  tocan MySQL.

Pendiente de comprobación manual final: partida completa de 90 s con dos pestañas
reales, entrada tardía y salida de todos durante `fin`.

Criterios de aceptación:

- El modo clásico sigue funcionando exactamente como antes.
- Clásico y arcade pueden coexistir en pestañas distintas sin verse entre sí.
- Arcade no tiene minas, vidas ni powerups.
- Gana quien acumule más tiempo en la cima en 90 s.
- La cima es la plataforma 3×3 de altura 7.
- El servidor es la fuente del tiempo y del ranking cuando hay conexión.
- Arcade funciona también sin servidor.
- No se guardan puntuaciones arcade en MySQL.