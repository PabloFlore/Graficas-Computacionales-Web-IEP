const API_SCORES = '/api/scores';

export async function cargarPuntuaciones() {
  const tbody = document.querySelector('#tabla-puntuaciones tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Cargando...</td></tr>';

  try {
    const res = await fetch(API_SCORES);
    if (!res.ok) throw new Error('Error al obtener datos');
    const scores = await res.json();

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
  const res = await fetch(API_SCORES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, puntos: Number(puntos) }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo guardar la puntuación.');
  }
  return true;
}
