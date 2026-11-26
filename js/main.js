import { iniciarNavegacion, mostrarVista } from './util/navegacion.js';
import { iniciarEscena } from './motor/escena.js';
import { iniciarFormulario } from './red/formulario.js';
import {
  iniciarPuntuaciones,
  cargarPuntuaciones,
  enviarPuntuacion,
  obtenerPuntuaciones
} from './red/puntuaciones.js';
import { iniciarPerfil, obtenerPerfil, nombreParaPuntaje } from './red/perfil.js';
import {
  iniciarMultijugador,
  conectarJugador,
  desconectarJugador,
  reingresarJugador,
  enviarPosicion,
  cambiarDificultad,
  enviarRecogida,
  enviarCima,
  enviarMina,
  enviarEmpuje,
  buscarPartida,
  cancelarBusqueda,
  reportarEliminado
} from './red/multijugador.js';
import { cargarPreferencias, fijarDificultad } from './config/preferencias.js';
import { actualizarContadorMenu } from './motor/hud.js';
import { iniciarSelectorPatos } from './motor/selector-patos.js';
import { iniciarPatoMenu } from './motor/pato-menu.js';
import { iniciarPreviewsEscenario } from './motor/previews-escenario.js';

const VISTAS_DE_JUEGO = ['vista-juego', 'vista-pausa'];

let escena = null;
let modoActual = 'clasico';
let escenarioPendiente = 'piramide';
let modoPendiente = 'carrera';
let dificultadPendiente = 'normal';
let nombreMultiActual = '';

document.addEventListener('DOMContentLoaded', async () => {
  iniciarPerfil();
  iniciarPuntuaciones();
  iniciarNavegacion({ alCambiarVista: manejarCambioVista });
  iniciarFormulario();
  iniciarPatoMenu();
  engancharRankingVerMas();
  cargarRankingMenu();
  iniciarPreviewsEscenario();

  escena = await iniciarEscena({
    alMoverJugador: enviarPosicion,
    dificultad: cargarPreferencias().dificultad,
    alRecogerPowerup: (x, z) => enviarRecogida(x, z),
    alLlegarCima: (movimientos) => enviarCima(movimientos),
    alPisarMina: (x, z) => enviarMina(x, z),
    alEmpujar: (id, dx, dz) => enviarEmpuje(id, dx, dz),
    alRegistrarPuntaje: registrarPuntajePartida,
    alGanar: async ({ nombre, score }) => {
      await registrarPuntajeCarrera(nombre, score);
      cargarRankingMenu();
    },
    alPerder: reportarEliminado
  });
  const selectorPatos = iniciarSelectorPatos();

  iniciarMultijugador({
    alEntrar: (jugador) => escena.agregarJugadorRemoto?.(jugador),
    alMover: (jugador) => escena.moverJugadorRemoto?.(jugador),
    alSalir: (id) => escena.quitarJugadorRemoto?.(id),
    alIdentificarse: (jugador) => escena.identificarJugador?.(jugador),
    alCambiarDificultad: (estado) => {
      fijarDificultad(estado.nivel, estado.bloqueada);
      escena.aplicarDificultad?.(estado.nivel);
    },
    alEstadoPartida: (estado) => escena.aplicarEstadoPartida?.(estado),
    alPowerupTomado: (datos) => escena.registrarPowerupTomado?.(datos),
    alVidas: (datos) => escena.aplicarVidas?.(datos),
    alNuevaRonda: (datos) => escena.aplicarNuevaRonda?.(datos),
    alJugadoresActivos: (datos) => {
      escena.aplicarJugadoresActivos?.(datos);
      actualizarContadorMenu(datos, 'clasico');
    },
    alEstadoArcade: (estado) => escena.aplicarEstadoArcade?.(estado),
    alFinArcade: (datos) => escena.aplicarFinArcade?.(datos),
    alJugadoresArcade: (datos) => actualizarContadorMenu(datos, 'arcade'),
    alEmpujeConfirmado: (datos) => escena.aplicarEmpujeConfirmado?.(datos),
    alEmpujado: (datos) => escena.aplicarEmpujado?.(datos),
    alTeletransporteArcade: (datos) => escena.aplicarTeletransporteArcade?.(datos),
    alEncontrarPartida: (data) => {
      const { semilla, dificultad, oponente, spawn } = data;
      const cfg = selectorPatos.getPatolSeleccionado();
      escena.reiniciar?.(
        'batalla',
        cfg.colorCuerpo,
        cfg.colorOjo,
        dificultad ?? 'normal',
        'carrera',
        semilla,
        spawn
      );
      escena.setNombreJugador?.(nombreMultiActual);
      escena.agregarJugadorRemoto?.(oponente);
      mostrarVista('vista-juego');
    },
    alRivalEliminado: () => escena.mostrarVictoriaBatalla?.()
  });

  engancharConexion();
  engancharDificultad();
  engancharMultijugador(escena, selectorPatos);
  engancharSeleccion(escena);
  engancharColores(escena, selectorPatos);
  engancharPausa(escena);
  engancharPanelesPausa();

  sincronizarJuego();
});

