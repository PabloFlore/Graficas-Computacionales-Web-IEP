import * as THREE from 'three';

/**
 * Sistema de particulas cosmeticas.
 *
 * Todas las particulas viven en un unico THREE.Points con un pool fijo:
 * no se crean objetos ni geometrias por emision. El shader dibuja un
 * circulo suave con gl_PointCoord y usa atributos por particula para el
 * color, el tamano y el alpha, de modo que no hacen falta texturas ni
 * dependencias extra.
 *
 * Las particulas son puramente locales: no se sincronizan por red.
 */

const COLORES_CONFETI = ['#7ee8fa', '#ffd166', '#ff8fab', '#c3f584', '#ffffff'];
const COLORES_AURA = ['#7ee8fa', '#ffd166', '#ffffff'];
const COLORES_TELETRANSPORTE = ['#7ee8fa', '#ffffff', '#ffd166'];
const COLORES_IMPACTO = ['#ffffff', '#e8f7ff', '#ffd166'];

const PRESETS = {
  polvo: {
    count: 9,
    color: '#d9c7a3',
    tamano: [0.3, 0.65],
    vida: [0.35, 0.65],
    velocidad: [0.6, 1.5],
    subida: [0.2, 0.8],
    gravedad: -2.8,
    arrastre: 2.8,
    dispersion: 0.45
  },
  chispa: {
    count: 24,
    colores: ['#ff6b57', '#ffd166', '#fff3c4'],
    tamano: [0.35, 0.85],
    vida: [0.35, 0.8],
    velocidad: [1.2, 3.2],
    subida: [0.4, 2.2],
    gravedad: -5.5,
    arrastre: 1.2,
    dispersion: 0.35
  },
  humo: {
    count: 8,
    colores: ['#8b7f76', '#b9b2a6', '#6b5b53'],
    tamano: [0.6, 1.2],
    vida: [0.7, 1.2],
    velocidad: [0.2, 0.8],
    subida: [0.4, 1.1],
    gravedad: 0.5,
    arrastre: 1.5,
    dispersion: 0.5
  },
  powerup: {
    count: 16,
    color: '#7bd88f',
    tamano: [0.35, 0.75],
    vida: [0.45, 0.85],
    velocidad: [0.5, 1.7],
    subida: [0.8, 2.0],
    gravedad: -1.8,
    arrastre: 2.0,
    dispersion: 0.35
  },
  confeti: {
    count: 42,
    colores: COLORES_CONFETI,
    tamano: [0.45, 0.9],
    vida: [0.9, 1.7],
    velocidad: [1.2, 3.5],
    subida: [2.0, 4.5],
    gravedad: -7.0,
    arrastre: 0.7,
    dispersion: 0.8
  },
  aura: {
    count: 1,
    colores: COLORES_AURA,
    tamano: [0.25, 0.55],
    vida: [0.8, 1.4],
    velocidad: [0.1, 0.35],
    subida: [0.4, 1.0],
    gravedad: 0.0,
    arrastre: 0.6,
    dispersion: 1.0
  },
  teleport: {
    count: 24,
    colores: COLORES_TELETRANSPORTE,
    tamano: [0.35, 0.8],
    vida: [0.45, 0.85],
    velocidad: [1.5, 3.5],
    subida: [0.3, 1.5],
    gravedad: -2.0,
    arrastre: 2.0,
    dispersion: 0.4
  },
  impacto: {
    count: 14,
    colores: COLORES_IMPACTO,
    tamano: [0.3, 0.7],
    vida: [0.3, 0.6],
    velocidad: [0.8, 2.2],
    subida: [0.3, 1.2],
    gravedad: -3.0,
    arrastre: 2.5,
    dispersion: 0.35
  }
};

function aleatorioEntre([minimo, maximo]) {
  return minimo + Math.random() * (maximo - minimo);
}

