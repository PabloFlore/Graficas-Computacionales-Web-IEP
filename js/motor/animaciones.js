import * as THREE from 'three';

/**
 * Animaciones del pato.
 *
 * - crearSalto(): salto con trayectoria parabolica y deformacion
 *   "squash & stretch" segun la guia: al subir el objeto se estira
 *   (scale.y crece y scale.x/z encogen) y al caer se aplasta, con un
 *   golpe final al aterrizar que se recupera para darle "peso".
 * - crearMezclador(): inicializa el AnimationMixer de Three.js con las
 *   pistas de animacion incluidas en un modelo GLTF/GLB. Si el modelo
 *   no trae pistas devuelve null y la escena sigue funcionando igual.
 */

// Parametros por defecto del salto (en unidades y segundos).
const ALTURA = 1.5;
const DURACION = 0.7;
const DURACION_ATERRIZAJE = 0.12;
// Distancia horizontal por defecto del salto (avanza en la direccion en
// la que mira el jugador).
const DESPLAZAMIENTO = 1;
// Proporciones de deformacion respecto de la escala base.
const ESTIRAMIENTO = 0.35;
const APLASTAMIENTO = 0.3;

/**
 * Crea el estado de salto de un objeto.
 *
 * @param {THREE.Object3D} objetoVolar grupo que vuela (su position.y
 *   sube y baja en parabola, y su X/Z avanza en la direccion del salto).
 * @param {THREE.Object3D|null} objetoEscalar modelo que se deforma
 *   (puede ser null: el salto funciona igual, solo sin squash & stretch).
 * @param {{ altura?: number, duracion?: number, desplazamiento?: number }} opciones
 */
export function crearSalto(objetoVolar, objetoEscalar = null, { altura = ALTURA, duracion = DURACION, desplazamiento = DESPLAZAMIENTO } = {}) {
  const escalaBase = objetoEscalar ? objetoEscalar.scale.clone() : null;

  let enSalto = false;
  let t = 0;
  // Origen (X/Z) del salto y direccion (unitaria) hacia donde avanza.
  let origenX = 0;
  let origenZ = 0;
  let dirX = 0;
  let dirZ = 0;

  // Aplica una proporcion f (0 = neutro, 1 = deformacion maxima):
  // estira en la subida y aplasta en la bajada, manteniendo mas o menos
  // el volumen (lo que pierde en Y lo gana en X/Z y viceversa).
  function deformar(f, estirando) {
    if (!objetoEscalar) {
      return;
    }

    const proporcion = estirando ? ESTIRAMIENTO : APLASTAMIENTO;
    const scaleY = estirando ? 1 + proporcion * f : 1 - proporcion * f;
    const scaleXZ = estirando ? 1 - (proporcion * f) / 2 : 1 + (proporcion * f) / 2;

    objetoEscalar.scale.set(
      escalaBase.x * scaleXZ,
      escalaBase.y * scaleY,
      escalaBase.z * scaleXZ
    );
  }

  function finalizar() {
    enSalto = false;
    t = 0;
    objetoVolar.position.y = 0;
    if (objetoEscalar) {
      objetoEscalar.scale.copy(escalaBase);
    }
  }

  /**
   * Inicia el salto en una direccion (unitaria). Devuelve false si ya
   * hay uno en curso (no se encadenan saltos). Sin direccion el salto es
   * solo vertical (lo usan los avatares remotos, que reciben la X/Z por
   * paquetes de red en vez de calcular el desplazamiento local).
   */
  function iniciarSalto(direccionX = 0, direccionZ = 0) {
    if (enSalto) {
      return false;
    }
    enSalto = true;
    t = 0;
    origenX = objetoVolar.position.x;
    origenZ = objetoVolar.position.z;
    const magnitud = Math.hypot(direccionX, direccionZ);
    if (magnitud > 1e-6) {
      dirX = direccionX / magnitud;
      dirZ = direccionZ / magnitud;
    } else {
      dirX = 0;
      dirZ = 0;
    }
    return true;
  }

  function estaEnSalto() {
    return enSalto;
  }

  /**
   * Avanza la animacion con el tiempo transcurrido desde el ultimo
   * fotograma. Devuelve true mientras dure el ciclo completo
   * (subida + bajada + aterrizaje).
   */
  function actualizar(delta) {
    if (!enSalto) {
      return false;
    }

    t += delta;

    const total = duracion + DURACION_ATERRIZAJE;
    if (t >= total) {
      finalizar();
      return false;
    }

    if (t < duracion) {
      // Parabola: y(t) = altura * (1 - (2t/T - 1)^2).
      // En t=0 y t=T esta en el suelo; en t=T/2 toca la altura maxima.
      const progreso = (2 * t) / duracion - 1;
      objetoVolar.position.y = altura * (1 - progreso * progreso);

      // Desplazamiento horizontal: avanza de forma lineal desde el
      // origen hasta origen + direccion * desplazamiento a lo largo del
      // salto. La X/Z tambien la recorta el llamador a los limites.
      const avance = (t / duracion) * desplazamiento;
      objetoVolar.position.x = origenX + dirX * avance;
      objetoVolar.position.z = origenZ + dirZ * avance;

      // La proporcion de deformacion sigue la velocidad de la parabola:
      // maxima al impulsarse, cero en el pico, maxima de nuevo al caer.
      const f = Math.abs(progreso);
      deformar(f, t < duracion / 2);
    } else {
      // Aterrizaje: el suelo ya se toco (y = 0) y el aplastamiento
      // sobreactuado se recupera hasta la escala base.
      objetoVolar.position.y = 0;
      const restante = 1 - (t - duracion) / DURACION_ATERRIZAJE;
      deformar(restante, false);
    }

    return true;
  }

  return { iniciarSalto, actualizar, estaEnSalto };
}

