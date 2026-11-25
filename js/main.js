import { iniciarNavegacion, mostrarVista } from './util/navegacion.js';
import { iniciarEscena } from './motor/escena.js';
import { iniciarFormulario } from './red/formulario.js';
import { iniciarMultijugador, buscarPartida, cancelarBusqueda, reportarEliminado, enviarPosicion } from './red/multijugador.js';
import { iniciarSelectorPatos } from './motor/selector-patos.js';
import { iniciarPatoMenu } from './motor/pato-menu.js';
import { cargarPuntuaciones, enviarPuntuacion, obtenerPuntuaciones } from './red/puntuaciones.js';
import { iniciarPreviewsEscenario } from './motor/previews-escenario.js';

let escenarioPendiente = 'piramide';
let modoPendiente = 'carrera';
let dificultadPendiente = 'normal';
let nombreMultiActual = '';

document.addEventListener('DOMContentLoaded', async () => {
  iniciarNavegacion();
  iniciarFormulario();
  iniciarPatoMenu();
  engancharRankingVerMas();
  cargarRankingMenu();
  iniciarPreviewsEscenario();

  const escena        = await iniciarEscena({
    alMoverJugador: enviarPosicion,
    alGanar: async ({ nombre, score }) => {
      try {
        await enviarPuntuacion(nombre, score);
      } catch (err) {
        console.warn('No se pudo guardar la puntuación (¿Apache/MySQL encendidos?):', err);
      }
      cargarRankingMenu();
    },
    alPerder: reportarEliminado,
  });
  const selectorPatos = iniciarSelectorPatos();

  iniciarMultijugador({
    alEncontrarPartida: (data) => {
      const { semilla, dificultad, oponente, spawn } = data;
      const cfg = selectorPatos.getPatolSeleccionado();
      escena.reiniciar('batalla', cfg.colorCuerpo, cfg.colorOjo, dificultad ?? 'normal', 'carrera', semilla, spawn);
      escena.setNombreJugador(nombreMultiActual);
      escena.agregarJugadorRemoto(oponente);
      mostrarVista('vista-juego');
    },
    alMover: (j) => escena.moverJugadorRemoto(j),
    alSalir: (id) => escena.quitarJugadorRemoto(id),
    alRivalEliminado: () => escena.mostrarVictoriaBatalla(),
  });

  engancharMultijugador(escena, selectorPatos);
  engancharSeleccion(escena);
  engancharColores(escena, selectorPatos);
  engancharPausa(escena);
  engancharPanelesPausa();
});

async function cargarRankingMenu() {
  const lista = document.getElementById('ranking-menu-lista');
  if (!lista) return;
  try {
    const scores = await obtenerPuntuaciones();
    if (scores.length === 0) {
      lista.innerHTML = '<li class="ranking-menu__cargando">Sin puntuaciones aún</li>';
      actualizarBotonVerMas(0);
      return;
    }
    lista.innerHTML = scores
      .map((s, i) => `<li>
        <span class="ranking__pos">${String(i + 1).padStart(2, '0')}.</span>
        <span class="ranking__nombre">${s.nombre}</span>
        <span class="ranking__pts">${s.puntos}</span>
      </li>`)
      .join('');
    actualizarBotonVerMas(scores.length);
  } catch {
    lista.innerHTML = '<li class="ranking-menu__cargando">No disponible</li>';
    actualizarBotonVerMas(0);
  }
}

function engancharRankingVerMas() {
  const boton = document.getElementById('ranking-menu-ver-mas');
  const lista = document.getElementById('ranking-menu-lista');
  if (!boton || !lista) return;
  boton.addEventListener('click', () => {
    const expandida = lista.classList.toggle('ranking-menu__lista--expandida');
    boton.textContent = expandida ? 'Ver menos' : 'Ver más';
  });
}

function actualizarBotonVerMas(cantidad) {
  const boton = document.getElementById('ranking-menu-ver-mas');
  const lista = document.getElementById('ranking-menu-lista');
  if (!boton || !lista) return;
  lista.classList.remove('ranking-menu__lista--expandida');
  boton.textContent = 'Ver más';
  boton.classList.toggle('ranking-menu__ver-mas--visible', cantidad > 5);
}

