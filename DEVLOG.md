# DEVLOG — Pato a la Cima

Historial de cambios y decisiones de desarrollo.

---

## 2026-11-24

### Power-ups, audio y feedback (rúbrica de entrega final)

**Power-ups (ítems especiales, 3 mínimo) — `js/motor/powerups.js`**
- Nuevo sistema al estilo de `coleccionables`/`obstaculos` (`spawn/recoger/animar/limpiar`), con malla low-poly y aparición en celdas válidas vía `puedeOcuparObstaculo`
- 🛟 **Escudo**: absorbe el siguiente golpe mortal (mina, agua o cubo caído) sin costar vida; aro azul alrededor del pato
- 🪽 **Pluma (doble salto)**: +1 nivel de subida durante 8s (pirámide/torre suben 2, islas 3)
- 🧲 **Imán**: al aterrizar también recoge los coleccionables de las 4 celdas vecinas durante 8s
- Aparecen de a máx. 2 en el tablero cada ~12s; HUD inferior con los efectos activos y su cuenta regresiva

**Audio — `js/motor/sonidos.js`**
- Reescrito con síntesis WebAudio (no requiere .mp3): salto, recoger, mina, game over, escudo, power-up y victoria
- **Música de fondo** generativa en loop (arpegio pentatónico), inicia con el primer salto y respeta volumen/sonido de preferencias; se detiene en pausa, game over y victoria

**Jugabilidad / feedback**
- La **racha** ya no se rompe en cada salto sin objeto: solo al perder vida o tras 4s sin recoger. Multiplicador escalonado ×2 (racha 3) y ×3 (racha 6)
- **Bonus al coronar la cima**: +500 base, +2 por segundo bajo 5:00 y +150 por vida restante
- Rareza en coleccionables: semilla 35 / manzana 30 / zanahoria 20 / dulce 10 (los de mayor valor salen menos)
- Texto flotante "+N" al recoger y pequeño *squash* del pato al aterrizar
- **Luz focal** (`PointLight`) que sigue al pato, además de la ambiental y la direccional

### Torre e Islas: dificultad y modo de juego completos

**Dificultad en los 3 escenarios**
- Minas estáticas por escenario: Pirámide 1.5/3/6%, Torre 3/6/12% e Islas 2.5/5/10% (fácil/normal/difícil)
- Cubos que caen en los 3 escenarios con probabilidad 10/18/28% según dificultad; antes solo existían en Pirámide con 22% fijo
- Items por cuadrante: Pirámide 3/2/1 y Torre/Islas 6/5/4 según dificultad; antes era una constante
- Spawn de items, tortugas y hierba limitado al área jugable (Pirámide 10, Torre 5, Islas 5), para no desperdiciar intentos en celdas vacías de Islas
- Islas: los objetos respetan la elevación del escenario (antes quedaban enterrados) y se generan items en las islas laterales `(±13, 0)`
- Celdas protegidas en los 3 escenarios: inicio, centro y cima; en Islas también los puentes y el centro de las islas laterales. Nunca reciben minas ni cubos que caen

**Modo de juego en los 3 escenarios**
- Carrera: sin minas dinámicas en ningún escenario; el agua que sube sigue siendo exclusiva de Pirámide
- Rey de la cima: minas dinámicas con aviso naranja → rojo en los 3 escenarios (antes solo en Pirámide)
- Torre e Islas: la saciedad para invocar la nube es 30 en Carrera y 40 en Rey
- El intervalo y el cap de minas dinámicas por dificultad se aplican igual a los 3 escenarios

### La Torre: escalera de caracol y trampolín recargable

- La torre dejó de tener anillos de +3 niveles: ahora es una base de nivel 1 con una escalera de caracol de 14 pasos que sube de 1 en 1 hasta el centro `(0, 0)`
- Salto máximo hacia arriba por escenario: 1 nivel en Pirámide y Torre, 2 en Islas. Bajar sigue sin límite
- La escalera y el centro están protegidos: no reciben minas ni cubos que caen, para que siempre haya ruta a la cima
- Dos trampolines en `(1, 2)` y `(2, -1)`: se cargan 2s y quedan activos 3s (ciclo de 5s), con color amarillo/gris y latido
- Aterrizar en un trampolín activo da un salto potenciado de hasta 3 niveles: desde `(1, 2)` se salta al escalón 4 y desde `(2, -1)` al escalón 10
- Inicio de la torre movido a `(3, 0)`, primer escalón de la escalera

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
| ~~3 objetos especiales / power-ups~~ | ~~Alta (rubro)~~ ✓ |
| ~~Música de fondo~~ | ~~Media (rubro)~~ ✓ |
| ~~Sonidos de juego (cuak, salto, recoger, mina)~~ | ~~Media~~ ✓ |
| Verificar colisiones en los 3 escenarios | Media |
| Depredador que persigue (zorro) — ver "Ideas propuestas" | Media |
| Control táctil (móvil) | Media |

---

## Ideas propuestas (sin implementar)

### 🦊 Depredador que persigue — zorro terrestre (idea elegida)

Un enemigo **activo** que caza al pato, a diferencia de las minas (estáticas) y las
tortugas (solo patrullan en eje X). Aporta presión para no quedarse quieto y planear la
ruta.

- **Comportamiento:** salta de cubo en cubo avanzando **una casilla hacia el pato** cada
  ~1.1s (más lento que el salto del pato de 0.45s), con IA *greedy* de 4 direcciones:
  elige el eje con mayor diferencia; si esa celda no es accesible, prueba el otro; si ambos
  fallan, se queda.
- **Justo/escapable:** respeta el terreno (huecos, minas, cubos caídos, `z<0` en pirámide,
  salida y centro); aparece **lejos** del pato y solo empieza a cazar tras alcanzar un nivel
  de gracia; al perder una vida se **reubica lejos**.
- **Colisión:** si el zorro cae en la casilla del pato → se pierde una vida (reusa
  `perderVida`).
- **Dificultad (tabla a afinar):** Fácil → sin zorro · Normal → paso 1.1s, aparece nivel 3 ·
  Difícil → paso 0.85s, aparece nivel 2.
- **Implementación prevista:** módulo nuevo `js/motor/depredador.js` copiando el patrón de
  `js/motor/obstaculos.js` (`configurar/poblar/animar/limpiar`), enganchado en `escena.js` en
  los mismos puntos que las tortugas (creación, `reiniciar`, `respawnJugador`, loop `animate`,
  `limpiar`). Reutiliza `puedeOcuparObstaculo`, el ctx de celda/salto y `yMundo/alturaFn`.
  Malla low-poly con `flatShading` al estilo de la tortuga. Funciona en los 3 escenarios.
- **Variantes descartadas:** halcón volador (ignora terreno, difícil de balancear) e híbrido
  con salto largo telegrafiado.

### Otras ideas de mecánica (lluvia de ideas)

- **Power-ups (cubren el rubro de 3 objetos especiales):** 🪽 Pluma dorada (planeo/doble
  salto), 🛟 Salvavidas (escudo de 1 golpe), 🍞 Migajas (imán de puntos), ❄️ Hielo (congela
  agua/tortugas), ⏳ Reloj (tiempo lento).
- **Peligros/terreno:** 🧊 cubos resbaladizos (deslizan 1 casilla extra), 🌀 viento que
  empuja lateral, 🌀 cubos portal/teletransporte.
- **Objetivos/modos:** 🥚 escolta de patito (protegerlo da bonus), 🌙 modo noche con linterna.
