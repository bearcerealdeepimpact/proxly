(function () {
  'use strict';

  var keys = {};

  var MOVE_KEYS = ['w', 'a', 's', 'd'];
  var ZOOM_STEP = 0.1;

  function init(canvasElement) {
    window.addEventListener('keydown', function (e) {
      var key = e.key.toLowerCase();
      if (MOVE_KEYS.indexOf(key) !== -1) {
        e.preventDefault();
      }
      keys[key] = true;

      if (key === 'e') {
        Game.tryOrderDrink();
      }

      if (key === 'q') {
        Game.dropDrink();
      }

      // Zoom with +/- keys
      if (key === '+' || key === '=' || e.key === '+') {
        e.preventDefault();
        var player = Game.getLocalPlayer();
        Renderer.setZoom(Renderer.getZoom() + ZOOM_STEP, player.x, player.y);
      } else if (key === '-' || e.key === '-') {
        e.preventDefault();
        var player = Game.getLocalPlayer();
        Renderer.setZoom(Renderer.getZoom() - ZOOM_STEP, player.x, player.y);
      }
    });

    window.addEventListener('keyup', function (e) {
      var key = e.key.toLowerCase();
      keys[key] = false;
    });

    // Mouse wheel zoom on canvas
    if (canvasElement) {
      canvasElement.addEventListener('wheel', function (e) {
        e.preventDefault();
        var player = Game.getLocalPlayer();
        if (e.deltaY > 0) {
          // Scroll down = zoom out
          Renderer.setZoom(Renderer.getZoom() - ZOOM_STEP, player.x, player.y);
        } else {
          // Scroll up = zoom in
          Renderer.setZoom(Renderer.getZoom() + ZOOM_STEP, player.x, player.y);
        }
      }, { passive: false });
    }
  }

  function getMovement() {
    var dx = 0;
    var dy = 0;

    // Remap WASD to isometric screen directions
    // W = screen-up  → world (-1, -1)
    // S = screen-down → world (+1, +1)
    // A = screen-left → world (-1, +1)
    // D = screen-right→ world (+1, -1)
    if (keys['w']) { dx -= 1; dy -= 1; }
    if (keys['s']) { dx += 1; dy += 1; }
    if (keys['a']) { dx -= 1; dy += 1; }
    if (keys['d']) { dx += 1; dy -= 1; }

    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    return { dx: dx, dy: dy };
  }

  window.Input = {
    keys: keys,
    init: init,
    getMovement: getMovement
  };
})();
