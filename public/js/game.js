var CONSTANTS = {
  get CANVAS_WIDTH() {
    return window.innerWidth;
  },
  get CANVAS_HEIGHT() {
    return window.innerHeight;
  },
  PLAYER_RADIUS: 10,
  MOVE_SPEED: 150,
  WALL_THICKNESS: 10,
  get SPAWN_X() {
    return this.CANVAS_WIDTH * 0.5;
  },
  get SPAWN_Y() {
    return this.CANVAS_HEIGHT * 0.5;
  },
  MAX_NAME_LENGTH: 16
};

var localPlayer = {
  id: null,
  name: '',
  x: CONSTANTS.SPAWN_X,
  y: CONSTANTS.SPAWN_Y
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
    y: player.y || CONSTANTS.SPAWN_Y
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
    player.x = x;
    player.y = y;
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
