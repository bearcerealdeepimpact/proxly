var keys = {};

var MOVE_KEYS = ['w', 'a', 's', 'd'];

function init() {
  window.addEventListener('keydown', function (e) {
    var key = e.key.toLowerCase();
    if (MOVE_KEYS.indexOf(key) !== -1) {
      e.preventDefault();
    }
    keys[key] = true;
  });

  window.addEventListener('keyup', function (e) {
    var key = e.key.toLowerCase();
    keys[key] = false;
  });
}

function getMovement() {
  var dx = 0;
  var dy = 0;

  if (keys['a']) { dx -= 1; }
  if (keys['d']) { dx += 1; }
  if (keys['w']) { dy -= 1; }
  if (keys['s']) { dy += 1; }

  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }

  return { dx: dx, dy: dy };
}

export default {
  keys: keys,
  init: init,
  getMovement: getMovement
};
