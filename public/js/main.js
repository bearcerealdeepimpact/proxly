(function () {
  'use strict';

  var canvas = null;
  var running = false;
  var lastTimestamp = 0;
  var tabFocused = true;

  var C = Game.CONSTANTS;

  function init() {
    canvas = document.getElementById('gameCanvas');

    Renderer.init(canvas);
    Input.init(canvas);
    try {
      MusicPlayer.init();
    } catch (e) {
      // Audio init may fail but should not block game
    }

    // Setup entrance overlay
    var enterBtn = document.getElementById('enterBtn');
    if (enterBtn) {
      enterBtn.addEventListener('click', handleEnter);
    }

    // Also allow clicking the whole entrance overlay
    var entranceOverlay = document.getElementById('entranceOverlay');
    if (entranceOverlay) {
      entranceOverlay.addEventListener('click', function (e) {
        if (e.target === entranceOverlay || e.target.closest('.entrance-content')) {
          handleEnter();
        }
      });
    }

    window.addEventListener('focus', function () {
      tabFocused = true;
    });

    window.addEventListener('blur', function () {
      tabFocused = false;
    });
  }

  function handleEnter() {
    var entranceOverlay = document.getElementById('entranceOverlay');
    if (!entranceOverlay || entranceOverlay.style.display === 'none') return;

    // Hide entrance overlay
    entranceOverlay.classList.add('entrance-fade-out');
    setTimeout(function () {
      entranceOverlay.style.display = 'none';
    }, 600);

    // Initialize audio (user gesture context)
    MusicPlayer.unlockAndPlay();

    // Show instructions briefly
    Input.showInstructions();

    // Start game loop
    Game.localPlayer.name = 'You';
    if (window.Network && Network.connect) {
      Network.connect();
    }
    running = true;
    lastTimestamp = 0;
    requestAnimationFrame(gameLoop);
  }

  function gameLoop(timestamp) {
    if (!running) return;

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
    if (!tabFocused) return;

    // Room transitions
    Game.updateTransition(deltaTime);

    // Don't process input during transition
    if (Game.transitioning) return;

    // Drink system
    Game.updateDrinkSystem(deltaTime);

    // Crowd NPCs
    Game.updateCrowd(deltaTime);

    // Interaction proximity checks
    if (window.Interaction) {
      Interaction.update();
    }

    // Player movement
    if (window.Interaction && Interaction.isModalOpen()) return;

    var movement = Input.getMovement();
    if (movement.dx === 0 && movement.dy === 0) return;

    var player = Game.localPlayer;
    var room = Rooms.getRoom(Game.currentRoom);
    var wt = C.WALL_THICKNESS;
    var pr = C.PLAYER_RADIUS;

    var newX = player.x + movement.dx * C.MOVE_SPEED * deltaTime;
    var newY = player.y + movement.dy * C.MOVE_SPEED * deltaTime;

    newX = Math.max(wt + pr, Math.min(room.width - wt - pr, newX));
    newY = Math.max(wt + pr, Math.min(room.height - wt - pr, newY));

    player.x = newX;
    player.y = newY;

    // Send position to server
    if (window.Network && Network.sendMove) {
      Network.sendMove(player.x, player.y);
    }

    // Kick ground drinks
    Game.kickNearbyDrink(player.x, player.y);
  }

  function render() {
    Renderer.render();
    MusicPlayer.updateNowPlayingUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
