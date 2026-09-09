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
    // Reemplazar la URL por tu endpoint de PHP real (ej. 'api/puntuaciones.php')
    const respuesta = await fetch('/api/puntuaciones.php'); 
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