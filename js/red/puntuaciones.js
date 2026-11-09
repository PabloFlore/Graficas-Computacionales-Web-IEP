/**
 * Puntuaciones y envio de scores contra el WebService PHP (Apache/MySQL).
 *
 * El backend corre en Apache (puerto 80), no en Express, porque el codigo
 * PHP no puede ejecutarse desde Node. Ver api/apache-alias-xampp.conf.
 */
const API_BASE = 'http://localhost/api';
const MODOS = ['clasico', 'arcade'];
const COLUMNAS = 4;

let modoActual = 'clasico';

function normalizarModo(modo) {
  return MODOS.includes(modo) ? modo : 'clasico';
}

function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caracter) => {
    const mapa = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return mapa[caracter];
  });
}

function actualizarCabecera(modo) {
  const cabecera = document.getElementById('tabla-puntuaciones-cabecera');
  if (!cabecera) {
    return;
  }

  cabecera.innerHTML = modo === 'arcade'
    ? '<th>#</th><th>Jugador</th><th>Tiempo en cima</th><th>Puntos</th>'
    : '<th>#</th><th>Jugador</th><th>Nivel / Movimientos</th><th>Puntos</th>';
}

function mensajeTabla(tbody, texto, color = '') {
  const estilo = color ? ` style="text-align: center; color: ${color};"` : ' style="text-align: center;"';
  tbody.innerHTML = `<tr><td colspan="${COLUMNAS}"${estilo}>${escaparHtml(texto)}</td></tr>`;
}

function aplicarModo(modo, { cargar = true } = {}) {
  modoActual = normalizarModo(modo);

  document.querySelectorAll('[data-modo-tab]').forEach((tab) => {
    const activa = tab.getAttribute('data-modo-tab') === modoActual;
    tab.classList.toggle('activa', activa);
    tab.setAttribute('aria-selected', activa ? 'true' : 'false');
  });

  const alternarCampos = (selector, visible) => {
    document.querySelectorAll(selector).forEach((campo) => {
      campo.hidden = !visible;
      campo.querySelectorAll('input').forEach((input) => {
        input.disabled = !visible;
      });
    });
  };

  alternarCampos('[data-campo-clasico]', modoActual === 'clasico');
  alternarCampos('[data-campo-arcade]', modoActual === 'arcade');

  const nota = document.getElementById('puntuaciones-nota');
  if (nota) {
    nota.textContent = modoActual === 'arcade'
      ? 'Arcade: puntos = round(tiempo en cima × 100).'
      : 'Clásico: puntos = nivel × 100000 − movimientos.';
  }

  actualizarCabecera(modoActual);

  if (cargar) {
    cargarPuntuaciones(modoActual);
  }
}

export function iniciarPuntuaciones() {
  document.querySelectorAll('[data-modo-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      aplicarModo(tab.getAttribute('data-modo-tab'));
    });
  });

  aplicarModo(modoActual, { cargar: false });
}

export function fijarModoPuntuaciones(modo) {
  aplicarModo(modo);
}

export function modoPuntuacionesActual() {
  return modoActual;
}

/**
 * Carga las puntuaciones del modo indicado desde el backend (PHP/MySQL) y
 * actualiza la tabla HTML.
 */
export async function cargarPuntuaciones(modo = modoActual) {
  modoActual = normalizarModo(modo);

  const tbody = document.querySelector('#tabla-puntuaciones tbody');
  if (!tbody) {
    return;
  }

  actualizarCabecera(modoActual);
  mensajeTabla(tbody, 'Cargando puntuaciones...');

  try {
    const respuesta = await fetch(
      `${API_BASE}/puntuaciones.php?modo=${encodeURIComponent(modoActual)}`
    );
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(datos && datos.error ? datos.error : 'Error al obtener datos');
    }

    const puntuaciones = Array.isArray(datos)
      ? datos
      : (Array.isArray(datos.puntuaciones) ? datos.puntuaciones : []);

    if (puntuaciones.length === 0) {
      mensajeTabla(tbody, 'No hay puntuaciones registradas en este modo.');
      return;
    }

    tbody.innerHTML = '';

    puntuaciones.forEach((registro, index) => {
      const tr = document.createElement('tr');
      const posicion = index + 1;
      const posicionHtml = posicion <= 3
        ? `<span class="medalla">${posicion}</span>`
        : `${posicion}.`;

      let detalle;
      if (modoActual === 'arcade') {
        const tiempo = Number(registro.tiempoCima ?? registro.tiempo_cima ?? 0);
        detalle = `${tiempo.toFixed(1)} s`;
      } else {
        const nivel = registro.nivel != null ? `Nivel ${registro.nivel}` : 'Nivel —';
        const movimientos = registro.movimientos != null
          ? `${registro.movimientos} mov.`
          : '—';
        detalle = `${nivel} · ${movimientos}`;
      }

      tr.innerHTML = `
        <td>${posicionHtml}</td>
        <td>${escaparHtml(registro.nombre)}</td>
        <td>${detalle}</td>
        <td>${Number(registro.puntos) || 0} pts</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error cargando puntuaciones:', error);
    mensajeTabla(tbody, 'Error al cargar las puntuaciones.', '#ff1c42');
  }
}

/**
 * Envia una puntuacion al WebService PHP (INSERT en MySQL).
 * `datos` debe incluir: nombre, modo y nivel/movimientos o tiempoCima.
 */
export async function enviarPuntuacion(datos) {
  const respuesta = await fetch(`${API_BASE}/WebServices.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const texto = await respuesta.text();
  let resultado = null;

  try {
    resultado = texto ? JSON.parse(texto) : null;
  } catch (error) {
    resultado = null;
  }

  if (!respuesta.ok) {
    throw new Error(
      (resultado && (resultado.mensaje || resultado.error)) ||
      texto ||
      'No se pudo guardar la puntuación.'
    );
  }

  if (resultado && resultado.ok === false) {
    throw new Error(resultado.mensaje || 'No se pudo guardar la puntuación.');
  }

  return resultado || { ok: true };
}
