/**
 * Actualiza los elementos del HUD de la partida. No depende de Three.js: la
 * escena le pasa el estado y este modulo solo pinta el texto.
 */

const NOMBRES_OBJETO = {
  resorte: 'Resorte (E: salta 2)',
  escudo: 'Escudo (automático)',
  radar: 'Radar (E: 5 s)'
};

function fijarTexto(id, texto) {
  const elemento = document.getElementById(id);
  if (elemento) {
    elemento.textContent = texto;
  }
}

function pintarVidas(vidas, totalVidas) {
  const contenedor = document.getElementById('hud-vidas');
  if (!contenedor) {
    return;
  }

  contenedor.querySelectorAll('.vida').forEach((marca, indice) => {
    marca.classList.toggle('vida--perdida', indice >= vidas);
  });
  contenedor.setAttribute('aria-label', `${vidas} de ${totalVidas} vidas`);
}

function pintarNiveles(nivel, totalNiveles) {
  const contenedor = document.getElementById('hud-niveles');
  if (!contenedor) {
    return;
  }

  const marcas = contenedor.querySelectorAll('.nivel');
  const actual = Math.max(1, Math.min(totalNiveles, nivel));

  marcas.forEach((marca, indice) => {
    const numero = indice + 1;
    marca.classList.toggle('nivel--activo', numero === actual);
    marca.classList.toggle('nivel--completado', numero < actual);
  });

  contenedor.setAttribute('aria-label', `Nivel ${actual} de ${totalNiveles}`);
}

function pintarJugadores(activos, conectados) {
  const elemento = document.getElementById('hud-jugadores');
  if (!elemento) {
    return;
  }

  elemento.textContent = `${activos}/${conectados}`;
  elemento.setAttribute('aria-label', `${activos} de ${conectados} jugadores activos`);
}

export function pintarHud({
  inventario,
  movimientos,
  vidas = 0,
  totalVidas = 3,
  nivel = 1,
  totalNiveles = 3,
  jugadoresActivos = 0,
  jugadoresConectados = 0,
  aturdidoRestante,
  radarRestante
}) {
  fijarTexto('hud-inventario', inventario ? NOMBRES_OBJETO[inventario] : 'Vac��o');
  fijarTexto('hud-movimientos', String(movimientos));
  pintarVidas(vidas, totalVidas);
  pintarNiveles(nivel, totalNiveles);
  pintarJugadores(jugadoresActivos, jugadoresConectados);

  const estado = document.getElementById('hud-estado');
  if (estado) {
    const textos = [];
    if (vidas === 0) {
      textos.push('Sin vidas · esperando al ganador');
    }
    if (aturdidoRestante > 0) {
      textos.push(`Aturdido ${aturdidoRestante.toFixed(1)} s`);
    }
    if (radarRestante > 0) {
      textos.push(`Radar activo ${radarRestante.toFixed(1)} s`);
    }
    estado.textContent = textos.join(' · ');
    estado.hidden = textos.length === 0;
  }
}

function formatearTiempo(segundos) {
  const total = Math.max(0, Math.ceil(Number(segundos) || 0));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

/**
 * Pinta el contador del menu de inicio: jugadores con vidas y total conectado.
 */
export function actualizarContadorMenu(datos, modo = 'clasico') {
  const id = modo === 'arcade' ? 'menu-jugadores-arcade' : 'menu-jugadores';
  const elemento = document.getElementById(id);
  if (!elemento || !datos) {
    return;
  }

  const activos = Number.isInteger(datos.activos) ? datos.activos : 0;
  const conectados = Number.isInteger(datos.conectados) ? datos.conectados : activos;
  const enLinea = conectados > activos ? ` (${conectados} en línea)` : '';

  if (modo === 'arcade') {
    elemento.textContent = `Jugadores en arcade: ${activos}${enLinea}`;
    return;
  }

  elemento.textContent = `Jugadores activos: ${activos}${enLinea}`;
}

/**
 * HUD del modo arcade: cronometro, tiempo personal en la cima y ranking.
 */
export function pintarHudArcade({
  estado = 'espera',
  restante = 0,
  cuentaRestante = 0,
  tiempoCima = 0,
  ranking = [],
  jugadores = []
} = {}) {
  fijarTexto('hud-modo', 'Arcade');
  fijarTexto('hud-arcade-tiempo', formatearTiempo(restante));
  fijarTexto('hud-arcade-cima', `${(Number(tiempoCima) || 0).toFixed(1)} s`);

  const lista = document.getElementById('hud-arcade-ranking');
  if (lista) {
    lista.replaceChildren();

    const entradas = Array.isArray(ranking) && ranking.length > 0
      ? ranking
      : jugadores.map((jugador) => ({
        id: jugador.id,
        nombre: jugador.nombre,
        tiempoCima: jugador.tiempoCima
      }));

    if (entradas.length === 0) {
      const vacio = document.createElement('li');
      vacio.className = 'ranking__vacio';
      vacio.textContent = 'Sin jugadores';
      lista.appendChild(vacio);
    } else {
      entradas.forEach((entrada, indice) => {
        const fila = document.createElement('li');
        fila.className = 'ranking__fila';

        const nombre = document.createElement('span');
        nombre.className = 'ranking__nombre';
        nombre.textContent = `${indice + 1}. ${entrada.nombre || 'Pato'}`;

        const tiempo = document.createElement('span');
        tiempo.className = 'ranking__tiempo';
        tiempo.textContent = `${(Number(entrada.tiempoCima) || 0).toFixed(1)} s`;

        fila.append(nombre, tiempo);
        lista.appendChild(fila);
      });
    }
  }

  const aviso = document.getElementById('hud-estado');
  if (aviso) {
    let texto = '';
    if (estado === 'cuenta') {
      texto = `Empieza en ${Math.max(0, Math.ceil(Number(cuentaRestante) || 0))} s`;
    } else if (estado === 'espera') {
      texto = 'Esperando jugadores';
    } else if (estado === 'fin') {
      texto = 'Tiempo agotado';
    }

    aviso.textContent = texto;
    aviso.hidden = texto === '';
  }
}

export function mostrarFinPartida(texto) {
  const fin = document.getElementById('fin-partida');
  if (fin) {
    fin.textContent = texto;
    fin.hidden = false;
  }
}

export function ocultarFinPartida() {
  const fin = document.getElementById('fin-partida');
  if (fin) {
    fin.hidden = true;
  }
}
