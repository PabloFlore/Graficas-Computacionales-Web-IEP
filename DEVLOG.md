# DEVLOG — Pato a la Cima

Historial de cambios y decisiones de desarrollo.

---

## 2026-11-23

### La Pirámide: lago, cámara fija y cubos inestables

**Lago que sube**
- Capa azul sólida de 160×160 en `piramide.js`; sube 1 nivel cada 9s en Carrera y cada 6s en Rey
- HUD "Agua X/11" en vez de Hambre; recoger hojas baja el agua 1 nivel
- Si el agua alcanza al pato: pierde una vida, el agua retrocede 3 niveles y reaparece en la salida
- Victoria al llegar al centro (nivel 11) sin depender de la barra de saciedad

**Cámara y movimiento**
- Cámara frontal fija en La Pirámide (`Math.PI / 2`) al iniciar y al respawnear
- Se bloqueó avanzar hacia las orillas (radio creciente) y pasar a la mitad trasera (`z < 0`)
- Torre e Islas conservan cámara orbital y movimiento completo

**Minas con aviso**
- Las minas dinámicas se pintan naranja 1.1s, rojo 1.0s y luego se activan
- Se eliminó el parpadeo: las minas existentes quedan rojo fijo
- Carrera sigue sin minas dinámicas; Rey mantiene minas con aviso

**Cubos que caen**
- ~22% de los cubos seguros pisados se desprenden 0.9s después, con giro y caída
- Si el pato se queda en esa celda pierde una vida; la celda queda bloqueada
- La salida y la cima quedan protegidas

**Obstáculos: tortugas y hierba**
- Nuevo `js/motor/obstaculos.js` con mallas procedurales low-poly y spawn por dificultad en los 3 escenarios
- Tortuga: bloquea su celda, patrulla en eje X 2 celdas (fácil) o 3 (normal/difícil), 1 celda cada 1.5/1.2/0.9s
- La tortuga invierte sentido en extremos y evita minas, cubos caídos, items, inicio, centro y celdas ocupadas por el pato
- Hierba: al aterrizar se consume y el siguiente salto dura 0.75s en vez de 0.45s; hay 6/10/14 según dificultad y reaparecen de a 2 cada 4s
- Spawn excluye siempre `z < 0` en La Pirámide (cubos café)
- Corregida visibilidad: los obstáculos se colocan sobre la tapa del cubo (`+1`) y spawnean hasta 3 niveles por encima del pato; se recolocan al respawnear
- El pato ya puede bajar en La Pirámide: se quitó el guard de radio, pero `z < 0` sigue bloqueado
- Al aterrizar en un nivel más bajo, todas las tortugas invierten su sentido de patrulla

**Otros**
- Corregido el eco de Socket.IO que forzaba el modo a `carrera` al iniciar partida
- Tabla de ranking del menú con fondo más transparente (`rgba(255,255,255,0.12)`)
- Documentación actualizada en `README.md`

---

## 2026-11-17

### HUD en juego
- Quitado el panel grande de escalera de niveles (`.niveles` con 11 barras)
- Reemplazado por texto flotante `1 / 11` sin recuadro, blanco con sombra
- Score también sin recuadro, mismo estilo
- Solo el cronómetro mantiene el cuadro blanco (centrado en la barra superior)
- Panel de Vidas eliminado; los 3 corazones ahora flotan a la izquierda del botón Pausa (estilo Mario Bros), tamaño 40px
- `escena.js → actualizarHUD()`: ya no toglea clases `.nivel`, ahora actualiza `#hud-nivel-actual` con textContent

### Estandarización de tarjetas de menú
- Todas las tarjetas de flujo unificadas a `height: 480px` (antes dificultad-tarjeta y multi-hub eran 420px)
- Añadido `overflow: hidden` a `.vista-contenido` para evitar desbordamiento en vista-unirse

---

## 2026-11-10 al 2026-11-16

### Rediseño completo de UI de menús
Commit: `6c8a399`