/**
 * @param {THREE.Scene} escena
 * @param {{
 *   camara?: THREE.PerspectiveCamera,
 *   max?: number,
 *   habilitado?: boolean,
 *   escala?: number
 * }} opciones
 */
export function crearParticulas(escena, {
  camara = null,
  max = 480,
  habilitado = true,
  escala = 1
} = {}) {
  const cantidadMaxima = Math.max(16, Math.floor(max));
  const posiciones = new Float32Array(cantidadMaxima * 3);
  const colores = new Float32Array(cantidadMaxima * 3);
  const tamanos = new Float32Array(cantidadMaxima);
  const alfas = new Float32Array(cantidadMaxima);
  const velocidades = new Float32Array(cantidadMaxima * 3);
  const restantes = new Float32Array(cantidadMaxima);
  const duraciones = new Float32Array(cantidadMaxima);
  const gravedades = new Float32Array(cantidadMaxima);
  const arrastres = new Float32Array(cantidadMaxima);
  const tamanosBase = new Float32Array(cantidadMaxima);

  let siguiente = 0;
  const colorTemporal = new THREE.Color();

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
  geometria.setAttribute('aColor', new THREE.BufferAttribute(colores, 3));
  geometria.setAttribute('aSize', new THREE.BufferAttribute(tamanos, 1));
  geometria.setAttribute('aAlpha', new THREE.BufferAttribute(alfas, 1));
  geometria.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    uniforms: {
      uEscala: { value: 1 },
      uPixelRatio: { value: 1 }
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      uniform float uEscala;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 vista = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(
          aSize * uEscala / max(0.1, -vista.z),
          1.0,
          96.0 * uPixelRatio
        );
        gl_Position = projectionMatrix * vista;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 centro = gl_PointCoord - vec2(0.5);
        float distancia = length(centro);
        float mascara = smoothstep(0.5, 0.18, distancia);
        if (mascara <= 0.01) discard;
        gl_FragColor = vec4(vColor, vAlpha * mascara);
        #include <colorspace_fragment>
      }
    `
  });

  const puntos = new THREE.Points(geometria, material);
  puntos.frustumCulled = false;
  puntos.renderOrder = 3;
  escena.add(puntos);

  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);

  function redimensionar() {
    const fov = camara && Number.isFinite(camara.fov) ? camara.fov : 60;
    const alturaBuffer = window.innerHeight * pixelRatio();
    material.uniforms.uEscala.value = (alturaBuffer * 0.5)
      / Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
    material.uniforms.uPixelRatio.value = pixelRatio();
  }

  function marcarEmision() {
    geometria.attributes.position.needsUpdate = true;
    geometria.attributes.aColor.needsUpdate = true;
    geometria.attributes.aSize.needsUpdate = true;
    geometria.attributes.aAlpha.needsUpdate = true;
  }

  function colorDe(opciones, preset) {
    const lista = Array.isArray(opciones.colores)
      ? opciones.colores
      : (Array.isArray(preset.colores) ? preset.colores : null);

    if (lista && lista.length > 0) {
      return lista[Math.floor(Math.random() * lista.length)];
    }

    return opciones.color || preset.color || '#ffffff';
  }

  /**
   * Emite una tanda de particulas en el punto indicado.
   *
   * Tipos: polvo, chispa, humo, powerup, confeti, aura, teleport, impacto.
   */
  function emitir(tipo, opciones = {}) {
    if (!habilitado) {
      return;
    }

    const preset = PRESETS[tipo] || PRESETS.polvo;
    const cantidadBase = Number.isFinite(opciones.count) ? opciones.count : preset.count;
    const cantidad = Math.max(1, Math.round(cantidadBase * escala));
    const x = Number.isFinite(opciones.x) ? opciones.x : 0;
    const y = Number.isFinite(opciones.y) ? opciones.y : 0;
    const z = Number.isFinite(opciones.z) ? opciones.z : 0;
    const dispersion = Number.isFinite(opciones.dispersion)
      ? opciones.dispersion
      : preset.dispersion;
    const direccion = opciones.direccion;
    const anguloBase = direccion && Number.isFinite(direccion.x) && Number.isFinite(direccion.z)
      ? Math.atan2(direccion.z, direccion.x)
      : null;
    const apertura = Number.isFinite(opciones.apertura) ? opciones.apertura : Math.PI * 2;

    for (let n = 0; n < cantidad; n += 1) {
      const indice = siguiente;
      siguiente = (siguiente + 1) % cantidadMaxima;
      const base = indice * 3;

      posiciones[base] = x + (Math.random() - 0.5) * dispersion;
      posiciones[base + 1] = y + (Math.random() - 0.5) * dispersion * 0.6;
      posiciones[base + 2] = z + (Math.random() - 0.5) * dispersion;

      const angulo = anguloBase === null
        ? Math.random() * Math.PI * 2
        : anguloBase + (Math.random() - 0.5) * apertura;
      const rapidez = aleatorioEntre(preset.velocidad);
      velocidades[base] = Math.cos(angulo) * rapidez;
      velocidades[base + 1] = aleatorioEntre(preset.subida);
      velocidades[base + 2] = Math.sin(angulo) * rapidez;

      const vida = aleatorioEntre(preset.vida);
      restantes[indice] = vida;
      duraciones[indice] = vida;
      gravedades[indice] = preset.gravedad;
      arrastres[indice] = preset.arrastre;

      const tamano = aleatorioEntre(preset.tamano);
      tamanosBase[indice] = tamano;
      tamanos[indice] = tamano;
      alfas[indice] = 0;

      colorTemporal.set(colorDe(opciones, preset));
      const variacion = 1 + (Math.random() - 0.5) * 0.12;
      colores[base] = Math.min(1, colorTemporal.r * variacion);
      colores[base + 1] = Math.min(1, colorTemporal.g * variacion);
      colores[base + 2] = Math.min(1, colorTemporal.b * variacion);
    }

    marcarEmision();
  }

  function actualizar(delta) {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    let hayCambios = false;

    for (let indice = 0; indice < cantidadMaxima; indice += 1) {
      if (restantes[indice] <= 0) {
        if (alfas[indice] !== 0) {
          alfas[indice] = 0;
          hayCambios = true;
        }
        continue;
      }

      restantes[indice] -= dt;
      if (restantes[indice] <= 0) {
        restantes[indice] = 0;
        alfas[indice] = 0;
        hayCambios = true;
        continue;
      }

      const vidaMaxima = duraciones[indice] || 1;
      const transcurrido = vidaMaxima - restantes[indice];
      const entrada = Math.min(1, transcurrido * 10);
      const salida = Math.min(1, restantes[indice] / (vidaMaxima * 0.35));
      alfas[indice] = entrada * salida;

      const base = indice * 3;
      const arrastre = Math.max(0, 1 - arrastres[indice] * dt);
      velocidades[base] *= arrastre;
      velocidades[base + 1] = velocidades[base + 1] * arrastre + gravedades[indice] * dt;
      velocidades[base + 2] *= arrastre;

      posiciones[base] += velocidades[base] * dt;
      posiciones[base + 1] += velocidades[base + 1] * dt;
      posiciones[base + 2] += velocidades[base + 2] * dt;

      tamanos[indice] = tamanosBase[indice] * (0.65 + 0.35 * salida);
      hayCambios = true;
    }

    if (hayCambios) {
      geometria.attributes.position.needsUpdate = true;
      geometria.attributes.aSize.needsUpdate = true;
      geometria.attributes.aAlpha.needsUpdate = true;
    }
  }

  function limpiar() {
    restantes.fill(0);
    alfas.fill(0);
    siguiente = 0;
    geometria.attributes.aAlpha.needsUpdate = true;
  }

  function destruir() {
    escena.remove(puntos);
    geometria.dispose();
    material.dispose();
  }

  redimensionar();

  return { emitir, actualizar, limpiar, destruir, redimensionar };
}
