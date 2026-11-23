import { iniciarNavegacion, mostrarVista } from './util/navegacion.js';
import { iniciarEscena } from './motor/escena.js';
import { iniciarFormulario } from './red/formulario.js';
import { iniciarMultijugador, conectarJugador, enviarPosicion, emitirEscenario } from './red/multijugador.js';
import { iniciarSelectorPatos } from './motor/selector-patos.js';
import { iniciarPatoMenu } from './motor/pato-menu.js';
import { cargarPuntuaciones, enviarPuntuacion, obtenerPuntuaciones } from './red/puntuaciones.js';
import { iniciarPreviewsEscenario } from './motor/previews-escenario.js';

let escenarioPendiente = 'piramide';
let modoPendiente = 'carrera';
let dificultadPendiente = 'normal';
let jugadorRegistrado = false;
let ignorarEscenarioPropio = false;

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
      try { await enviarPuntuacion(nombre, score); } catch {}
      cargarRankingMenu();
    },
  });
  const selectorPatos = iniciarSelectorPatos();

  iniciarMultijugador({
    alEntrar: (jugador) => {
      escena.agregarJugadorRemoto(jugador);
      agregarJugadorSala(jugador);
    },
    alMover: (jugador) => escena.moverJugadorRemoto(jugador),
    alSalir: (id) => {
      escena.quitarJugadorRemoto(id);
      quitarJugadorSala(id);
    },
    alCambiarEscenario: ({ escenario }) => {
      if (ignorarEscenarioPropio) {
        ignorarEscenarioPropio = false;
        return;
      }
      escena.reiniciar(escenario);
    },
  });

  engancharMultijugador();
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

function engancharMultijugador() {
  document.getElementById('boton-crear-sala')?.addEventListener('click', () => registrarEnSala('nombre-multi'));
  document.getElementById('boton-unirse')?.addEventListener('click', () => registrarEnSala('nombre-unirse'));

  document.getElementById('boton-iniciar-multi')?.addEventListener('click', () => {
    emitirEscenario(escenarioPendiente, modoPendiente);
    mostrarVista('vista-juego');
  });
}

function registrarEnSala(idCampo) {
  const campo = document.getElementById(idCampo);
  const nombre = campo?.value.trim();
  if (!nombre) {
    campo?.classList.add('campo--error');
    campo?.focus();
    campo?.addEventListener('input', () => campo.classList.remove('campo--error'), { once: true });
    return;
  }

  if (!jugadorRegistrado) {
    ignorarEscenarioPropio = true;
    setTimeout(() => { ignorarEscenarioPropio = false; }, 3000);
    conectarJugador(nombre);
    jugadorRegistrado = true;
  }

  const anfitrion = document.querySelector('#sala-jugadores-lista .sala-jugador--anfitrion');
  if (anfitrion) anfitrion.textContent = `Tú (${nombre})`;
  mostrarVista('vista-sala-espera');
}

function agregarJugadorSala(jugador) {
  const lista = document.getElementById('sala-jugadores-lista');
  if (!lista || lista.querySelector(`[data-id="${jugador.id}"]`)) return;
  const li = document.createElement('li');
  li.className = 'sala-jugador';
  li.dataset.id = jugador.id;
  li.textContent = jugador.nombre;
  lista.appendChild(li);
}

function quitarJugadorSala(id) {
  document.querySelector(`#sala-jugadores-lista [data-id="${id}"]`)?.remove();
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

    const botonDif = e.target.closest('.boton--dificultad');
    if (botonDif) {
      document.querySelectorAll('.boton--dificultad').forEach((b) =>
        b.classList.remove('boton--dificultad--activo')
      );
      botonDif.classList.add('boton--dificultad--activo');
      dificultadPendiente = botonDif.dataset.dificultad || 'normal';
    }

    const nav = e.target.closest('[data-vista]');
    if (nav?.dataset.vista === 'vista-dificultad') {
      document.querySelectorAll('.boton--dificultad').forEach((b) =>
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
    escena.reiniciar(escenarioPendiente, cfg.colorCuerpo, cfg.colorOjo, dificultadPendiente ?? 'normal');
    emitirEscenario(escenarioPendiente, modoPendiente);
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
