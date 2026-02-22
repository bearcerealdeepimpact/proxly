(function () {
  'use strict';

  var canvas = null;
  var nameOverlay = null;
  var nameInput = null;
  var nameSubmit = null;
  var running = false;
  var lastTimestamp = 0;
  var lastSentX = null;
  var lastSentY = null;
  var tabFocused = true;

  var C = Game.CONSTANTS;
  var MIN_X = C.WALL_THICKNESS + C.PLAYER_RADIUS;
  var MAX_X = C.WORLD_WIDTH - C.WALL_THICKNESS - C.PLAYER_RADIUS;
  var MIN_Y = C.WALL_THICKNESS + C.PLAYER_RADIUS;
  var MAX_Y = C.WORLD_HEIGHT - C.WALL_THICKNESS - C.PLAYER_RADIUS;

  function init() {
    canvas = document.getElementById('gameCanvas');
    nameOverlay = document.getElementById('nameOverlay');
    nameInput = document.getElementById('nameInput');
    nameSubmit = document.getElementById('nameSubmit');

    Renderer.init(canvas);
    Input.init(canvas);
    try {
      MusicPlayer.init();
    } catch (e) {
      // Audio init may fail but should not block game
    }
    Network.connect();

    nameSubmit.addEventListener('click', handleNameSubmit);
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        handleNameSubmit();
      }
    });

    window.addEventListener('focus', function () {
      tabFocused = true;
    });

    window.addEventListener('blur', function () {
      tabFocused = false;
    });
  }

  function handleNameSubmit() {
    var name = (nameInput.value || '').trim();
    if (name.length < 1 || name.length > C.MAX_NAME_LENGTH) {
      return;
    }

    Game.localPlayer.name = name;
    Network.sendJoin(name);

    nameOverlay.style.display = 'none';

    try {
      MusicPlayer.unlockAndPlay();
    } catch (e) {
      // Audio play may fail but should not block game
    }

    running = true;
    lastTimestamp = 0;
    requestAnimationFrame(gameLoop);
  }

  function gameLoop(timestamp) {
    if (!running) {
      return;
    }

    var deltaTime = 0;
    if (lastTimestamp > 0) {
      deltaTime = (timestamp - lastTimestamp) / 1000;
    }
    if (deltaTime > 0.1) {
      deltaTime = 0.1;
    }
    lastTimestamp = timestamp;

    update(deltaTime);
    render();

    requestAnimationFrame(gameLoop);
  }

  function update(deltaTime) {
    if (!tabFocused) {
      return;
    }

    // Drink system ticks even when standing still
    Game.updateDrinkSystem(deltaTime);

    // Crowd NPCs move even when player is still
    Game.updateCrowd(deltaTime);

    // Update interaction prompts
    if (typeof Interaction !== 'undefined' && Interaction.update) {
      Interaction.update();
    }

    var movement = Input.getMovement();
    if (movement.dx === 0 && movement.dy === 0) {
      return;
    }

    var player = Game.localPlayer;
    var newX = player.x + movement.dx * C.MOVE_SPEED * deltaTime;
    var newY = player.y + movement.dy * C.MOVE_SPEED * deltaTime;

    newX = Math.max(MIN_X, Math.min(MAX_X, newX));
    newY = Math.max(MIN_Y, Math.min(MAX_Y, newY));

    player.x = newX;
    player.y = newY;

    // Kick ground drinks when walking over them
    Game.kickNearbyDrink(player.x, player.y);

    if (newX !== lastSentX || newY !== lastSentY) {
      Network.sendMove(newX, newY);
      lastSentX = newX;
      lastSentY = newY;
    }
  }

  function render() {
    Renderer.render();
    MusicPlayer.updateNowPlayingUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
