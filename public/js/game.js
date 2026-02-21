var CONSTANTS = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
  PLAYER_RADIUS: 10,
  MOVE_SPEED: 150,
  WALL_THICKNESS: 10,
  SPAWN_X: 400,
  SPAWN_Y: 520,
  MAX_NAME_LENGTH: 16
};

var localPlayer = {
  id: null,
  name: '',
  x: CONSTANTS.SPAWN_X,
  y: CONSTANTS.SPAWN_Y,
  direction: 'S',
  isMoving: false,
  animationFrame: 0,
  animationTime: 0,
  characterId: Math.floor(Math.random() * 6)
};

var remotePlayers = new Map();

function addPlayer(player) {
  if (!player || !player.id) {
    return;
  }
  if (player.id === localPlayer.id) {
    return;
  }
  remotePlayers.set(player.id, {
    id: player.id,
    name: (player.name || '').substring(0, CONSTANTS.MAX_NAME_LENGTH),
    x: player.x || CONSTANTS.SPAWN_X,
    y: player.y || CONSTANTS.SPAWN_Y,
    direction: player.direction || 'S',
    isMoving: player.isMoving || false,
    animationFrame: player.animationFrame || 0,
    animationTime: player.animationTime || 0,
    characterId: player.characterId !== undefined ? player.characterId : Math.floor(Math.random() * 6)
  });
}

function removePlayer(id) {
  remotePlayers.delete(id);
}

function updatePlayerPosition(id, x, y) {
  if (id === localPlayer.id) {
    localPlayer.x = x;
    localPlayer.y = y;
    return;
  }
  var player = remotePlayers.get(id);
  if (player) {
    // Calculate movement delta
    var dx = x - player.x;
    var dy = y - player.y;
    var threshold = 0.1;

    // Update position
    player.x = x;
    player.y = y;

    // Calculate direction and movement state
    var isMoving = Math.abs(dx) > threshold || Math.abs(dy) > threshold;
    player.isMoving = isMoving;

    if (isMoving) {
      // Calculate direction based on dominant axis
      if (Math.abs(dy) > Math.abs(dx)) {
        player.direction = dy > 0 ? 'down' : 'up';
      } else {
        player.direction = dx > 0 ? 'right' : 'left';
      }

      // Simple animation cycling (no deltaTime, just cycle on each update)
      if (player.animationFrame === 0 || player.animationFrame > 3) {
        player.animationFrame = 1;
      } else {
        player.animationFrame = (player.animationFrame % 3) + 1;
      }
    } else {
      // Idle frame
      player.animationFrame = 0;
    }
  }
}

function getLocalPlayer() {
  return localPlayer;
}

function getAllPlayers() {
  var players = [localPlayer];
  remotePlayers.forEach(function (player) {
    players.push(player);
  });
  return players;
}

export default {
  CONSTANTS: CONSTANTS,
  localPlayer: localPlayer,
  remotePlayers: remotePlayers,
  addPlayer: addPlayer,
  removePlayer: removePlayer,
  updatePlayerPosition: updatePlayerPosition,
  getLocalPlayer: getLocalPlayer,
  getAllPlayers: getAllPlayers
};
