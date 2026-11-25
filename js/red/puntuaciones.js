const API_PUNTUACIONES = 'http://localhost/api/puntuaciones.php';
const API_GUARDAR = 'http://localhost/api/WebServices.php';

export async function obtenerPuntuaciones() {
  const res = await fetch(API_PUNTUACIONES);
  if (!res.ok) throw new Error('Error al obtener datos');
  return await res.json();
}

export async function cargarPuntuaciones() {
  const tbody = document.querySelector('#tabla-puntuaciones tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Cargando...</td></tr>';

  try {
    const scores = await obtenerPuntuaciones();

    tbody.innerHTML = '';

    if (scores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No hay puntuaciones registradas</td></tr>';
      return;
    }

    scores.forEach((r, i) => {
      const tr = document.createElement('tr');
      const pos = i + 1;
      tr.innerHTML = `
        <td>${pos <= 3 ? `<span class="medalla">${pos}</span>` : `${pos}. `}${r.nombre}</td>
        <td>${r.puntos} pts</td>
      `;
      tbody.appendChild(tr);
    });
  } catch {
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#ff1c42;">Error al cargar las puntuaciones.</td></tr>';
  }
}

export async function enviarPuntuacion(nombre, puntos) {
  const params = new URLSearchParams({ nombre, score: String(puntos) });
  const res = await fetch(`${API_GUARDAR}?${params}`, { method: 'POST' });
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(texto || 'No se pudo guardar la puntuación.');
  }
  return true;
}
