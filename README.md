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

Eso crea la base `gcw`, la tabla `score` y tres registros de ejemplo.

Si tu consola no soporta `source`, abre el archivo desde phpMyAdmin (Menu > MySQL >
phpMyAdmin), seleccioná la base `gcw` y pegá el contenido.

### 2.3 WebService PHP en Apache

El código PHP **no puede ejecutarse desde Express**, así que lo sirve Apache. Hay que
exponer la carpeta `api/` del proyecto bajo `http://localhost/api`.

Copiá el archivo `api/apache-alias.conf` al directorio de aliases de Laragon:

```bash
copy api\apache-alias.conf C:\laragon\etc\apache2\alias\api.conf
```

Si clonaste el proyecto en otro directorio, **editá la ruta `Alias` dentro de ese
archivo antes de copiarlo**.

Después reiniciá Apache desde Laragon (**Menu > Apache > Stop**, luego **Start All**).

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
│   ├── WebServices.php     INSERT de puntuaciones
│   ├── puntuaciones.php    GET de puntuaciones en JSON
│   ├── schema.sql          Creación de la base y datos de ejemplo
│   └── apache-alias.conf   Configuración para exponer api/ en Apache
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
│   │   └── animaciones.js  Salto (squash & stretch) + AnimationMixer + decorativos
│   ├── red/
│   │   ├── formulario.js   Envío de score
│   │   ├── puntuaciones.js Lectura y envío contra el WebService
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

- `enviarPuntuacion(nombre, score)` → hace el INSERT
- `cargarPuntuaciones()` → pinta el resultado en la tabla

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
| Configuraciones | Lista. Volumen, sonido y dificultad (persisten en LocalStorage) |
| Puntuaciones | Lista. Formulario para guardar score + tabla desde MySQL |
| Pausa | Lista. Reanudar y salir |
| HUD de juego | Maquetado. Indicador de niveles (1–5) y cronómetro |

---

## 6. Motor 3D

`js/motor/escena.js` arma la escena con Three.js (WebGL) en **vista isométrica**: la
cámara se sitúa en `(14, 14, 14)` y mira al centro de la pirámide (`lookAt(0, 2, 0)`), con
FOV de `60` para reducir la deformación de perspectiva.

La escena se compone de:

- **Pirámide** (`js/motor/piramide.js`): base de `9×9` columnas y `5` niveles de altura,
  calculada por distancia de Chebyshev al centro. Cada cubo tiene tres tonos de color y
  un contorno negro (técnica del cubo ligeramente agrandado con `BackSide`). La tapa de
  algunas columnas es una **mina** (rojo) en lugar de un cubo seguro (menta).
- **Jugador**: un grupo con un **cubo hitbox** (recibe el color que asigna el servidor) y
  dentro un subgrupo `bob` con el pato (`assets/models/duck.obj`). El `bob` sube y baja
  con un `NumberKeyframeTrack` (de `0.5` a `0.58`), de modo que el pato queda apoyado
  sobre el techo del cubo y respira suavemente. El grupo se mueve con **WASD** o las
  **flechas**, en pasos de `1` sobre el plano X/Z, con límites `X ∈ [-4, 4]` y
  `Z ∈ [-4, 4]`.
- **Decorativos**: los modelos GLB `spring`, `escudo` y `radar` colocados en una fila por
  delante de la pirámide, con animación procedural (ver sección 12.3).
- **Luces**: ambiental (`0xffffff`, `0.5`) y direccional (`0xffffff`, `1.2`) desde
  `(10, 12, 10)`. Las geometrías usan `MeshPhongMaterial` para reaccionar a esas luces.

Con la **barra espaciadora** el pato **salta y avanza 1 unidad hacia donde mira**, con
deformación *squash & stretch*; el grupo además **gira hacia la dirección de movimiento**
de forma interpolada (~0,15 s), por el camino angular más corto (ver secciones 12 y 13).

El render solo corre cuando la vista de juego está activa, así que en el menú y durante
la pausa el bucle se detiene.

---

## 7. Estado del proyecto

Funciona:

- Transición entre las cinco vistas
- Preferencias persistentes en LocalStorage
- WebService PHP/MySQL: guardar y leer puntuaciones
- Inicio de sesión con Facebook (SDK JS) mostrando nombre y foto del perfil
- Vista isométrica con pirámide de cubos, niveles y minas (`js/motor/piramide.js`)
- Carga de modelos 3D (OBJ/MTL y GLB) con `LoadingManager` compartido y soporte Draco
- Movimiento del jugador por teclado (WASD + flechas) con límites
- Salto direccional con animación *squash & stretch* (Espacio, avanza hacia donde mira), sincronizado en multijugador
- Giro del jugador hacia la dirección de movimiento, sincronizado (ver sección 13)
- `AnimationMixer` listo para reproducir pistas de modelos GLTF/GLB (ver sección 12)
- Objetos decorativos animados: spring, escudo y radar (ver sección 12.3)
- Multijugador con Socket.IO: color por jugador, orientación (rotY), salto y entrada/salida

Pendiente:

- **Lógica de juego.** El jugador ya se mueve, pero no hay colisiones ni detección de
  escalón (subir/bajar de nivel), puntuación real, vidas ni fin de partida. El indicador
  de niveles y el cronómetro del HUD son valores fijos.
- **Sonido.** Las preferencias de volumen y sonido se guardan, pero no hay audio que
  reproducir ni archivos en `assets/audio`.
- **Dificultad.** Se selecciona y se guarda, pero nada la lee todavía.
- **Vincular Facebook con el score.** El login no rellena todavía el formulario de
  puntuaciones ni guarda progreso por usuario.

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

