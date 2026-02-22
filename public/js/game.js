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
      y: player.y || CONSTANTS.SPAWN_Y,
      drinkState: player.drinkState || 'none',
      drinkColor: player.drinkColor || null
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

  function updateRemotePlayerDrink(id, drinkState, drinkColor) {
    var player = remotePlayers.get(id);
    if (player) {
      player.drinkState = drinkState || 'none';
      player.drinkColor = drinkColor || null;
    }
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

  function updateGroundDrinkVelocity(drinkId, vx, vy) {
    for (var i = 0; i < groundDrinks.length; i++) {
      if (groundDrinks[i].id === drinkId) {
        groundDrinks[i].vx = vx;
        groundDrinks[i].vy = vy;
        return;
      }
    }
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
    Network.sendDrinkOrder(localPlayer.drinkColor);
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
    Network.sendDrinkDrop(localPlayer.x, localPlayer.y, color, drinkId);
  }

  function updateDrinkSystem(dt) {
    // Update ordering state
    if (localPlayer.drinkState === 'ordering') {
      localPlayer.drinkOrderTimer -= dt;
      if (localPlayer.drinkOrderTimer <= 0) {
        localPlayer.drinkState = 'carrying';
        localPlayer.drinkTimer = CONSTANTS.DRINK_CARRY_TIME;
        Network.sendDrinkCarry();
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
        if (drink.id) {
          Network.sendDrinkKick(drink.id, drink.vx, drink.vy);
        }
      }
    }
  }

  // ─── Crowd NPC system ─────────────────────────────────────────────

  var NPC_COUNT = 10;
  var NPC_SPEED = 80;

  var NPC_COLORS = ['#e06090', '#60b080', '#b080e0', '#e0a050', '#50b0d0', '#d07070', '#70c070', '#a070d0', '#d0b040', '#60a0a0'];

  // ─── Lightshow phase computation ──────────────────────────────────
  var DANCE_BPM = 140;
  var DANCE_BEAT_MS = 60000 / DANCE_BPM;
  var LIGHTSHOW_BAR_MS = DANCE_BEAT_MS * 4;
  var LIGHTSHOW_PHASES = [
    { name: "intro", bars: 16 },
    { name: "breakdown", bars: 16 },
    { name: "buildup", bars: 8 },
    { name: "drop", bars: 16 },
    { name: "outro", bars: 8 }
  ];

  var LIGHTSHOW_TOTAL_MS = 0;
  var LIGHTSHOW_PHASE_STARTS = [];
  (function () {
    var offset = 0;
    for (var i = 0; i < LIGHTSHOW_PHASES.length; i++) {
      LIGHTSHOW_PHASE_STARTS.push(offset);
      offset += LIGHTSHOW_PHASES[i].bars * LIGHTSHOW_BAR_MS;
    }
    LIGHTSHOW_TOTAL_MS = offset;
  })();

  function getLightshowPhase(time) {
    var t = time % LIGHTSHOW_TOTAL_MS;
    for (var i = LIGHTSHOW_PHASES.length - 1; i >= 0; i--) {
      if (t >= LIGHTSHOW_PHASE_STARTS[i]) {
        var phaseLen = LIGHTSHOW_PHASES[i].bars * LIGHTSHOW_BAR_MS;
        var elapsed = t - LIGHTSHOW_PHASE_STARTS[i];
        return { name: LIGHTSHOW_PHASES[i].name, progress: elapsed / phaseLen };
      }
    }
    return { name: "intro", progress: 0 };
  }

  // Group system: 4 groups (3, 3, 2, 2) with cluster centers on the dance floor
  var NPC_GROUPS = [
    { members: [0, 1, 2], cx: 280, cy: 280, relocateTimer: 0 },
    { members: [3, 4, 5], cx: 420, cy: 300, relocateTimer: 0 },
    { members: [6, 7],    cx: 350, cy: 220, relocateTimer: 0 },
    { members: [8, 9],    cx: 500, cy: 260, relocateTimer: 0 }
  ];

  // DJ position (top-center of dance floor)
  var DJ_X = 400;
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
    var dist = 15 + Math.random() * 25; // 15-40px from group center
    var x = group.cx + Math.cos(angle) * dist;
    var y = group.cy + Math.sin(angle) * dist;
    // Clamp to dance floor bounds
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
    return 8 + Math.random() * 8; // 8-16s dancing
  }

  function npcDrinkTimer() {
    return 10 + Math.random() * 10; // 10-20s carrying drink
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

    // Initialize group relocate timers
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
        glanceDuration: 0,
        handRaised: false,
        handRaiseTimer: 0,
        energy: 0,
        cheering: false,
        danceCircleRole: null
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
        // Slowly relocate group center on dance floor
        group.cx = randomInRange(200, 600);
        group.cy = randomInRange(200, 380);
        group.relocateTimer = 20 + Math.random() * 15; // 20-35s
      }
    }
  }

  function updateCrowd(dt) {
    updateGroupCenters(dt);

    // Lightshow-reactive behavior
    var phase = getLightshowPhase(Date.now());

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
          npc.state = npc._destState || 'dancing';
          if (npc.state === 'dancing') {
            npc.stateTimer = npcDanceTimer();
            computeDJFacing(npc);
          } else if (npc.state === 'at_bar') {
            // Start drink pickup timer (2-3s)
            npc._barWait = 2 + Math.random();
          }
        } else {
          npc.x += (dx / dist) * NPC_SPEED * dt;
          npc.y += (dy / dist) * NPC_SPEED * dt;
        }
      }

      // State timer expired — party behavior loop
      if (npc.stateTimer <= 0 && npc.state !== 'walking') {
        if (npc.state === 'dancing' && npc.drinkState === 'none') {
          // Dancing without drink: 80% go to bar, 20% keep dancing
          if (Math.random() < 0.80) {
            var barTarget = pickBarTarget();
            npc.targetX = barTarget.x;
            npc.targetY = barTarget.y;
            npc.state = 'walking';
            npc._destState = 'at_bar';
          } else {
            // Keep dancing, pick new position near group
            var dancePos = pickGroupDanceTarget(npc.groupIndex);
            npc.targetX = dancePos.x;
            npc.targetY = dancePos.y;
            npc.state = 'walking';
            npc._destState = 'dancing';
          }
        } else if (npc.state === 'dancing' && npc.drinkState === 'carrying') {
          // Dancing with drink — drink timer handled below; when timer expires,
          // dance briefly without drink then go to bar
          // (drink consumed, stay dancing a bit then go to bar on next timer)
          npc.stateTimer = 3 + Math.random() * 3; // brief dance without drink
        } else if (npc.state === 'at_bar') {
          // Shouldn't normally expire here; bar wait handles transition
          npc.stateTimer = 2;
        } else {
          // Fallback: go dance
          var fallbackPos = pickGroupDanceTarget(npc.groupIndex);
          npc.targetX = fallbackPos.x;
          npc.targetY = fallbackPos.y;
          npc.state = 'walking';
          npc._destState = 'dancing';
        }
      }

      // Bar drink pickup
      if (npc.state === 'at_bar' && npc.drinkState === 'none' && npc._barWait !== undefined) {
        npc._barWait -= dt;
        if (npc._barWait <= 0) {
          npc.drinkState = 'carrying';
          npc.drinkColor = DRINK_COLORS[Math.floor(Math.random() * DRINK_COLORS.length)];
          npc.drinkTimer = npcDrinkTimer();
          delete npc._barWait;
          // Head back to dance floor with drink
          var danceTarget = pickGroupDanceTarget(npc.groupIndex);
          npc.targetX = danceTarget.x;
          npc.targetY = danceTarget.y;
          npc.state = 'walking';
          npc._destState = 'dancing';
        }
      }

      // Drink timer — consume after duration (no longer dropped when dancing)
      if (npc.drinkState === 'carrying') {
        npc.drinkTimer -= dt;
        if (npc.drinkTimer <= 0) {
          npc.drinkState = 'none';
          npc.drinkColor = null;
          npc.drinkTimer = 0;
        }
      }

      // Facing: face DJ while dancing, with occasional glances
      if (npc.state === 'dancing') {
        npc.glanceTimer -= dt;
        if (npc.glanceTimer <= 0 && npc.glanceDuration <= 0) {
          // ~2% chance per second to glance (check every frame)
          if (Math.random() < 0.02 * dt) {
            var gAngle = Math.random() * Math.PI * 2;
            npc.facingDx = Math.cos(gAngle);
            npc.facingDy = Math.sin(gAngle);
            npc.glanceDuration = 1 + Math.random(); // 1-2s
            npc.glanceTimer = 0;
          }
        }
        if (npc.glanceDuration > 0) {
          npc.glanceDuration -= dt;
          if (npc.glanceDuration <= 0) {
            // Snap back to facing DJ
            computeDJFacing(npc);
            npc.glanceDuration = 0;
          }
        }
      } else if (npc.state === 'walking') {
        // While walking, face movement direction (handled by renderer)
        npc.facingDx = 0;
        npc.facingDy = 0;
      }


      // ── Lightshow-reactive energy system ──
      if (phase.name === "buildup") {
        npc.energy = Math.min(1, npc.energy + dt * 0.3);
      } else if (phase.name === "drop") {
        npc.energy = 1;
      } else if (phase.name === "outro" || phase.name === "intro") {
        npc.energy = Math.max(0, npc.energy - dt * 0.15);
      } else if (phase.name === "breakdown") {
        npc.energy = Math.max(0.2, npc.energy - dt * 0.05);
      }

      // ── Hand raising during drop ──
      if (phase.name === "drop" && npc.energy > 0.7 && !npc.handRaised) {
        if (Math.random() < 0.05 * dt) {
          npc.handRaised = true;
          npc.handRaiseTimer = 2 + Math.random() * 2; // 2-4 seconds
        }
      }
      if (npc.handRaised) {
        npc.handRaiseTimer -= dt;
        if (npc.handRaiseTimer <= 0) {
          npc.handRaised = false;
          npc.handRaiseTimer = 0;
        }
      }

      // ── Cheering during drop ──
      if (phase.name === "drop" && npc.energy > 0.8) {
        npc.cheering = true;
      } else {
        npc.cheering = false;
      }
      // Clamp to world bounds
      npc.x = Math.max(20, Math.min(780, npc.x));
      npc.y = Math.max(20, Math.min(580, npc.y));
    }

    // ── Dance circle logic ──
    if (phase.name === "drop" && phase.progress > 0.3 && phase.progress < 0.8) {
      // Check if any NPC is already center
      var hasCenter = false;
      for (var dc = 0; dc < crowdNPCs.length; dc++) {
        if (crowdNPCs[dc].danceCircleRole === "center") { hasCenter = true; break; }
      }
      if (!hasCenter) {
        // Pick a random dancing NPC as center
        var candidates = [];
        for (var dc2 = 0; dc2 < crowdNPCs.length; dc2++) {
          if (crowdNPCs[dc2].state === "dancing") candidates.push(dc2);
        }
        if (candidates.length > 0) {
          var centerIdx = candidates[Math.floor(Math.random() * candidates.length)];
          var centerNpc = crowdNPCs[centerIdx];
          centerNpc.danceCircleRole = "center";
          // Move center NPC to a central dance position
          centerNpc.targetX = 380 + Math.random() * 40;
          centerNpc.targetY = 280 + Math.random() * 40;
          // Mark other NPCs in the same group as ring
          var centerGroup = centerNpc.groupIndex;
          for (var dc3 = 0; dc3 < crowdNPCs.length; dc3++) {
            if (dc3 !== centerIdx && crowdNPCs[dc3].groupIndex === centerGroup && crowdNPCs[dc3].danceCircleRole !== "center") {
              crowdNPCs[dc3].danceCircleRole = "ring";
            }
          }
        }
      }
    } else {
      // Clear dance circle roles outside active drop window
      for (var dc4 = 0; dc4 < crowdNPCs.length; dc4++) {
        crowdNPCs[dc4].danceCircleRole = null;
      }
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
    updateRemotePlayerDrink: updateRemotePlayerDrink,
    getLocalPlayer: getLocalPlayer,
    getAllPlayers: getAllPlayers,
    groundDrinks: groundDrinks,
    addGroundDrink: addGroundDrink,
    updateGroundDrinkVelocity: updateGroundDrinkVelocity,
    isNearBar: isNearBar,
    tryOrderDrink: tryOrderDrink,
    updateDrinkSystem: updateDrinkSystem,
    dropDrink: dropDrink,
    kickNearbyDrink: kickNearbyDrink,
    crowdNPCs: crowdNPCs,
    updateCrowd: updateCrowd,
    getLightshowPhase: getLightshowPhase,
    currentRoom: 'main',
    transitioning: false,
    transitionAlpha: 0,
    transitionToRoom: function (roomId, spawnX, spawnY) {
      var self = window.Game;
      if (self.transitioning) return;
      self.transitioning = true;
      self.transitionAlpha = 0;
      var fadeIn = setInterval(function () {
        self.transitionAlpha += 0.05;
        if (self.transitionAlpha >= 1) {
          self.transitionAlpha = 1;
          clearInterval(fadeIn);
          // Switch room
          self.currentRoom = roomId;
          if (typeof Rooms !== 'undefined' && Rooms.getRoom) {
            var room = Rooms.getRoom(roomId);
            if (room) {
              self.CONSTANTS.WORLD_WIDTH = room.width;
              self.CONSTANTS.WORLD_HEIGHT = room.height;
              localPlayer.x = spawnX || room.spawnX;
              localPlayer.y = spawnY || room.spawnY;
            }
          }
          if (typeof Renderer !== 'undefined' && Renderer.onRoomChange) {
            Renderer.onRoomChange(roomId);
          }
          // Fade out
          var fadeOut = setInterval(function () {
            self.transitionAlpha -= 0.05;
            if (self.transitionAlpha <= 0) {
              self.transitionAlpha = 0;
              self.transitioning = false;
              clearInterval(fadeOut);
            }
          }, 30);
        }
      }, 30);
    }
  };
})();
