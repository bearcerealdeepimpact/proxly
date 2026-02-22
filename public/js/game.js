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
    name: 'You',
    x: CONSTANTS.SPAWN_X,
    y: CONSTANTS.SPAWN_Y,
    characterId: Math.floor(Math.random() * 6),
    drinkState: 'none',
    drinkTimer: 0,
    drinkOrderTimer: 0,
    drinkColor: null
  };

  var remotePlayers = new Map();
  var groundDrinks = [];
  var currentRoom = 'main';
  var transitioning = false;
  var transitionAlpha = 0;
  var transitionTarget = null;
  var transitionPhase = 'none'; // 'none', 'fade_out', 'fade_in'
  var TRANSITION_SPEED = 3.0; // alpha per second (0.5s to full)

  // ─── Room transition ───────────────────────────────────────────────

  function transitionToRoom(targetRoom, spawnX, spawnY) {
    if (transitioning) return;
    transitioning = true;
    transitionPhase = 'fade_out';
    transitionAlpha = 0;
    transitionTarget = { room: targetRoom, x: spawnX, y: spawnY };
  }

  function updateTransition(dt) {
    if (!transitioning) return;

    if (transitionPhase === 'fade_out') {
      transitionAlpha += TRANSITION_SPEED * dt;
      if (transitionAlpha >= 1) {
        transitionAlpha = 1;
        // Switch room
        switchRoom(transitionTarget.room, transitionTarget.x, transitionTarget.y);
        transitionPhase = 'fade_in';
      }
    } else if (transitionPhase === 'fade_in') {
      transitionAlpha -= TRANSITION_SPEED * dt;
      if (transitionAlpha <= 0) {
        transitionAlpha = 0;
        transitionPhase = 'none';
        transitioning = false;
        transitionTarget = null;
      }
    }
  }

  function switchRoom(roomId, spawnX, spawnY) {
    currentRoom = roomId;
    var room = Rooms.getRoom(roomId);

    // Update world dimensions for this room
    CONSTANTS.WORLD_WIDTH = room.width;
    CONSTANTS.WORLD_HEIGHT = room.height;

    // Position player
    localPlayer.x = spawnX || room.spawnX;
    localPlayer.y = spawnY || room.spawnY;

    // Clear ground drinks and remote players for room transition
    groundDrinks.length = 0;
    remotePlayers.clear();

    // Notify server of room change
    if (window.Network && Network.sendRoomChange) {
      Network.sendRoomChange(roomId, localPlayer.x, localPlayer.y);
    }

    // Re-init crowd if entering main
    if (roomId === 'main') {
      initCrowd();
    } else {
      crowdNPCs.length = 0;
      // Add static backstage NPCs if applicable
      var roomDef = Rooms.getRoom(roomId);
      if (Array.isArray(roomDef.npcs)) {
        for (var i = 0; i < roomDef.npcs.length; i++) {
          var npcDef = roomDef.npcs[i];
          crowdNPCs.push({
            id: npcDef.id,
            name: '',
            x: npcDef.x,
            y: npcDef.y,
            color: npcDef.color,
            state: 'dancing',
            stateTimer: 9999,
            targetX: npcDef.x,
            targetY: npcDef.y,
            drinkState: Math.random() < 0.4 ? 'carrying' : 'none',
            drinkColor: DRINK_COLORS[Math.floor(Math.random() * DRINK_COLORS.length)],
            drinkTimer: 9999,
            groupIndex: 0,
            facingDx: npcDef.facingDx || 0,
            facingDy: npcDef.facingDy || -1,
            glanceTimer: 0,
            glanceDuration: 0
          });
        }
      }
    }

    // Tell renderer to recalculate
    if (window.Renderer && Renderer.onRoomChange) {
      Renderer.onRoomChange(roomId);
    }
  }

  function getLocalPlayer() {
    return localPlayer;
  }

  function getAllPlayers() {
    return [localPlayer].concat(Array.from(remotePlayers.values()));
  }

  function generateId() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, function () {
      return Math.floor(Math.random() * 16).toString(16);
    });
  }

  function addGroundDrink(drink) {
    if (!drink) return;
    groundDrinks.push({
      id: drink.id || generateId(),
      x: drink.x,
      y: drink.y,
      vx: drink.vx || 0,
      vy: drink.vy || 0,
      alpha: 1,
      fadeTimer: CONSTANTS.DRINK_FADE_TIME,
      color: drink.color
    });
  }

  // ─── Drink system ──────────────────────────────────────────────────

  var DRINK_COLORS = ['#c87533', '#a0522d', '#d2691e', '#b8860b', '#cd853f'];

  function isNearBar() {
    if (currentRoom !== 'main') return false;
    var barCX = 30 + 200 / 2;
    var barFrontY = 420 + 30;
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
    if (window.Network && Network.sendDrinkOrder) {
      Network.sendDrinkOrder(localPlayer.drinkColor);
    }
  }

  function dropDrink() {
    if (localPlayer.drinkState !== 'carrying') return;
    var angle = Math.random() * Math.PI * 2;
    var drinkId = generateId();
    var color = localPlayer.drinkColor || DRINK_COLORS[0];
    groundDrinks.push({
      id: drinkId,
      x: localPlayer.x,
      y: localPlayer.y,
      vx: Math.cos(angle) * CONSTANTS.DRINK_KICK_SPEED * 0.3,
      vy: Math.sin(angle) * CONSTANTS.DRINK_KICK_SPEED * 0.3,
      alpha: 1,
      fadeTimer: CONSTANTS.DRINK_FADE_TIME,
      color: color
    });
    localPlayer.drinkState = 'none';
    localPlayer.drinkTimer = 0;
    localPlayer.drinkColor = null;
    if (window.Network && Network.sendDrinkDrop) {
      Network.sendDrinkDrop(localPlayer.x, localPlayer.y, color, drinkId);
    }
  }

  function updateDrinkSystem(dt) {
    if (localPlayer.drinkState === 'ordering') {
      localPlayer.drinkOrderTimer -= dt;
      if (localPlayer.drinkOrderTimer <= 0) {
        localPlayer.drinkState = 'carrying';
        localPlayer.drinkTimer = CONSTANTS.DRINK_CARRY_TIME;
        if (window.Network && Network.sendDrinkCarry) {
          Network.sendDrinkCarry();
        }
      }
    }

    if (localPlayer.drinkState === 'carrying') {
      localPlayer.drinkTimer -= dt;
      if (localPlayer.drinkTimer <= 0) {
        dropDrink();
      }
    }

    for (var i = groundDrinks.length - 1; i >= 0; i--) {
      var drink = groundDrinks[i];
      drink.x += drink.vx * dt;
      drink.y += drink.vy * dt;
      drink.vx *= CONSTANTS.DRINK_FRICTION;
      drink.vy *= CONSTANTS.DRINK_FRICTION;

      var ww = CONSTANTS.WORLD_WIDTH;
      var wh = CONSTANTS.WORLD_HEIGHT;
      drink.x = Math.max(15, Math.min(ww - 15, drink.x));
      drink.y = Math.max(15, Math.min(wh - 15, drink.y));

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
        if (window.Network && Network.sendDrinkKick) {
          Network.sendDrinkKick(drink.id, drink.vx, drink.vy);
        }
      }
    }
  }

  // ─── Crowd NPC system ─────────────────────────────────────────────

  var NPC_COUNT = 10;
  var NPC_SPEED = 80;

  var NPC_COLORS = ['#e06090', '#60b080', '#b080e0', '#e0a050', '#50b0d0', '#d07070', '#70c070', '#a070d0', '#d0b040', '#60a0a0'];

  var NPC_GROUPS = [
    { members: [0, 1, 2], cx: 280, cy: 280, relocateTimer: 0 },
    { members: [3, 4, 5], cx: 420, cy: 300, relocateTimer: 0 },
    { members: [6, 7],    cx: 350, cy: 220, relocateTimer: 0 },
    { members: [8, 9],    cx: 500, cy: 260, relocateTimer: 0 }
  ];

  var DJ_X = 350;
  var DJ_Y = 35;

  var crowdNPCs = [];

  function randomInRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickBarTarget() {
    return { x: randomInRange(80, 220), y: randomInRange(500, 520) };
  }

  function pickGroupDanceTarget(groupIndex) {
    var group = NPC_GROUPS[groupIndex];
    var angle = Math.random() * Math.PI * 2;
    var dist = 15 + Math.random() * 25;
    var x = group.cx + Math.cos(angle) * dist;
    var y = group.cy + Math.sin(angle) * dist;
    x = Math.max(150, Math.min(650, x));
    y = Math.max(160, Math.min(420, y));
    return { x: x, y: y };
  }

  function getGroupForNPC(npcIndex) {
    for (var g = 0; g < NPC_GROUPS.length; g++) {
      for (var m = 0; m < NPC_GROUPS[g].members.length; m++) {
        if (NPC_GROUPS[g].members[m] === npcIndex) return g;
      }
    }
    return 0;
  }

  function npcDanceTimer() {
    return 8 + Math.random() * 8;
  }

  function npcDrinkTimer() {
    return 10 + Math.random() * 10;
  }

  function computeDJFacing(npc) {
    var dx = DJ_X - npc.x;
    var dy = DJ_Y - npc.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      npc.facingDx = dx / len;
      npc.facingDy = dy / len;
    }
  }

  function initCrowd() {
    crowdNPCs.length = 0;

    for (var g = 0; g < NPC_GROUPS.length; g++) {
      NPC_GROUPS[g].relocateTimer = 20 + Math.random() * 15;
    }

    for (var i = 0; i < NPC_COUNT; i++) {
      var groupIdx = getGroupForNPC(i);
      var startPos = pickGroupDanceTarget(groupIdx);

      var npc = {
        id: 'npc_' + i,
        name: '',
        x: startPos.x,
        y: startPos.y,
        color: NPC_COLORS[i],
        state: 'dancing',
        stateTimer: npcDanceTimer(),
        targetX: startPos.x,
        targetY: startPos.y,
        drinkState: 'none',
        drinkColor: null,
        drinkTimer: 0,
        groupIndex: groupIdx,
        facingDx: 0,
        facingDy: -1,
        glanceTimer: 0,
        glanceDuration: 0
      };
      computeDJFacing(npc);
      crowdNPCs.push(npc);
    }
  }

  function updateGroupCenters(dt) {
    for (var g = 0; g < NPC_GROUPS.length; g++) {
      var group = NPC_GROUPS[g];
      group.relocateTimer -= dt;
      if (group.relocateTimer <= 0) {
        group.cx = randomInRange(200, 600);
        group.cy = randomInRange(200, 380);
        group.relocateTimer = 20 + Math.random() * 15;
      }
    }
  }

  function updateCrowd(dt) {
    // Only run full crowd AI in main room
    if (currentRoom !== 'main') return;

    updateGroupCenters(dt);

    for (var i = 0; i < crowdNPCs.length; i++) {
      var npc = crowdNPCs[i];

      npc.stateTimer -= dt;

      if (npc.state === 'walking') {
        var dx = npc.targetX - npc.x;
        var dy = npc.targetY - npc.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 3) {
          npc.x = npc.targetX;
          npc.y = npc.targetY;
          npc.state = npc._destState || 'dancing';
          if (npc.state === 'dancing') {
            npc.stateTimer = npcDanceTimer();
            computeDJFacing(npc);
          } else if (npc.state === 'at_bar') {
            npc._barWait = 2 + Math.random();
          }
        } else {
          npc.x += (dx / dist) * NPC_SPEED * dt;
          npc.y += (dy / dist) * NPC_SPEED * dt;
        }
      }

      if (npc.stateTimer <= 0 && npc.state !== 'walking') {
        if (npc.state === 'dancing' && npc.drinkState === 'none') {
          if (Math.random() < 0.80) {
            var barTarget = pickBarTarget();
            npc.targetX = barTarget.x;
            npc.targetY = barTarget.y;
            npc.state = 'walking';
            npc._destState = 'at_bar';
          } else {
            var dancePos = pickGroupDanceTarget(npc.groupIndex);
            npc.targetX = dancePos.x;
            npc.targetY = dancePos.y;
            npc.state = 'walking';
            npc._destState = 'dancing';
          }
        } else if (npc.state === 'dancing' && npc.drinkState === 'carrying') {
          npc.stateTimer = 3 + Math.random() * 3;
        } else if (npc.state === 'at_bar') {
          npc.stateTimer = 2;
        } else {
          var fallbackPos = pickGroupDanceTarget(npc.groupIndex);
          npc.targetX = fallbackPos.x;
          npc.targetY = fallbackPos.y;
          npc.state = 'walking';
          npc._destState = 'dancing';
        }
      }

      if (npc.state === 'at_bar' && npc.drinkState === 'none' && npc._barWait !== undefined) {
        npc._barWait -= dt;
        if (npc._barWait <= 0) {
          npc.drinkState = 'carrying';
          npc.drinkColor = DRINK_COLORS[Math.floor(Math.random() * DRINK_COLORS.length)];
          npc.drinkTimer = npcDrinkTimer();
          delete npc._barWait;
          var danceTarget = pickGroupDanceTarget(npc.groupIndex);
          npc.targetX = danceTarget.x;
          npc.targetY = danceTarget.y;
          npc.state = 'walking';
          npc._destState = 'dancing';
        }
      }

      if (npc.drinkState === 'carrying') {
        npc.drinkTimer -= dt;
        if (npc.drinkTimer <= 0) {
          npc.drinkState = 'none';
          npc.drinkColor = null;
          npc.drinkTimer = 0;
        }
      }

      if (npc.state === 'dancing') {
        npc.glanceTimer -= dt;
        if (npc.glanceTimer <= 0 && npc.glanceDuration <= 0) {
          if (Math.random() < 0.02 * dt) {
            var gAngle = Math.random() * Math.PI * 2;
            npc.facingDx = Math.cos(gAngle);
            npc.facingDy = Math.sin(gAngle);
            npc.glanceDuration = 1 + Math.random();
            npc.glanceTimer = 0;
          }
        }
        if (npc.glanceDuration > 0) {
          npc.glanceDuration -= dt;
          if (npc.glanceDuration <= 0) {
            computeDJFacing(npc);
            npc.glanceDuration = 0;
          }
        }
      } else if (npc.state === 'walking') {
        npc.facingDx = 0;
        npc.facingDy = 0;
      }

      npc.x = Math.max(20, Math.min(780, npc.x));
      npc.y = Math.max(20, Math.min(580, npc.y));
    }
  }

  // ─── Multiplayer functions ────────────────────────────────────────

  function addPlayer(player) {
    if (!player || player.id === localPlayer.id) return;
    remotePlayers.set(player.id, {
      id: player.id,
      name: player.name || 'Anon',
      x: player.x || 0,
      y: player.y || 0,
      characterId: player.characterId || 0,
      drinkState: player.drinkState || 'none',
      drinkColor: player.drinkColor || null
    });
  }

  function removePlayer(id) {
    remotePlayers.delete(id);
  }

  function updatePlayerPosition(id, x, y) {
    var p = remotePlayers.get(id);
    if (p) {
      p.x = x;
      p.y = y;
    }
  }

  function updateRemotePlayerDrink(id, state, color) {
    var p = remotePlayers.get(id);
    if (p) {
      p.drinkState = state;
      p.drinkColor = color;
    }
  }

  function updateGroundDrinkVelocity(drinkId, vx, vy) {
    for (var i = 0; i < groundDrinks.length; i++) {
      if (groundDrinks[i].id === drinkId) {
        groundDrinks[i].vx = vx;
        groundDrinks[i].vy = vy;
        break;
      }
    }
  }

  function setRoomPlayers(list) {
    remotePlayers.clear();
    if (list) {
      for (var i = 0; i < list.length; i++) {
        addPlayer(list[i]);
      }
    }
  }

  function replaceGroundDrinks(list) {
    groundDrinks.length = 0;
    if (list) {
      for (var i = 0; i < list.length; i++) {
        addGroundDrink(list[i]);
      }
    }
  }

  initCrowd();

  window.Game = {
    CONSTANTS: CONSTANTS,
    localPlayer: localPlayer,
    getLocalPlayer: getLocalPlayer,
    getAllPlayers: getAllPlayers,
    groundDrinks: groundDrinks,
    addGroundDrink: addGroundDrink,
    isNearBar: isNearBar,
    tryOrderDrink: tryOrderDrink,
    updateDrinkSystem: updateDrinkSystem,
    dropDrink: dropDrink,
    kickNearbyDrink: kickNearbyDrink,
    crowdNPCs: crowdNPCs,
    updateCrowd: updateCrowd,
    get currentRoom() { return currentRoom; },
    transitionToRoom: transitionToRoom,
    updateTransition: updateTransition,
    get transitioning() { return transitioning; },
    get transitionAlpha() { return transitionAlpha; },
    get transitionPhase() { return transitionPhase; },
    switchRoom: switchRoom,
    addPlayer: addPlayer,
    removePlayer: removePlayer,
    updatePlayerPosition: updatePlayerPosition,
    updateRemotePlayerDrink: updateRemotePlayerDrink,
    updateGroundDrinkVelocity: updateGroundDrinkVelocity,
    setRoomPlayers: setRoomPlayers,
    replaceGroundDrinks: replaceGroundDrinks
  };
})();
