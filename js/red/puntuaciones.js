/**
 * Puntuaciones y envío de scores contra el WebService PHP (Apache/MySQL).
 */
const API_BASE = 'http://localhost/WebServices';

/**
 * Carga las puntuaciones desde el backend (PHP/MySQL) y actualiza la tabla HTML.
 */
export async function cargarPuntuaciones() {
    const tbody = document.querySelector('#tabla-puntuaciones tbody');
    if (!tbody) return;

  // Renderizar estado de carga
    tbody.innerHTML = `
        <tr>
            <td colspan="2" style="text-align: center;">Cargando puntuaciones...</td>
        </tr>
    `;

try {
    const respuesta = await fetch(`${API_BASE}/puntuaciones.php`);
    if (!respuesta.ok) throw new Error('Error al obtener datos');

    const puntuaciones = await respuesta.json();

    // Limpiar tabla
    tbody.innerHTML = '';

    if (puntuaciones.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align: center;">No hay puntuaciones registradas</td></tr>`;
        return;
    }

    // Insertar registros dinámicamente
    puntuaciones.forEach((registro, index) => {
        const tr = document.createElement('tr');
        const posicion = index + 1;
        const claseMedalla = posicion <= 3 ? `medalla` : '';

    tr.innerHTML = `
        <td>
            ${posicion <= 3 ? `<span class="${claseMedalla}">${posicion}</span>` : `${posicion}. `}
            ${registro.nombre}
        </td>
        <td>${registro.puntos} pts</td>
    `;
        tbody.appendChild(tr);
    });

} catch (error) {
    console.error('Error cargando puntuaciones:', error);
    tbody.innerHTML = `
        <tr>
            <td colspan="2" style="text-align: center; color: #ff1c42;">
                Error al cargar las puntuaciones.
            </td>
        </tr>
    `;
    }
}

/**
 * Envía un score al WebService PHP (INSERT en MySQL).
 * Devuelve true si el registro se guardó correctamente.
 */
export async function enviarPuntuacion(nombre, score) {
    const datos = new URLSearchParams({
        nombre: nombre,
        score: score
    });

    const respuesta = await fetch(`${API_BASE}/WebServices.php?${datos.toString()}`);
    const texto = await respuesta.text();

    if (!texto.includes('Correctamente')) {
        throw new Error(texto || 'No se pudo guardar la puntuación.');
    }

    return true;
}