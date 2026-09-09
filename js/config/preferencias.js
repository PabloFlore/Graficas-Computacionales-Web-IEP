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

function escucharPreferencias() {
  const preferencias = cargarPreferencias();
  const campoVolumen = document.getElementById('cfg-volumen');
  const campoSonido = document.getElementById('cfg-sonido');
  const campoDificultad = document.getElementById('cfg-dificultad');

  if (campoVolumen) {
    campoVolumen.addEventListener('input', () => {
      preferencias.volumen = parseInt(campoVolumen.value, 10);
      guardarPreferencias(preferencias);
    });
  }

  if (campoSonido) {
    campoSonido.addEventListener('change', () => {
      preferencias.sonido = campoSonido.checked;
      guardarPreferencias(preferencias);
    });
  }

  if (campoDificultad) {
    campoDificultad.addEventListener('change', () => {
      preferencias.dificultad = campoDificultad.value;
      guardarPreferencias(preferencias);
    });
  }
}

export function iniciarPreferencias() {
  const preferencias = cargarPreferencias();
  aplicarPreferencias(preferencias);
  escucharPreferencias();
}