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
├── js/
│   ├── main.js             Punto de entrada
│   ├── config/
│   │   └── preferencias.js Guardado en LocalStorage
│   ├── motor/
│   │   ├── escena.js          Escena 3D, bucle de juego y HUD
│   │   ├── piramide.js        Cubos de pirámide/torre/islas, minas y agua
│   │   ├── coleccionables.js  Objetos y racha de puntos
│   │   ├── obstaculos.js      Tortugas bloqueadoras y hierba
│   │   ├── pato.js            Modelo del pato
│   │   ├── selector-patos.js  Selección de pato
│   │   └── explosion.js       Efecto al perder una vida
│   ├── red/
│   │   ├── formulario.js      Envío de score
│   │   ├── puntuaciones.js    Lectura y envío contra el WebService
│   │   └── multijugador.js    Socket.IO (sala, movimiento y escenario)
│   └── util/
│       └── navegacion.js   Transición entre vistas
└── assets/                 Modelos, texturas y audio (vacíos por ahora)
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
| Menú inicial | Listo. Solitario/Multijugador, ranking TOP 10 y login de Facebook |
| Configuraciones | Listo. Volumen y sonido (persisten en LocalStorage) |
| Puntuaciones | Listo. Formulario para guardar score + tabla desde MySQL |
| Pausa | Lista. Reanudar y salir |
| HUD de juego | Listo. Nivel, score, vidas, cronómetro y barra de Agua en La Pirámide |

---

## 6. Motor 3D y jugabilidad

`js/motor/escena.js` arma la escena con Three.js y gestiona el bucle de juego, el pato,
la cámara, el HUD, los coleccionables y la comunicación con Socket.IO. Los escenarios se
construyen en `js/motor/piramide.js` con instancias de cubos; los objetos están en
`js/motor/coleccionables.js`, los obstáculos en `js/motor/obstaculos.js` y los efectos en
`js/motor/explosion.js` y `nubes.js`.

### Escenarios

- **La Pirámide** — 11 niveles, salida en `(0,10)` y victoria al llegar al centro. Un
  lago azul sólido sube 1 nivel cada 9s en Carrera y cada 6s en Rey; recoger hojas lo
  baja 1 nivel. Si el agua alcanza al pato se pierde una vida y el agua retrocede 3
  niveles. La cámara es frontal fija: no se puede volver a la mitad trasera (`z < 0`),
  pero sí se puede bajar. Alrededor del 22% de los cubos seguros pisados se
  desprenden poco después; las minas dinámicas avisan naranja → rojo antes de activarse.
- **Torre e Islas** — conservan la cámara orbital, la saciedad/nube como condición de
  victoria y las minas dinámicas sin aviso.

En los 3 escenarios hay **tortugas** que bloquean su celda y patrullan de 2 a 3 casillas
en eje X, y **hierba** que se consume al pisarla y hace que el siguiente salto dure
0.75s en vez de 0.45s. Hay 6/10/14 hierbas según dificultad y reaparecen de a 2 cada
4s. En La Pirámide nunca aparecen en la mitad trasera (`z < 0`). Se ubican sobre la
tapa del cubo y spawnean cerca de la altura actual del pato. Al bajar de nivel, las
tortugas invierten su sentido de patrulla.

La dificultad (`facil`, `normal`, `dificil`) ajusta la cantidad de minas, objetos,
tortugas y hierba. El modo `carrera` desactiva las minas dinámicas en La Pirámide para
centrar el reto en el agua; `rey` las mantiene.

---

## 7. Estado del proyecto

Funciona:

- Tres escenarios con vidas, score, racha, cronómetro, HUD y pantallas de victoria/derrota
- WebService PHP/MySQL: guardar y leer puntuaciones, con ranking en el menú
- Login de Facebook (nombre y foto) y multijugador global simple con Socket.IO
- Menú responsive con ranking móvil de 5 filas y botón "Ver más"
- La Pirámide: agua que sube, aviso de minas, cubos que caen y cámara/movimiento restringido
- Tortugas que patrullan y bloquean el paso, y hierba que retrasa el siguiente salto

Pendiente:

- **Sonido.** Las preferencias de volumen y sonido se guardan, pero no hay audio.
- **Control táctil.** El juego se maneja solo con teclado.
- **Vincular Facebook con el score.** El login no rellena el formulario ni guarda progreso por usuario.

---

## 8. Notas

- El proyecto usa Three.js desde unpkg mediante `importmap`, no desde npm.
- Los helpers `DirectionalLightHelper` y `PointLightHelper` se dibujan en pantalla a
  propósito, para poder ver las luces.

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