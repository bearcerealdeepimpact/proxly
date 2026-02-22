(function () {
  'use strict';

  var keys = {};
  var MOVE_KEYS = ['w', 'a', 's', 'd'];
  var ZOOM_STEP = 0.1;

  // Mobile touch joystick state
  var touchActive = false;
  var touchStartX = 0;
  var touchStartY = 0;
  var touchDx = 0;
  var touchDy = 0;
  var TOUCH_DEADZONE = 10;
  var TOUCH_MAX = 50;
  var isTouchDevice = false;
  var joystickTouchId = null;

  function init(canvasElement) {
    window.addEventListener('keydown', function (e) {
      var key = e.key.toLowerCase();
      if (MOVE_KEYS.indexOf(key) !== -1) {
        e.preventDefault();
      }
      keys[key] = true;

      if (key === 'e') {
        if (window.Interaction) {
          Interaction.interact();
        } else {
          Game.tryOrderDrink();
        }
      }

      if (key === 'q') {
        Game.dropDrink();
      }

      if (key === 'm') {
        MusicPlayer.toggleMute();
      }

      if (key === 'escape') {
        if (window.Interaction && Interaction.isModalOpen()) {
          Interaction.hideModal();
        }
      }

      if (key === '?' || (e.shiftKey && key === '/')) {
        toggleInstructions();
      }

      if (key === '+' || key === '=' || e.key === '+') {
        e.preventDefault();
        MusicPlayer.increaseVolume();
      } else if (key === '-' || key === '_' || e.key === '-') {
        e.preventDefault();
        MusicPlayer.decreaseVolume();
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
          Renderer.setZoom(Renderer.getZoom() - ZOOM_STEP, player.x, player.y);
        } else {
          Renderer.setZoom(Renderer.getZoom() + ZOOM_STEP, player.x, player.y);
        }
      }, { passive: false });
    }

    // Detect touch device
    detectTouch();
  }

  function detectTouch() {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      isTouchDevice = true;
      setupMobileControls();
    }
  }

  function setupMobileControls() {
    var mobileControls = document.getElementById('mobileControls');
    if (mobileControls) {
      mobileControls.style.display = 'block';
    }

    var joystickArea = document.getElementById('joystickArea');
    var interactBtn = document.getElementById('mobileInteractBtn');

    if (joystickArea) {
      joystickArea.addEventListener('touchstart', function (e) {
        e.preventDefault();
        var touch = e.changedTouches[0];
        joystickTouchId = touch.identifier;
        touchActive = true;
        var rect = joystickArea.getBoundingClientRect();
        touchStartX = rect.left + rect.width / 2;
        touchStartY = rect.top + rect.height / 2;
        touchDx = 0;
        touchDy = 0;
      }, { passive: false });

      joystickArea.addEventListener('touchmove', function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joystickTouchId) {
            var touch = e.changedTouches[i];
            var rawDx = touch.clientX - touchStartX;
            var rawDy = touch.clientY - touchStartY;
            var dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
            if (dist > TOUCH_DEADZONE) {
              var clamped = Math.min(dist, TOUCH_MAX);
              touchDx = (rawDx / dist) * (clamped / TOUCH_MAX);
              touchDy = (rawDy / dist) * (clamped / TOUCH_MAX);
            } else {
              touchDx = 0;
              touchDy = 0;
            }
            updateJoystickVisual(touchDx * TOUCH_MAX, touchDy * TOUCH_MAX);
            break;
          }
        }
      }, { passive: false });

      var endTouch = function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joystickTouchId) {
            touchActive = false;
            touchDx = 0;
            touchDy = 0;
            joystickTouchId = null;
            updateJoystickVisual(0, 0);
            break;
          }
        }
      };
      joystickArea.addEventListener('touchend', endTouch, { passive: false });
      joystickArea.addEventListener('touchcancel', endTouch, { passive: false });
    }

    if (interactBtn) {
      interactBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        if (window.Interaction) {
          Interaction.interact();
        } else {
          Game.tryOrderDrink();
        }
      }, { passive: false });
    }
  }

  function updateJoystickVisual(dx, dy) {
    var knob = document.getElementById('joystickKnob');
    if (knob) {
      knob.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
    }
  }

  function toggleInstructions() {
    var el = document.getElementById('instructionOverlay');
    if (el) {
      el.style.opacity = el.style.opacity === '0' ? '1' : '0';
    }
  }

  function showInstructions() {
    var el = document.getElementById('instructionOverlay');
    if (el) {
      el.style.opacity = '1';
      setTimeout(function () {
        el.style.opacity = '0';
      }, 5000);
    }
  }

  function getMovement() {
    var dx = 0;
    var dy = 0;

    // Keyboard WASD (isometric remapping)
    if (keys['w']) { dx -= 1; dy -= 1; }
    if (keys['s']) { dx += 1; dy += 1; }
    if (keys['a']) { dx -= 1; dy += 1; }
    if (keys['d']) { dx += 1; dy -= 1; }

    // Touch joystick (convert screen to isometric world)
    if (touchActive && (Math.abs(touchDx) > 0.01 || Math.abs(touchDy) > 0.01)) {
      // Screen right/down → iso transform
      dx += touchDx + touchDy;   // world x
      dy += -touchDx + touchDy;  // world y
    }

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
    getMovement: getMovement,
    showInstructions: showInstructions,
    get isTouchDevice() { return isTouchDevice; }
  };
})();
