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
  hasDrink: false,
  drinkType: null
};

var remotePlayers = new Map();
var groundDrinks = new Map();

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
    hasDrink: player.hasDrink || false,
    drinkType: player.drinkType || null
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

function addGroundDrink(drink) {
  if (!drink || !drink.id) {
    return;
  }
  groundDrinks.set(drink.id, {
    id: drink.id,
    x: drink.x || 0,
    y: drink.y || 0,
    drinkType: drink.drinkType || null
  });
}

function removeGroundDrink(id) {
  groundDrinks.delete(id);
}

function updateGroundDrink(id, x, y) {
  var drink = groundDrinks.get(id);
  if (drink) {
    drink.x = x;
    drink.y = y;
  }
}

export default {
  CONSTANTS: CONSTANTS,
  localPlayer: localPlayer,
  remotePlayers: remotePlayers,
  groundDrinks: groundDrinks,
  addPlayer: addPlayer,
  removePlayer: removePlayer,
  updatePlayerPosition: updatePlayerPosition,
  getLocalPlayer: getLocalPlayer,
  getAllPlayers: getAllPlayers,
  addGroundDrink: addGroundDrink,
  removeGroundDrink: removeGroundDrink,
  updateGroundDrink: updateGroundDrink
};
