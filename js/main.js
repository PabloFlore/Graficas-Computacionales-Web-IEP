import { iniciarNavegacion } from './util/navegacion.js';
import { iniciarEscena } from './motor/escena.js';

document.addEventListener('DOMContentLoaded', () => {
  iniciarNavegacion();
  iniciarEscena();
});