function manejarCambioVista(anterior, nueva, datos = {}) {
  const saliaDeJuego = VISTAS_DE_JUEGO.includes(anterior);
  const entraAJuego = VISTAS_DE_JUEGO.includes(nueva);

  if (saliaDeJuego && !entraAJuego) {
    desconectarJugador();
  }

  if (!entraAJuego || !datos.modo) {
    return;
  }

  modoActual = datos.modo === 'arcade' ? 'arcade' : 'clasico';

  if (!saliaDeJuego) {
    entrarAlJuego(true);
  }
}

function entrarAlJuego(reiniciar = false) {
  if (!escena) {
    return;
  }

  escena.cambiarModo?.(modoActual, { reiniciar });

  const campo =
    document.getElementById('nombre-jugador') ||
    document.getElementById('nombre-jugador-menu');
  reingresarJugador(campo ? campo.value : '', modoActual);
}

async function registrarPuntajeCarrera(nombre, score) {
  const puntos = Math.max(0, Number(score) || 0);

  try {
    await enviarPuntuacion(nombre, puntos);
    await cargarPuntuaciones('clasico');
  } catch (error) {
    console.warn('No se pudo guardar la puntuación (¿Apache/MySQL encendidos?):', error);
  }
}

async function registrarPuntajePartida(datos) {
  if (!datos || !['clasico', 'arcade'].includes(datos.modo)) {
    return;
  }

  const nombre = nombreParaPuntaje() || 'Pato anónimo';
  const perfil = obtenerPerfil();
  const envio = {
    nombre,
    modo: datos.modo,
    origen: perfil ? 'facebook' : 'manual'
  };

  if (perfil) {
    envio.jugadorId = perfil.id;
    envio.foto = perfil.foto;
  }

  if (datos.modo === 'arcade') {
    const tiempo = Number(datos.tiempoCima);
    if (!Number.isFinite(tiempo) || tiempo <= 0) {
      return;
    }
    envio.tiempoCima = tiempo;
  } else {
    const nivel = Number(datos.nivel);
    const movimientos = Number(datos.movimientos);
    if (!Number.isInteger(nivel) || !Number.isInteger(movimientos)) {
      return;
    }
    envio.nivel = nivel;
    envio.movimientos = movimientos;
  }

  try {
    await enviarPuntuacion(envio);
    await cargarPuntuaciones(datos.modo);
  } catch (error) {
    console.error('No se pudo guardar la puntuación de la partida:', error);
  }
}

function sincronizarJuego() {
  const enJuego = VISTAS_DE_JUEGO.some((id) => {
    const vista = document.getElementById(id);
    return vista && vista.classList.contains('activa');
  });

  if (enJuego) {
    entrarAlJuego(true);
  }
}

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

    const filas = scores.slice(0, 10).map((score, index) => {
      const fila = document.createElement('li');
      const posicion = document.createElement('span');
      posicion.className = 'ranking__pos';
      posicion.textContent = `${String(index + 1).padStart(2, '0')}.`;

      const nombre = document.createElement('span');
      nombre.className = 'ranking__nombre';
      nombre.textContent = score.nombre ?? '';

      const puntos = document.createElement('span');
      puntos.className = 'ranking__pts';
      puntos.textContent = String(score.puntos ?? score.score ?? 0);

      fila.append(posicion, nombre, puntos);
      return fila;
    });

    lista.replaceChildren(...filas);
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
  const iniciarBusqueda = () => {
    const nombre = window.fbNombreJugador || document.getElementById('nombre-jugador')?.value.trim();
    if (!nombre) {
      mostrarVista('vista-multi-nombre');
      return;
    }

    nombreMultiActual = nombre;
    const cfg = selectorPatos.getPatolSeleccionado();
    buscarPartida(nombreMultiActual, cfg.colorCuerpo, cfg.colorOjo, 'normal');
    mostrarVista('vista-multi-espera');
  };

  document.getElementById('boton-ir-multi')?.addEventListener('click', iniciarBusqueda);

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

