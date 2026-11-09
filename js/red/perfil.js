/**
 * Perfil del jugador para las puntuaciones.
 *
 * El SDK de Facebook vive en index.html (script clasico). Cuando llega un
 * perfil valido guarda el objeto en localStorage y dispara el evento
 * "perfil-facebook"; este modulo lo escucha y autocompleta los formularios.
 * Si no hay Facebook, se usa el nombre manual del menu o del formulario.
 */
const CLAVE_PERFIL = 'gcw.perfil';
const CLAVE_NOMBRE = 'gcw.nombre';

let perfil = leerPerfil();

function leerPerfil() {
  try {
    const crudo = localStorage.getItem(CLAVE_PERFIL);
    if (!crudo) {
      return null;
    }

    const datos = JSON.parse(crudo);
    if (!datos || !datos.nombre) {
      return null;
    }

    return {
      id: datos.id || null,
      nombre: String(datos.nombre),
      foto: datos.foto || null,
      origen: 'facebook'
    };
  } catch (error) {
    return null;
  }
}

function autocompletarNombre(nombre) {
  ['nombre-jugador', 'nombre-puntuacion', 'usuario'].forEach((id) => {
    const campo = document.getElementById(id);
    if (campo && !campo.value) {
      campo.value = nombre;
    }
  });
}

export function iniciarPerfil() {
  window.addEventListener('perfil-facebook', (evento) => {
    const datos = evento && evento.detail;
    if (!datos || !datos.nombre) {
      return;
    }

    perfil = {
      id: datos.id || null,
      nombre: String(datos.nombre),
      foto: datos.foto || null,
      origen: 'facebook'
    };

    try {
      localStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil));
    } catch (error) {
      // Sin localStorage el perfil solo vive en esta sesion.
    }

    autocompletarNombre(perfil.nombre);
  });

  if (perfil) {
    autocompletarNombre(perfil.nombre);
  }
}

export function obtenerPerfil() {
  return perfil;
}

/**
 * Nombre que se usara en la puntuacion: perfil de Facebook, nombre del menu o
 * del formulario, y por ultimo el ultimo nombre recordado.
 *
 * `preferirFormulario` lo usa el formulario manual para que el nombre que el
 * jugador acaba de escribir gane sobre el nombre del menu.
 */
export function nombreParaPuntaje(preferirFormulario = false) {
  if (perfil && perfil.nombre) {
    return perfil.nombre;
  }

  const ids = preferirFormulario
    ? ['nombre-puntuacion', 'nombre-jugador', 'usuario']
    : ['nombre-jugador', 'nombre-puntuacion', 'usuario'];

  for (const id of ids) {
    const campo = document.getElementById(id);
    if (campo && campo.value.trim()) {
      return campo.value.trim();
    }
  }

  try {
    return localStorage.getItem(CLAVE_NOMBRE) || '';
  } catch (error) {
    return '';
  }
}

export function recordarNombre(nombre) {
  const limpio = String(nombre || '').trim();
  if (!limpio) {
    return;
  }

  try {
    localStorage.setItem(CLAVE_NOMBRE, limpio);
  } catch (error) {
    // Sin localStorage no se puede recordar el nombre.
  }
}
