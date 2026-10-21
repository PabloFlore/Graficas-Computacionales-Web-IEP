import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Crea un LoadingManager compartido. Todos los loaders reportan sus
 * eventos a este mismo gestor, asi el progreso refleja la carga completa
 * (OBJ + MTL + GLB y sus texturas) y no la de un solo archivo.
 */
export function crearGestorCarga() {
  const gestor = new THREE.LoadingManager();

  gestor.onStart = (url, itemsLoaded, itemsTotal) => {
    console.log(`Carga iniciada: ${url} (${itemsLoaded}/${itemsTotal}).`);
  };

  gestor.onProgress = (url, itemsLoaded, itemsTotal) => {
    console.log(`Cargando ${url} (${itemsLoaded}/${itemsTotal}).`);
  };

  gestor.onLoad = () => {
    console.log('Modelos cargados por completo.');
  };

  gestor.onError = (url) => {
    console.warn(`No se pudo cargar: ${url}`);
  };

  return gestor;
}

function aplicarTransformacion(objeto, nombre, escala, posicion) {
  if (nombre) {
    objeto.name = nombre;
  }

  if (escala) {
    objeto.scale.copy(escala);
  }

  if (posicion) {
    objeto.position.copy(posicion);
  }

  return objeto;
}

/**
 * Carga un modelo OBJ + MTL. La ruta va sin extension: se le agregan
 * `.mtl` y `.obj`.
 */
export function cargarModeloOBJ(ruta, nombre, escala = new THREE.Vector3(1, 1, 1), posicion, gestor) {
  return new Promise((resolve, reject) => {
    const loaderOBJ = new OBJLoader(gestor);
    const loaderMTL = new MTLLoader(gestor);

    loaderMTL.load(
      `${ruta}.mtl`,
      (materiales) => {
        materiales.preload();
        loaderOBJ.setMaterials(materiales);

        loaderOBJ.load(
          `${ruta}.obj`,
          (objeto) => resolve(aplicarTransformacion(objeto, nombre, escala, posicion)),
          undefined,
          (error) => reject(error)
        );
      },
      undefined,
      (error) => reject(error)
    );
  });
}

/**
 * Carga un modelo GLB/GLTF. La ruta incluye la extension.
 */
export function cargarModeloGLB(ruta, nombre, escala = new THREE.Vector3(1, 1, 1), posicion, gestor) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader(gestor);

    loader.load(
      ruta,
      (gltf) => {
        const objeto = aplicarTransformacion(gltf.scene, nombre, escala, posicion);
        // Guardamos los clips para que la escena los pueda reproducir con AnimationMixer.
        objeto.userData.animations = gltf.animations ?? [];
        resolve(objeto);
      },
      undefined,
      (error) => reject(error)
    );
  });
}

/**
 * Carga una lista de modelos en paralelo y devuelve solo los que
 * lograron cargarse. Si un archivo falta todavia, se registra el aviso
 * y la escena sigue funcionando.
 */
export async function cargarModelos(lista, gestor = crearGestorCarga()) {
  const resultados = await Promise.allSettled(
    lista.map((item) =>
      item.tipo === 'obj'
        ? cargarModeloOBJ(item.ruta, item.nombre, item.escala, item.posicion, gestor)
        : cargarModeloGLB(item.ruta, item.nombre, item.escala, item.posicion, gestor)
    )
  );

  return resultados
    .filter((resultado) => resultado.status === 'fulfilled')
    .map((resultado) => resultado.value);
}