**Selector de patos (`js/motor/selector-patos.js`)**
- Patos renderizados de perfil lateral (`rotation.y = 0`, cámara en `(0, 1.8, 3.2)`)
- Escala aumentada a `1.6`, más iluminación (AmbientLight 1.1 + 2 DirectionalLights)
- Sin sonido al pasar el mouse
- Aura blanca al seleccionar (`drop-shadow` en CSS, sin recuadro)
- Render estático (sin RAF loop)

**Sistema de overlays (`js/util/navegacion.js`)**
- `OVERLAY_VISTAS = new Set(['vista-pausa', 'vista-configuraciones'])`
- Los overlays se apilan sobre la vista activa en lugar de reemplazarla
- Atributo `data-cerrar-overlay` para cerrar overlays sin navegar

**Nueva vista de dificultad**
- Insertada entre selección de escenario y selección de pato
- 3 botones: Fácil / Normal / Difícil con indicadores de puntos
- Al retroceder desde selección de pato se limpia la selección de dificultad

**Pausa rediseñada**
- Fondo sólido `#6cc0f0` (azul opaco)
- Dos paneles dentro de la misma tarjeta: menú principal y configuraciones
- Panel config se abre en la misma tarjeta con botón ← en esquina superior izquierda
- `CSS: .pausa-panel[hidden] { display: none !important }` para override de flex

**Configuraciones como overlay**
- Se abre sobre cualquier vista con `z-index: 110`
- Botón X rojo en esquina superior derecha (`data-cerrar-overlay`)
- Solo Volumen y Sonido (se quitó Dificultad)

**Validación de nombre**
- Campo nombre obligatorio antes de iniciar partida
- Animación `sacudir` + borde rojo si está vacío

**Otros**
- Botones de modo duplicados en tamaño (padding 32px 48px, font-size 22px, íconos 80px)
- Vistas multijugador con mismo glassmorphism que solitario
- Tarjetas de escenario en vista crear-mundo usan previews 3D con Three.js

---

---

## 2026-11-22

### Jugabilidad: condición de victoria y dificultad conectada

**Victoria**
- Nuevo overlay `#victoria` en `index.html` (dentro de `#vista-juego`, al mismo nivel que `#game-over`)
- `mostrarVictoria()` en `escena.js`: pausa el cronómetro, guarda mejor score en localStorage, llama al callback `alGanar` para enviar puntuación al servidor y refrescar el ranking del menú
- Victoria se activa al aterrizar en una celda cuya `alturaEfectiva >= NIVEL_MAXIMO_POR_ESCENARIO[escenario]`
  - Pirámide: nivel 11 | Torre: nivel 14 | Islas: nivel 11
- "Jugar de nuevo" reinicia con el mismo escenario/pato/dificultad; "Menú" vuelve al inicio
- `actualizarHUD()` ahora también actualiza `#hud-nivel-total` con el máximo real del escenario actual

**Dificultad conectada**
- Tablas en `escena.js`: `PROB_MINAS` y `DENSIDAD_COLECCIONABLES`
- `reiniciar()` acepta `dificultad` como 4to parámetro; se pasa desde `main.js` con `dificultadPendiente`
- Minas dinámicas (`intentarSpawnMinas`): prob = base + nivel × porNivel (Fácil 2%+0.5, Normal 4%+1.2, Difícil 7%+2.0)
- Minas estáticas iniciales en `piramide.js`: Fácil 1.5%, Normal 3%, Difícil 6%
- Coleccionables: densidad Fácil 20%, Normal 12%, Difícil 7%
- `main.js` ahora importa `enviarPuntuacion` y lo usa como callback `alGanar`

## Pendiente

| Tarea | Prioridad |
|---|---|
| ~~Condición de victoria (llegar al nivel 11)~~ | ~~Alta~~ ✓ |
| ~~Conectar dificultad a lógica del juego~~ | ~~Alta~~ ✓ |
| 3 objetos especiales / power-ups | Alta (rubro) |
| Música de fondo | Media (rubro) |
| Sonidos de juego (cuak, salto, recoger, mina) | Media |
| Verificar colisiones en los 3 escenarios | Media |
