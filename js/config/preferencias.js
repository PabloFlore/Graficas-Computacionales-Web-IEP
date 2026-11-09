const CLAVE_PREFERENCIAS = 'mini-metropolis.preferencias';

const PREFERENCIAS_POR_DEFECTO = {
  volumen: 50,
  sonido: true,
  dificultad: 'normal'
};

export function cargarPreferencias() {
  let datos = null;
  try {
    const crudo = localStorage.getItem(CLAVE_PREFERENCIAS);
    if (crudo) {
      datos = JSON.parse(crudo);
    }
  } catch (error) {
    datos = null;
  }

  const preferencias = Object.assign({}, PREFERENCIAS_POR_DEFECTO, datos || {});
  guardarPreferencias(preferencias);
  return preferencias;
}

export function guardarPreferencias(preferencias) {
  try {
    localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(preferencias));
  } catch (error) {
    console.error('No se pudo guardar las preferencias:', error);
  }
}

function aplicarPreferencias(preferencias) {
  const campoVolumen = document.getElementById('cfg-volumen');
  const campoSonido = document.getElementById('cfg-sonido');
  const campoDificultad = document.getElementById('cfg-dificultad');

  if (campoVolumen) {
    campoVolumen.value = preferencias.volumen;
  }
  if (campoSonido) {
    campoSonido.checked = preferencias.sonido;
  }
  if (campoDificultad) {
    campoDificultad.value = preferencias.dificultad;
  }
}

// Objeto unico de preferencias en memoria: todos los cambios se escriben
// sobre el mismo, para que un ajuste no pise a otro al guardar.
let actuales = null;

const NIVELES_DIFICULTAD = ['facil', 'normal', 'dificil'];

function escucharPreferencias() {
  const campoVolumen = document.getElementById('cfg-volumen');
  const campoSonido = document.getElementById('cfg-sonido');
  const campoDificultad = document.getElementById('cfg-dificultad');

  if (campoVolumen) {
    campoVolumen.addEventListener('input', () => {
      actuales.volumen = parseInt(campoVolumen.value, 10);
      guardarPreferencias(actuales);
    });
  }

  if (campoSonido) {
    campoSonido.addEventListener('change', () => {
      actuales.sonido = campoSonido.checked;
      guardarPreferencias(actuales);
    });
  }

  if (campoDificultad) {
    campoDificultad.addEventListener('change', () => {
      actuales.dificultad = campoDificultad.value;
      guardarPreferencias(actuales);
    });
  }
}

export function iniciarPreferencias() {
  actuales = cargarPreferencias();
  aplicarPreferencias(actuales);
  escucharPreferencias();
}

/**
 * Aplica la dificultad compartida que llega del servidor: fija el selector,
 * guarda la preferencia local y bloquea el selector si hay jugadores
 * conectados (en ese caso el servidor rechaza cualquier cambio).
 */
export function fijarDificultad(nivel, bloqueada = false) {
  if (!NIVELES_DIFICULTAD.includes(nivel)) {
    return;
  }

  if (!actuales) {
    actuales = cargarPreferencias();
  }

  actuales.dificultad = nivel;
  guardarPreferencias(actuales);

  const campoDificultad = document.getElementById('cfg-dificultad');
  if (campoDificultad) {
    campoDificultad.value = nivel;
    campoDificultad.disabled = bloqueada;
  }

  const nota = document.getElementById('cfg-dificultad-nota');
  if (nota) {
    nota.hidden = !bloqueada;
  }
}