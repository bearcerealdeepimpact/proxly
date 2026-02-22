(function () {
  'use strict';

  // ─── REST helpers (unchanged) ───────────────────────────────────

  function postJSON(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) { return res.json(); });
  }

  function submitDemoDrop(artistName, email, demoLink, message) {
    return postJSON('/api/demo-drop', {
      artistName: artistName,
      email: email,
      demoLink: demoLink,
      message: message
    });
  }

  function submitMailingList(email) {
    return postJSON('/api/mailing-list', { email: email });
  }

  // ─── WebSocket client ───────────────────────────────────────────

  var ws = null;
  var reconnectTimer = null;
  var connected = false;

  // Movement throttle: 50ms (20 updates/sec)
  var MOVE_THROTTLE = 50;
  var lastMoveSent = 0;
  var pendingMove = null;
  var pendingMoveTimer = null;

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + location.host);

    ws.onopen = function () {
      connected = true;
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
      hideDisconnectOverlay();

      // Send join
      var player = Game.localPlayer;
      send({
        type: 'join',
        name: player.name,
        characterId: player.characterId
      });
    };

    ws.onmessage = function (event) {
      var msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      handleMessage(msg);
    };

    ws.onclose = function () {
      connected = false;
      showDisconnectOverlay();

      // Auto-reconnect every 2s
      if (!reconnectTimer) {
        reconnectTimer = setInterval(function () {
          connect();
        }, 2000);
      }
    };
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // ─── Send functions ─────────────────────────────────────────────

  function sendMove(x, y) {
    var now = Date.now();
    var elapsed = now - lastMoveSent;

    if (elapsed >= MOVE_THROTTLE) {
      send({ type: 'move', x: x, y: y });
      lastMoveSent = now;
      pendingMove = null;
      if (pendingMoveTimer) {
        clearTimeout(pendingMoveTimer);
        pendingMoveTimer = null;
      }
    } else {
      // Queue the latest position to send when throttle expires
      pendingMove = { x: x, y: y };
      if (!pendingMoveTimer) {
        pendingMoveTimer = setTimeout(function () {
          if (pendingMove) {
            send({ type: 'move', x: pendingMove.x, y: pendingMove.y });
            lastMoveSent = Date.now();
            pendingMove = null;
          }
          pendingMoveTimer = null;
        }, MOVE_THROTTLE - elapsed);
      }
    }
  }

  function sendRoomChange(targetRoom, spawnX, spawnY) {
    send({ type: 'room_change', targetRoom: targetRoom, spawnX: spawnX, spawnY: spawnY });
  }

  function sendDrinkOrder(color) {
    send({ type: 'drink_order', drinkColor: color });
  }

  function sendDrinkCarry() {
    send({ type: 'drink_carry' });
  }

  function sendDrinkDrop(x, y, color, id) {
    send({ type: 'drink_drop', id: id, x: x, y: y, color: color });
  }

  function sendDrinkKick(drinkId, vx, vy) {
    send({ type: 'drink_kick', drinkId: drinkId, vx: vx, vy: vy });
  }

  // ─── Message handlers ──────────────────────────────────────────

  function handleMessage(msg) {
    switch (msg.type) {

      case 'welcome':
        Game.localPlayer.id = msg.id;
        // Add existing players in room
        if (msg.players) {
          for (var i = 0; i < msg.players.length; i++) {
            Game.addPlayer(msg.players[i]);
          }
        }
        // Add existing ground drinks
        if (msg.groundDrinks) {
          for (var j = 0; j < msg.groundDrinks.length; j++) {
            Game.addGroundDrink(msg.groundDrinks[j]);
          }
        }
        break;

      case 'player_joined':
        Game.addPlayer(msg.player);
        break;

      case 'player_left':
        Game.removePlayer(msg.id);
        break;

      case 'player_moved':
        Game.updatePlayerPosition(msg.id, msg.x, msg.y);
        break;

      case 'room_state':
        Game.setRoomPlayers(msg.players);
        Game.replaceGroundDrinks(msg.groundDrinks);
        break;

      case 'drink_update':
        Game.updateRemotePlayerDrink(msg.id, msg.drinkState, msg.drinkColor);
        break;

      case 'drink_dropped':
        Game.addGroundDrink(msg.drink);
        break;

      case 'drink_kicked':
        Game.updateGroundDrinkVelocity(msg.drinkId, msg.vx, msg.vy);
        break;

      case 'music_state':
        // Could sync music position here in future
        break;
    }
  }

  // ─── Disconnect overlay ─────────────────────────────────────────

  function showDisconnectOverlay() {
    var el = document.getElementById('disconnectedOverlay');
    if (el) el.style.display = 'flex';
  }

  function hideDisconnectOverlay() {
    var el = document.getElementById('disconnectedOverlay');
    if (el) el.style.display = 'none';
  }

  // ─── Exports ────────────────────────────────────────────────────

  window.Network = {
    submitDemoDrop: submitDemoDrop,
    submitMailingList: submitMailingList,
    connect: connect,
    sendMove: sendMove,
    sendRoomChange: sendRoomChange,
    sendDrinkOrder: sendDrinkOrder,
    sendDrinkCarry: sendDrinkCarry,
    sendDrinkDrop: sendDrinkDrop,
    sendDrinkKick: sendDrinkKick
  };
})();