function engancharSeleccion() {
  document.addEventListener('click', (event) => {
    const tarjeta = event.target.closest('.tarjeta-escenario');
    if (tarjeta) {
      document.querySelectorAll('.tarjeta-escenario').forEach((item) =>
        item.classList.remove('tarjeta-escenario--activa')
      );
      tarjeta.classList.add('tarjeta-escenario--activa');
      escenarioPendiente = tarjeta.dataset.escenario || 'piramide';
    }

    const mundoCard = event.target.closest('.mundo-card');
    if (mundoCard) {
      document.querySelectorAll('.mundo-card').forEach((item) =>
        item.classList.remove('mundo-card--activo')
      );
      mundoCard.classList.add('mundo-card--activo');
    }

    const botonModo = event.target.closest('.boton--modo');
    if (botonModo) {
      const grupo = botonModo.closest('.modos');
      grupo?.querySelectorAll('.boton--modo').forEach((boton) =>
        boton.classList.remove('boton--modo-activo')
      );
      botonModo.classList.add('boton--modo-activo');
      modoPendiente = botonModo.dataset.modo || 'carrera';
    }

    const botonDificultad = event.target.closest('.boton--dificultad:not(.boton--dif-multi)');
    if (botonDificultad) {
      document.querySelectorAll('.boton--dificultad:not(.boton--dif-multi)').forEach((boton) =>
        boton.classList.remove('boton--dificultad--activo')
      );
      botonDificultad.classList.add('boton--dificultad--activo');
      dificultadPendiente = botonDificultad.dataset.dificultad || 'normal';
    }

    const nav = event.target.closest('[data-vista]');
    if (nav?.dataset.vista === 'vista-dificultad') {
      document.querySelectorAll('.boton--dificultad:not(.boton--dif-multi)').forEach((boton) =>
        boton.classList.remove('boton--dificultad--activo')
      );
      dificultadPendiente = null;
    }
  });
}

function engancharColores(escena, selectorPatos) {
  document.addEventListener('click', (event) => {
    const botonConfirmar = event.target.closest('#boton-confirmar-color');
    if (!botonConfirmar) return;

    const campoNombre = document.getElementById('nombre-jugador');
    const nombre = campoNombre?.value.trim();
    if (!nombre) {
      campoNombre?.classList.add('campo--error');
      campoNombre?.focus();
      campoNombre?.addEventListener('input', () => campoNombre.classList.remove('campo--error'), {
        once: true
      });
      return;
    }

    const cfg = selectorPatos.getPatolSeleccionado();
    escena.reiniciar?.(
      escenarioPendiente,
      cfg.colorCuerpo,
      cfg.colorOjo,
      dificultadPendiente ?? 'normal',
      modoPendiente ?? 'carrera'
    );
    escena.setNombreJugador?.(nombre);
    mostrarVista('vista-juego');
  });
}

function engancharPanelesPausa() {
  document.getElementById('pausa-btn-config')?.addEventListener('click', () => {
    const menu = document.querySelector('.pausa-panel--menu');
    const config = document.querySelector('.pausa-panel--config');
    if (menu) menu.hidden = true;
    if (config) config.hidden = false;
  });

  document.getElementById('pausa-btn-volver')?.addEventListener('click', () => {
    const menu = document.querySelector('.pausa-panel--menu');
    const config = document.querySelector('.pausa-panel--config');
    if (config) config.hidden = true;
    if (menu) menu.hidden = false;
  });
}

function engancharPausa(escena) {
  document.addEventListener('click', (event) => {
    const boton = event.target.closest('[data-vista]');
    if (!boton) return;

    const destino = boton.getAttribute('data-vista');
    if (destino === 'vista-pausa') escena.pausarCronometro?.();
    if (destino === 'vista-juego') escena.reanudarCronometro?.();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const juego = document.getElementById('vista-juego');
    const pausa = document.getElementById('vista-pausa');

    if (juego?.classList.contains('activa')) escena.pausarCronometro?.();
    if (pausa?.classList.contains('activa')) escena.reanudarCronometro?.();
  });
}

function engancharDificultad() {
  const campo = document.getElementById('cfg-dificultad');
  if (!campo) {
    return;
  }

  campo.addEventListener('change', () => {
    if (!cambiarDificultad(campo.value)) {
      escena.aplicarDificultad?.(campo.value);
    }
  });
}

function engancharConexion() {
  const boton = document.getElementById('boton-conectar');
  const campo = document.getElementById('nombre-jugador-menu');

  if (!boton || !campo) {
    return;
  }

  boton.addEventListener('click', () => {
    const nombre = campo.value.trim();
    if (nombre) {
      conectarJugador(nombre);
    }
  });
}
