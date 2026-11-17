import { iniciarNavegacion, mostrarVista } from './util/navegacion.js';
import { iniciarEscena } from './motor/escena.js';
import { iniciarFormulario } from './red/formulario.js';
import { iniciarMultijugador, conectarJugador, enviarPosicion, emitirEscenario } from './red/multijugador.js';
import { iniciarSelectorPatos } from './motor/selector-patos.js';

let escenarioPendiente = 'piramide';
let modoPendiente = 'carrera';

document.addEventListener('DOMContentLoaded', async () => {
  iniciarNavegacion();
  iniciarFormulario();

  const escena        = await iniciarEscena({ alMoverJugador: enviarPosicion });
  const selectorPatos = iniciarSelectorPatos();

  iniciarMultijugador({
    alEntrar: (jugador) => escena.agregarJugadorRemoto(jugador),
    alMover:  (jugador) => escena.moverJugadorRemoto(jugador),
    alSalir:  (id)      => escena.quitarJugadorRemoto(id),
    alCambiarEscenario: ({ escenario }) => escena.reiniciar(escenario),
  });

  engancharConexion();
  engancharSeleccion(escena);
  engancharColores(escena, selectorPatos);
  engancharPausa(escena);
});

function engancharConexion() {
  const boton = document.getElementById('boton-conectar');
  const campo = document.getElementById('nombre-jugador');
  if (!boton || !campo) return;

  boton.addEventListener('click', () => {
    const nombre = campo.value.trim();
    if (nombre) conectarJugador(nombre);
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
    }

    const botonModo = e.target.closest('.boton--modo');
    if (botonModo) {
      document.querySelectorAll('.boton--modo').forEach((b) =>
        b.classList.remove('boton--modo-activo')
      );
      botonModo.classList.add('boton--modo-activo');
    }

    const botonIniciar = e.target.closest('#boton-iniciar-juego');
    if (botonIniciar) {
      const escenarioEl = document.querySelector('.tarjeta-escenario--activa');
      const modoEl = document.querySelector('.boton--modo-activo');
      escenarioPendiente = escenarioEl?.dataset.escenario || 'piramide';
      modoPendiente = modoEl?.dataset.modo || 'carrera';
      mostrarVista('vista-colores');
    }
  });
}

function engancharColores(escena, selectorPatos) {
  document.addEventListener('click', (e) => {
    const botonConfirmar = e.target.closest('#boton-confirmar-color');
    if (!botonConfirmar) return;

    const cfg = selectorPatos.getPatolSeleccionado();
    escena.reiniciar(escenarioPendiente, cfg.colorCuerpo, cfg.colorOjo);
    emitirEscenario(escenarioPendiente, modoPendiente);
    mostrarVista('vista-juego');
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
