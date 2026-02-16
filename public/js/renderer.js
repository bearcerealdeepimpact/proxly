import Game from './game.js';

var canvas = null;
var ctx = null;

var COLORS = {
  FLOOR: '#2a1a0a',
  WALL: '#555555',
  STAGE: '#3a2a1a',
  DANCE_FLOOR: '#332211',
  TABLE: '#1a0f05',
  BAR: '#1a0f05',
  LOCAL_PLAYER: '#4488ff',
  REMOTE_COLORS: ['#ff6644', '#44cc66', '#cc44cc', '#cccc44', '#44cccc', '#ff8844'],
  NAME_TEXT: '#ffffff',
  NAME_SHADOW: '#000000'
};

var LAYOUT = {
  WALL_THICKNESS: 10,
  STAGE_HEIGHT: 100,
  STAGE_X: 60,
  STAGE_WIDTH: 680,
  DANCE_FLOOR_X: 200,
  DANCE_FLOOR_Y: 220,
  DANCE_FLOOR_W: 400,
  DANCE_FLOOR_H: 160,
  BAR_X: 60,
  BAR_Y: 460,
  BAR_W: 200,
  BAR_H: 30,
  TABLE_RADIUS: 15,
  TABLES: [
    { x: 120, y: 180 },
    { x: 400, y: 180 },
    { x: 680, y: 180 },
    { x: 120, y: 420 },
    { x: 400, y: 420 },
    { x: 680, y: 420 }
  ]
};

function init(canvasElement) {
  if (!canvasElement) {
    return;
  }
  canvas = canvasElement;
  ctx = canvas.getContext('2d');
}

function drawClub() {
  if (!ctx) {
    return;
  }
  var w = canvas.width;
  var h = canvas.height;

  // Floor
  ctx.fillStyle = COLORS.FLOOR;
  ctx.fillRect(0, 0, w, h);

  // Stage
  ctx.fillStyle = COLORS.STAGE;
  ctx.fillRect(LAYOUT.STAGE_X, LAYOUT.WALL_THICKNESS, LAYOUT.STAGE_WIDTH, LAYOUT.STAGE_HEIGHT);

  // Dance floor
  ctx.fillStyle = COLORS.DANCE_FLOOR;
  ctx.fillRect(LAYOUT.DANCE_FLOOR_X, LAYOUT.DANCE_FLOOR_Y, LAYOUT.DANCE_FLOOR_W, LAYOUT.DANCE_FLOOR_H);

  // Bar counter
  ctx.fillStyle = COLORS.BAR;
  ctx.fillRect(LAYOUT.BAR_X, LAYOUT.BAR_Y, LAYOUT.BAR_W, LAYOUT.BAR_H);
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 2;
  ctx.strokeRect(LAYOUT.BAR_X, LAYOUT.BAR_Y, LAYOUT.BAR_W, LAYOUT.BAR_H);

  // Tables
  for (var i = 0; i < LAYOUT.TABLES.length; i++) {
    var table = LAYOUT.TABLES[i];
    ctx.fillStyle = COLORS.TABLE;
    ctx.beginPath();
    ctx.arc(table.x, table.y, LAYOUT.TABLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Walls (drawn last to overlay edges)
  ctx.fillStyle = COLORS.WALL;
  ctx.fillRect(0, 0, w, LAYOUT.WALL_THICKNESS);                  // top
  ctx.fillRect(0, h - LAYOUT.WALL_THICKNESS, w, LAYOUT.WALL_THICKNESS); // bottom
  ctx.fillRect(0, 0, LAYOUT.WALL_THICKNESS, h);                  // left
  ctx.fillRect(w - LAYOUT.WALL_THICKNESS, 0, LAYOUT.WALL_THICKNESS, h); // right
}

function drawPlayer(player, isLocal) {
  if (!ctx || !player) {
    return;
  }

  var radius = Game.CONSTANTS.PLAYER_RADIUS;
  var color;

  if (isLocal) {
    color = COLORS.LOCAL_PLAYER;
  } else {
    var colorIndex = Math.abs(hashCode(player.id || '')) % COLORS.REMOTE_COLORS.length;
    color = COLORS.REMOTE_COLORS[colorIndex];
  }

  // Draw player circle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw name above player
  var name = player.name || '';
  if (name.length > 0) {
    ctx.font = '12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Shadow
    ctx.fillStyle = COLORS.NAME_SHADOW;
    ctx.fillText(name, player.x + 1, player.y - radius - 3);

    // Text
    ctx.fillStyle = COLORS.NAME_TEXT;
    ctx.fillText(name, player.x, player.y - radius - 4);
  }
}

function hashCode(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function render() {
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawClub();

  var players = Game.getAllPlayers();
  var localPlayer = Game.getLocalPlayer();

  for (var i = 0; i < players.length; i++) {
    var player = players[i];
    var isLocal = (player === localPlayer);
    drawPlayer(player, isLocal);
  }
}

export default {
  init: init,
  render: render,
  drawClub: drawClub,
  drawPlayer: drawPlayer
};
