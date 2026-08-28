(function () {
  'use strict';

  var CLAVE_PREFERENCIAS = 'mini-metropolis.preferencias';

  var PREFERENCIAS_POR_DEFECTO = {
    volumen: 50,
    sonido: true,
    dificultad: 'normal'
  };

  function cargarPreferencias() {
    var datos = null;
    try {
      var crudo = localStorage.getItem(CLAVE_PREFERENCIAS);
      if (crudo) {
        datos = JSON.parse(crudo);
      }
    } catch (e) {
      datos = null;
    }

    var preferencias = Object.assign({}, PREFERENCIAS_POR_DEFECTO, datos || {});
    guardarPreferencias(preferencias);
    return preferencias;
  }

  function guardarPreferencias(preferencias) {
    try {
      localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(preferencias));
    } catch (e) {
      console.error('No se pudo guardar las preferencias:', e);
    }
  }

  function aplicarPreferencias(preferencias) {
    document.getElementById('cfg-volumen').value = preferencias.volumen;
    document.getElementById('cfg-sonido').checked = preferencias.sonido;
    document.getElementById('cfg-dificultad').value = preferencias.dificultad;
  }

  function escucharPreferencias() {
    var preferencias = cargarPreferencias();

    document.getElementById('cfg-volumen').addEventListener('input', function () {
      preferencias.volumen = parseInt(this.value, 10);
      guardarPreferencias(preferencias);
    });

    document.getElementById('cfg-sonido').addEventListener('change', function () {
      preferencias.sonido = this.checked;
      guardarPreferencias(preferencias);
    });

    document.getElementById('cfg-dificultad').addEventListener('change', function () {
      preferencias.dificultad = this.value;
      guardarPreferencias(preferencias);
    });
  }

  function mostrarVista(id) {
    document.querySelectorAll('.vista').forEach(function (vista) {
      vista.classList.toggle('activa', vista.id === id);
    });
  }

  function iniciar () {
    var actual = cargarPreferencias();
    aplicarPreferencias(actual);
    escucharPreferencias();
    mostrarVista('vista-menu');
  }

  document.addEventListener('DOMContentLoaded', iniciar);

  document.addEventListener('click', function (event) {
    var boton = event.target.closest('[data-vista]');
    if (boton) {
      mostrarVista(boton.getAttribute('data-vista'));
    }
  });

})();
