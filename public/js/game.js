(function () {
  'use strict';

  var CONSTANTS = {
    CANVAS_WIDTH: 1000,
    CANVAS_HEIGHT: 700,
    WORLD_WIDTH: 800,
    WORLD_HEIGHT: 600,
    PLAYER_RADIUS: 10,
    MOVE_SPEED: 150,
    WALL_THICKNESS: 10,
    SPAWN_X: 400,
    SPAWN_Y: 520,
    MAX_NAME_LENGTH: 16,
    DRINK_ORDER_TIME: 2.0,
    DRINK_CARRY_TIME: 15.0,
    DRINK_FADE_TIME: 8.0,
    DRINK_KICK_SPEED: 60,
    DRINK_FRICTION: 0.92,
    BAR_INTERACT_DIST: 50
  };

  var localPlayer = {
    id: null,
    name: '',
    x: CONSTANTS.SPAWN_X,
    y: CONSTANTS.SPAWN_Y,
    drinkState: 'none',
    drinkTimer: 0,
    drinkOrderTimer: 0,
    drinkColor: null
  };

  var groundDrinks = [];

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

  // ─── Drink system ──────────────────────────────────────────────────

  var DRINK_COLORS = ['#c87533', '#a0522d', '#d2691e', '#b8860b', '#cd853f'];

  function isNearBar() {
    // Bar center: front edge where player would stand to order
    var barCX = 60 + 180 / 2;  // BAR_X + BAR_W/2
    var barFrontY = 460 + 30;  // BAR_Y + BAR_H
    var dx = localPlayer.x - barCX;
    var dy = localPlayer.y - barFrontY;
    return Math.sqrt(dx * dx + dy * dy) < CONSTANTS.BAR_INTERACT_DIST;
  }

  function tryOrderDrink() {
    if (localPlayer.drinkState !== 'none') return;
    if (!isNearBar()) return;
    localPlayer.drinkState = 'ordering';
    localPlayer.drinkOrderTimer = CONSTANTS.DRINK_ORDER_TIME;
    localPlayer.drinkColor = DRINK_COLORS[Math.floor(Math.random() * DRINK_COLORS.length)];
  }

  function dropDrink() {
    if (localPlayer.drinkState !== 'carrying') return;
    var angle = Math.random() * Math.PI * 2;
    groundDrinks.push({
      x: localPlayer.x,
      y: localPlayer.y,
      vx: Math.cos(angle) * CONSTANTS.DRINK_KICK_SPEED * 0.3,
      vy: Math.sin(angle) * CONSTANTS.DRINK_KICK_SPEED * 0.3,
      alpha: 1,
      fadeTimer: CONSTANTS.DRINK_FADE_TIME,
      color: localPlayer.drinkColor || DRINK_COLORS[0]
    });
    localPlayer.drinkState = 'none';
    localPlayer.drinkTimer = 0;
    localPlayer.drinkColor = null;
  }

  function updateDrinkSystem(dt) {
    // Update ordering state
    if (localPlayer.drinkState === 'ordering') {
      localPlayer.drinkOrderTimer -= dt;
      if (localPlayer.drinkOrderTimer <= 0) {
        localPlayer.drinkState = 'carrying';
        localPlayer.drinkTimer = CONSTANTS.DRINK_CARRY_TIME;
      }
    }

    // Update carrying state
    if (localPlayer.drinkState === 'carrying') {
      localPlayer.drinkTimer -= dt;
      if (localPlayer.drinkTimer <= 0) {
        dropDrink();
      }
    }

    // Update ground drinks (physics + fade)
    for (var i = groundDrinks.length - 1; i >= 0; i--) {
      var drink = groundDrinks[i];
      drink.x += drink.vx * dt;
      drink.y += drink.vy * dt;
      drink.vx *= CONSTANTS.DRINK_FRICTION;
      drink.vy *= CONSTANTS.DRINK_FRICTION;

      // Clamp to world bounds
      drink.x = Math.max(15, Math.min(785, drink.x));
      drink.y = Math.max(15, Math.min(585, drink.y));

      drink.fadeTimer -= dt;
      drink.alpha = Math.max(0, drink.fadeTimer / CONSTANTS.DRINK_FADE_TIME);

      if (drink.fadeTimer <= 0) {
        groundDrinks.splice(i, 1);
      }
    }
  }

  function kickNearbyDrink(px, py) {
    for (var i = 0; i < groundDrinks.length; i++) {
      var drink = groundDrinks[i];
      var dx = drink.x - px;
      var dy = drink.y - py;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 8 && dist > 0.1) {
        drink.vx = (dx / dist) * CONSTANTS.DRINK_KICK_SPEED;
        drink.vy = (dy / dist) * CONSTANTS.DRINK_KICK_SPEED;
      }
    }
  }

  // ─── Crowd NPC system ─────────────────────────────────────────────

  var NPC_COUNT = 10;
  var NPC_SPEED = 80;

  var NPC_NAMES = ['Vibes', 'Neon', 'Echo', 'Bass', 'Luna', 'Groove', 'Pixel', 'Blaze', 'Nova', 'Dusk'];
  var NPC_COLORS = ['#e06090', '#60b080', '#b080e0', '#e0a050', '#50b0d0', '#d07070', '#70c070', '#a070d0', '#d0b040', '#60a0a0'];

  var crowdNPCs = [];

  function randomInRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickZoneTarget(zone) {
    switch (zone) {
      case 'dance':
        return { x: randomInRange(150, 650), y: randomInRange(160, 420) };
      case 'bar':
        return { x: randomInRange(80, 220), y: randomInRange(500, 520) };
      case 'table1':
        return { x: randomInRange(85, 115), y: randomInRange(290, 320) };
      case 'table2':
        return { x: randomInRange(685, 715), y: randomInRange(290, 320) };
      default:
        return { x: randomInRange(150, 650), y: randomInRange(160, 420) };
    }
  }

  function pickNextState() {
    var roll = Math.random();
    if (roll < 0.40) return 'dancing';
    if (roll < 0.65) return 'at_bar';
    if (roll < 0.85) return 'at_table';
    return 'idle';
  }

  function zoneForState(state) {
    if (state === 'dancing') return 'dance';
    if (state === 'at_bar') return 'bar';
    if (state === 'at_table') return Math.random() < 0.5 ? 'table1' : 'table2';
    return null;
  }

  function npcStateTimer(index) {
    return 8 + (index % NPC_COUNT) * 1.2 + Math.random() * 4;
  }

  function initCrowd() {
    crowdNPCs.length = 0;
    for (var i = 0; i < NPC_COUNT; i++) {
      var startState, startPos;
      if (i < 6) {
        startState = 'dancing';
        startPos = pickZoneTarget('dance');
      } else if (i < 8) {
        startState = 'at_bar';
        startPos = pickZoneTarget('bar');
      } else {
        startState = 'at_table';
        startPos = pickZoneTarget(i === 8 ? 'table1' : 'table2');
      }

      crowdNPCs.push({
        id: 'npc_' + i,
        name: NPC_NAMES[i],
        x: startPos.x,
        y: startPos.y,
        color: NPC_COLORS[i],
        state: startState,
        stateTimer: npcStateTimer(i),
        targetX: startPos.x,
        targetY: startPos.y,
        drinkState: 'none',
        drinkColor: null,
        drinkTimer: 0
      });
    }
  }

  function updateCrowd(dt) {
    for (var i = 0; i < crowdNPCs.length; i++) {
      var npc = crowdNPCs[i];

      // Tick state timer
      npc.stateTimer -= dt;

      // Walking: move toward target
      if (npc.state === 'walking') {
        var dx = npc.targetX - npc.x;
        var dy = npc.targetY - npc.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 3) {
          npc.x = npc.targetX;
          npc.y = npc.targetY;
          npc.state = npc._destState || 'idle';
          npc.stateTimer = npcStateTimer(i);
          // Arrived at bar — start drink pickup timer
          if (npc.state === 'at_bar' && npc.drinkState === 'none') {
            npc._barWait = 2 + Math.random();
          }
        } else {
          npc.x += (dx / dist) * NPC_SPEED * dt;
          npc.y += (dy / dist) * NPC_SPEED * dt;
        }
      }

      // State timer expired — pick new behavior
      if (npc.stateTimer <= 0 && npc.state !== 'walking') {
        var next = pickNextState();
        var zone = zoneForState(next);

        if (zone) {
          var target = pickZoneTarget(zone);
          npc.targetX = target.x;
          npc.targetY = target.y;
          npc.state = 'walking';
          npc._destState = next;
        } else {
          // idle — stay in place
          npc.state = 'idle';
        }
        npc.stateTimer = npcStateTimer(i);
      }

      // Bar drink pickup
      if (npc.state === 'at_bar' && npc.drinkState === 'none' && npc._barWait !== undefined) {
        npc._barWait -= dt;
        if (npc._barWait <= 0) {
          npc.drinkState = 'carrying';
          npc.drinkColor = DRINK_COLORS[Math.floor(Math.random() * DRINK_COLORS.length)];
          npc.drinkTimer = 10 + Math.random() * 10;
          delete npc._barWait;
        }
      }

      // Drink timer — drop after duration or when dancing
      if (npc.drinkState === 'carrying') {
        npc.drinkTimer -= dt;
        if (npc.drinkTimer <= 0 || npc.state === 'dancing') {
          npc.drinkState = 'none';
          npc.drinkColor = null;
          npc.drinkTimer = 0;
        }
      }

      // Clamp to world bounds
      npc.x = Math.max(20, Math.min(780, npc.x));
      npc.y = Math.max(20, Math.min(580, npc.y));
    }
  }

  initCrowd();

  window.Game = {
    CONSTANTS: CONSTANTS,
    localPlayer: localPlayer,
    remotePlayers: remotePlayers,
    addPlayer: addPlayer,
    removePlayer: removePlayer,
    updatePlayerPosition: updatePlayerPosition,
    getLocalPlayer: getLocalPlayer,
    getAllPlayers: getAllPlayers,
    groundDrinks: groundDrinks,
    isNearBar: isNearBar,
    tryOrderDrink: tryOrderDrink,
    updateDrinkSystem: updateDrinkSystem,
    dropDrink: dropDrink,
    kickNearbyDrink: kickNearbyDrink,
    crowdNPCs: crowdNPCs,
    updateCrowd: updateCrowd
  };
})();
