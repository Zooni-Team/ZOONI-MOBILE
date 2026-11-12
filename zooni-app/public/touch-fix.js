// iOS ignora user-scalable=no desde Safari 10: el pellizco y el doble tap
// se cancelan a mano. `passive: false` es necesario para preventDefault.
// Externalizado de index.html (informe de seguridad #145): un <script>
// en línea complica una CSP estricta sin "unsafe-inline".
(function () {
  document.addEventListener(
    'gesturestart',
    function (e) { e.preventDefault(); },
    { passive: false }
  );
  document.addEventListener(
    'gesturechange',
    function (e) { e.preventDefault(); },
    { passive: false }
  );

  var ultimoTap = 0;
  document.addEventListener(
    'touchend',
    function (e) {
      var ahora = Date.now();
      if (ahora - ultimoTap < 300) e.preventDefault(); // doble tap → zoom
      ultimoTap = ahora;
    },
    { passive: false }
  );

  // Dos dedos o más: siempre pellizco, nunca scroll de la página
  document.addEventListener(
    'touchmove',
    function (e) {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );
})();