/**
 * Animaciones procedurales para los objetos decorativos (mina, resorte,
 * escudo, radar). Como los GLB no traen pistas de animacion, cada efecto
 * modifica scale/rotation/position en cada fotograma a partir del tiempo
 * acumulado, y devuelve `{ actualizar(delta) }`.
 */

// Guarda la escala base del objeto al crear la animacion, para oscilar
// alrededor de ella sin acumular deriva.
function escalaBaseDe(objeto) {
  return objeto ? objeto.scale.clone() : null;
}

/**
 * Pulso: late (escala) + rotacion lenta en Y. Para la mina.
 */
export function crearPulso(objeto, { amplitud = 0.12, frecuencia = 3, giro = 0.6 } = {}) {
  const base = escalaBaseDe(objeto);
  let t = 0;

  return {
    actualizar(delta) {
      if (!objeto) {
        return;
      }
      t += delta;
      const f = 1 + amplitud * Math.sin(t * frecuencia);
      objeto.scale.set(base.x * f, base.y * f, base.z * f);
      objeto.rotation.y += giro * delta;
    }
  };
}

/**
 * Rebote / compresion: la altura sube y baja compensando X/Z (squash),
 * como un resorte que se comprime y suelta.
 */
export function crearRebote(objeto, { amplitud = 0.3, frecuencia = 4 } = {}) {
  const base = escalaBaseDe(objeto);
  let t = 0;

  return {
    actualizar(delta) {
      if (!objeto) {
        return;
      }
      t += delta;
      const seno = Math.sin(t * frecuencia);
      const scaleY = 1 + amplitud * seno;
      const scaleXZ = 1 - (amplitud * seno) / 2;
      objeto.scale.set(base.x * scaleXZ, base.y * scaleY, base.z * scaleXZ);
    }
  };
}

/**
 * Giro continuo sobre si mismo en Y. Para el escudo.
 */
export function crearGiro(objeto, { velocidad = 1.2 } = {}) {
  return {
    actualizar(delta) {
      if (objeto) {
        objeto.rotation.y += velocidad * delta;
      }
    }
  };
}

/**
 * Barrido giratorio rapido + pulso leve. Para el radar.
 */
export function crearBarrido(objeto, { velocidad = 4, amplitud = 0.06, frecuencia = 6 } = {}) {
  const base = escalaBaseDe(objeto);
  let t = 0;

  return {
    actualizar(delta) {
      if (!objeto) {
        return;
      }
      t += delta;
      objeto.rotation.y += velocidad * delta;
      const f = 1 + amplitud * Math.sin(t * frecuencia);
      objeto.scale.set(base.x * f, base.y * f, base.z * f);
    }
  };
}

/**
 * Devuelve las pistas de animacion de un modelo, sin importar si vienen
 * en `userData.animations` (como las guarda cargarModeloGLB) o en
 * `animations` (propiedad directa del objeto).
 */
function pistasDe(modelo) {
  if (!modelo) {
    return null;
  }

  const deUserData = modelo.userData ? modelo.userData.animations : null;
  if (Array.isArray(deUserData)) {
    return deUserData;
  }

  return Array.isArray(modelo.animations) ? modelo.animations : null;
}

/**
 * Inicializa el AnimationMixer de un modelo GLTF/GLB y reproduce sus
 * pistas en loop.
 *
 * `cargarModeloGLB` adjunta las pistas al cargar el archivo. Un clon de
 * Object3D no copia esa propiedad, por eso se pueden pasar las pistas por
 * separado (`pistas`, por ejemplo las de la plantilla).
 *
 * Devuelve el mixer (que se actualiza con mixer.update(delta)) o null si
 * el modelo no trae animaciones, para que quien lo use pueda encadenar
 * con `creador?.update(delta)` sin verificar nada mas.
 */
export function crearMezclador(objeto, pistas = pistasDe(objeto)) {
  if (!objeto || !Array.isArray(pistas) || pistas.length === 0) {
    return null;
  }

  const mixer = new THREE.AnimationMixer(objeto);
  pistas.forEach((pista) => {
    mixer.clipAction(pista).play();
  });

  console.log(`AnimationMixer iniciado con ${pistas.length} pista(s).`);
  return mixer;
}
