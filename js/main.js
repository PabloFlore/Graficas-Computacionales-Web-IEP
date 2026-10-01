import { iniciarNavegacion } from './util/navegacion.js';
import { iniciarEscena } from './motor/escena.js';
import { iniciarFormulario } from './red/formulario.js';

document.addEventListener('DOMContentLoaded', () => {
  iniciarNavegacion();
  iniciarEscena();
  iniciarFormulario();
});