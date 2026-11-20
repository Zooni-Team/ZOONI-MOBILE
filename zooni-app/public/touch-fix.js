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

  // El doble tap → zoom lo frena `touch-action: manipulation` (app-shell.css).
  // Antes había además un preventDefault en todo `touchend` a menos de 300 ms
  // del anterior: anulaba el segundo toque en botones +/− y al tocar rápido.

  // Dos dedos o más: siempre pellizco, nunca scroll de la página
  document.addEventListener(
    'touchmove',
    function (e) {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );
})();