Los GLB decorativos (`spring`, `escudo`, `radar`) usan la extensión
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

### 10.2 Modelos incluidos

| Archivo | Uso |
|---|---|
| `assets/models/duck.obj` (+ `.mtl`, `.png`) | El pato del jugador (OBJ, con textura) |
| `assets/models/duck.glb` | El mismo pato en GLB (disponible, no usado en escena) |
| `assets/models/spring.glb` | Decorativo: resorte (GLB comprimido con Draco) |
| `assets/models/escudo.glb` | Decorativo: escudo (GLB comprimido con Draco) |
| `assets/models/radar.glb` | Decorativo: radar (GLB comprimido con Draco) |
| `assets/models/resorte.glb` | Reservado (no se usa en escena) |

---

## 11. Multijugador (Socket.IO)

El servidor usa Socket.IO sobre el mismo HTTP de Express, en el puerto **4000**.

### 11.1 Servidor (`servidor.js`)

- `const io = new Server(server)`.
- `jugadores`: un `Map` identificado por `socket.id` (evita colisiones de nombres) con
  `{ id, nombre, color, x, y, z, rotY }` (`rotY` es la orientación).
- `elegirColor()`: asigna a cada jugador el primer color libre de `PALETA`, así el
  servidor es la **única fuente del color** y todos (incluido uno mismo) lo ven igual.
- Eventos recibidos: `Iniciar` (registra al jugador y le manda la lista de los demás),
  `Posicion` (actualiza y reenvía a los demás, posición + `rotY`) y `Salir` (saca al
  jugador sin cerrar la pestaña, al volver al menú).
- Eventos emitidos: `jugadores`, `tu-jugador` (identidad propia: id + color),
  `jugador-entro`, `jugador-movio`, `jugador-salio`.
- `Iniciar` es **idempotente**: si el socket ya estaba registrado conserva su color y no
  vuelve a avisar `jugador-entro`, así no se duplica el avatar.
- `disconnect`: elimina al jugador y avisa al resto (misma lógica que `Salir`).

### 11.2 Cliente (`js/red/multijugador.js`)

- `conectarJugador(nombre)` → guarda el nombre (también como último recordado) y emite `Iniciar`.
- `desconectarJugador()` → emite `Salir` y olvida el nombre activo (pero recuerda el último).
- `reingresarJugador(nombre)` → si no está conectado, emite `Iniciar` con el nombre pasado o el último recordado.
- `estaConectado()` → `true` si hay un nombre activo.
- `enviarPosicion(posicion, rotY)` → emite `Posicion` con posición y orientación (se llama
  en cada movimiento del jugador).
- `iniciarMultijugador({ alEntrar, alMover, alSalir, alIdentificarse })` → engancha los
  eventos; `alIdentificarse` recibe la identidad propia (`tu-jugador`).
- **Reconexión automática**: al evento `connect` de Socket.IO, si hay un nombre guardado
  se reemite `Iniciar`, así el jugador vuelve solo tras un corte de red.

Los avatares remotos son un grupo con el cubo (color identidad del jugador) más un clon
del pato con sus colores originales, agregados a la escena desde `js/motor/escena.js`. El
color del jugador se aplica **solo al cubo** (local y remoto); el pato no se tiñe. El
jugador local lleva el color que el servidor le asigna, así se ve igual en todas las
pantallas. Si un `jugador-movio` llega antes que su `jugador-entro` (carrera entre
eventos), el avatar se crea igualmente con ese primer paquete; al llegar después el
`jugador-entro` solo se actualizan su color y nombre.

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
4. Pulsar **Jugar** y moverse con **WASD** o las flechas: cada pestaña ve el pato y el
   cubo de la otra, con **el color** que le asignó el servidor y **girando** igual que en
   la pantalla del otro.
5. Con la **barra espaciadora** el pato salta y avanza hacia donde mira; las dos pestañas
   ven el salto completo.

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
- **Trayectoria:** parábola `y(t) = altura · (1 − (2t/T − 1)²)` aplicada al **grupo**
  del jugador (`altura = 1.5`, `T = 0.7 s`, `desplazamiento = 1`), no al pato: el cubo
  hitbox vuela con él.
- **Límites:** durante el salto se recorta X/Z a los bordes del área jugable
  (`X ∈ [-4, 4]`, `Z ∈ [-4, 4]`, la base de la pirámide) para que el avance no saque al
  jugador del recinto.
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
  evento `Posicion` ya incluía la `y` y la X/Z). El cliente remoto detecta el vuelo por
  la `y` entrante y reproduce su propio salto con la misma duración y altura; su X/Z la
  fijan los paquetes recibidos (no recalcula el desplazamiento local), así la
  deformación acompaña la trayectoria sin doble movimiento ni depender de la frecuencia
  de los paquetes.

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

---

## 13. Orientación (giro hacia la dirección de movimiento)

El grupo del jugador **gira hacia donde avanza** (WASD/flechas), con una transición
suave de `0,15 s` (`DURACION_GIRO` en `js/motor/escena.js`).

- **Ángulo destino:** al pulsar una tecla de movimiento se calcula
  `rotObjetivo = atan2(dirX, dirZ) + OFFSET_ORIENTACION`, donde `dirX`/`dirZ` son −1/0/1
  según la tecla. `atan2(dirX, dirZ)` da el ángulo del vector de movimiento y el
  `OFFSET_ORIENTACION` compensa hacia dónde "mira" el modelo por defecto (con el GLB
  actual el frente coincide con el cálculo, así que el offset es `0`).
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