function engancharMultijugador(escena, selectorPatos) {
  document.getElementById('boton-ir-multi')?.addEventListener('click', () => {
    if (window.fbNombreJugador) {
      nombreMultiActual = window.fbNombreJugador;
      const cfg = selectorPatos.getPatolSeleccionado();
      buscarPartida(nombreMultiActual, cfg.colorCuerpo, cfg.colorOjo, 'normal');
      mostrarVista('vista-multi-espera');
    } else {
      mostrarVista('vista-multi-nombre');
    }
  });

  document.getElementById('boton-multi-nombre')?.addEventListener('click', () => {
    const campo = document.getElementById('nombre-multi-lobby');
    const nombre = campo?.value.trim();
    if (!nombre) {
      campo?.classList.add('campo--error');
      campo?.focus();
      campo?.addEventListener('input', () => campo.classList.remove('campo--error'), { once: true });
      return;
    }
    nombreMultiActual = nombre;
    const cfg = selectorPatos.getPatolSeleccionado();
    buscarPartida(nombreMultiActual, cfg.colorCuerpo, cfg.colorOjo, 'normal');
    mostrarVista('vista-multi-espera');
  });

  document.getElementById('boton-cancelar-multi')?.addEventListener('click', () => {
    cancelarBusqueda();
    mostrarVista('vista-menu');
  });
}

function engancharSeleccion(escena) {
  document.addEventListener('click', (e) => {
    const tarjeta = e.target.closest('.tarjeta-escenario');
    if (tarjeta) {
      document.querySelectorAll('.tarjeta-escenario').forEach((t) =>
        t.classList.remove('tarjeta-escenario--activa')
      );
      tarjeta.classList.add('tarjeta-escenario--activa');
      escenarioPendiente = tarjeta.dataset.escenario || 'piramide';
    }

    const mundoCard = e.target.closest('.mundo-card');
    if (mundoCard) {
      document.querySelectorAll('.mundo-card').forEach((c) =>
        c.classList.remove('mundo-card--activo')
      );
      mundoCard.classList.add('mundo-card--activo');
    }

    const botonModo = e.target.closest('.boton--modo');
    if (botonModo) {
      const grupo = botonModo.closest('.modos');
      grupo?.querySelectorAll('.boton--modo').forEach((b) =>
        b.classList.remove('boton--modo-activo')
      );
      botonModo.classList.add('boton--modo-activo');
      modoPendiente = botonModo.dataset.modo || 'carrera';
    }

    const botonDif = e.target.closest('.boton--dificultad:not(.boton--dif-multi)');
    if (botonDif) {
      document.querySelectorAll('.boton--dificultad:not(.boton--dif-multi)').forEach((b) =>
        b.classList.remove('boton--dificultad--activo')
      );
      botonDif.classList.add('boton--dificultad--activo');
      dificultadPendiente = botonDif.dataset.dificultad || 'normal';
    }

    const nav = e.target.closest('[data-vista]');
    if (nav?.dataset.vista === 'vista-dificultad') {
      document.querySelectorAll('.boton--dificultad:not(.boton--dif-multi)').forEach((b) =>
        b.classList.remove('boton--dificultad--activo')
      );
      dificultadPendiente = null;
    }
  });
}

function engancharColores(escena, selectorPatos) {
  document.addEventListener('click', (e) => {
    const botonConfirmar = e.target.closest('#boton-confirmar-color');
    if (!botonConfirmar) return;

    const campoNombre = document.getElementById('nombre-jugador');
    const nombre = campoNombre?.value.trim();
    if (!nombre) {
      campoNombre.classList.add('campo--error');
      campoNombre.focus();
      campoNombre.addEventListener('input', () => campoNombre.classList.remove('campo--error'), { once: true });
      return;
    }

    const cfg = selectorPatos.getPatolSeleccionado();
    escena.reiniciar(escenarioPendiente, cfg.colorCuerpo, cfg.colorOjo, dificultadPendiente ?? 'normal', modoPendiente ?? 'carrera');
    escena.setNombreJugador(nombre);
    mostrarVista('vista-juego');
  });
}

function engancharPanelesPausa() {
  document.getElementById('pausa-btn-config')?.addEventListener('click', () => {
    document.querySelector('.pausa-panel--menu').hidden = true;
    document.querySelector('.pausa-panel--config').hidden = false;
  });
  document.getElementById('pausa-btn-volver')?.addEventListener('click', () => {
    document.querySelector('.pausa-panel--config').hidden = true;
    document.querySelector('.pausa-panel--menu').hidden = false;
  });
}

function engancharPausa(escena) {
  document.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-vista]');
    if (!boton) return;
    const destino = boton.getAttribute('data-vista');
    if (destino === 'vista-pausa') escena.pausarCronometro();
    if (destino === 'vista-juego') escena.reanudarCronometro();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const juego = document.getElementById('vista-juego');
    const pausa = document.getElementById('vista-pausa');
    if (juego.classList.contains('activa')) escena.pausarCronometro();
    if (pausa.classList.contains('activa')) escena.reanudarCronometro();
  });
}
