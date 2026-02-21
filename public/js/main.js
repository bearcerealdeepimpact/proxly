import Game from './game.js';
import Input from './input.js';
import Network from './network.js';
import Renderer from './renderer.js';

var nameOverlay = null;
var nameInput = null;
var nameSubmit = null;
var running = false;
var lastTimestamp = 0;
var lastSentX = null;
var lastSentY = null;
var tabFocused = true;
var trackedPlayers = {};

var C = Game.CONSTANTS;
var MIN_X = C.WALL_THICKNESS + C.PLAYER_RADIUS;
var MAX_X = C.CANVAS_WIDTH - C.WALL_THICKNESS - C.PLAYER_RADIUS;
var MIN_Y = C.WALL_THICKNESS + C.PLAYER_RADIUS;
var MAX_Y = C.CANVAS_HEIGHT - C.WALL_THICKNESS - C.PLAYER_RADIUS;

function init() {
  nameOverlay = document.getElementById('nameOverlay');
  nameInput = document.getElementById('nameInput');
  nameSubmit = document.getElementById('nameSubmit');

  Renderer.init(document.body);
  Input.init();
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

  window.addEventListener('resize', function () {
    Renderer.handleResize();
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
  running = true;
  lastTimestamp = 0;

  Renderer.getRenderer().setAnimationLoop(gameLoop);
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
  syncPlayers();
  Renderer.render();
}

function update(deltaTime) {
  if (!tabFocused) {
    return;
  }

  var movement = Input.getMovement();
  var player = Game.localPlayer;

  // Calculate movement state
  var isMoving = movement.dx !== 0 || movement.dy !== 0;
  player.isMoving = isMoving;

  if (!isMoving) {
    return;
  }

  // Calculate direction based on dominant axis
  if (Math.abs(movement.dy) > Math.abs(movement.dx)) {
    player.direction = movement.dy > 0 ? 'down' : 'up';
  } else {
    player.direction = movement.dx > 0 ? 'right' : 'left';
  }

  var newX = player.x + movement.dx * C.MOVE_SPEED * deltaTime;
  var newY = player.y + movement.dy * C.MOVE_SPEED * deltaTime;

  newX = Math.max(MIN_X, Math.min(MAX_X, newX));
  newY = Math.max(MIN_Y, Math.min(MAX_Y, newY));

  player.x = newX;
  player.y = newY;

  Renderer.updatePlayerPosition(player.id, newX, newY);

  if (newX !== lastSentX || newY !== lastSentY) {
    Network.sendMove(newX, newY);
    lastSentX = newX;
    lastSentY = newY;
  }
}

function syncPlayers() {
  var localId = Game.localPlayer.id;

  // Ensure local player mesh exists
  if (localId && !trackedPlayers[localId]) {
    Renderer.addPlayer(localId, Game.localPlayer.name, true);
    Renderer.updatePlayerPosition(localId, Game.localPlayer.x, Game.localPlayer.y);
    trackedPlayers[localId] = true;
  }

  // Add/update remote players
  Game.remotePlayers.forEach(function (player, id) {
    if (!trackedPlayers[id]) {
      Renderer.addPlayer(id, player.name, false);
      trackedPlayers[id] = true;
    }
    Renderer.updatePlayerPosition(id, player.x, player.y);
  });

  // Remove players no longer in Game state
  var keys = Object.keys(trackedPlayers);
  for (var i = 0; i < keys.length; i++) {
    var id = keys[i];
    if (id === localId) {
      continue;
    }
    if (!Game.remotePlayers.has(id)) {
      Renderer.removePlayer(id);
      delete trackedPlayers[id];
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
