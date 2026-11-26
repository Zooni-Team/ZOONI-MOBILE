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

  document.addEventListener(
    'touchmove',
    function (e) {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );
})();
