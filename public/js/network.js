(function () {
  'use strict';

  var ws = null;
  var reconnectTimer = null;
  var lastSendTime = 0;
  var THROTTLE_MS = 50;
  var RECONNECT_MS = 2000;
  var disconnectOverlay = null;

  function getDisconnectOverlay() {
    if (!disconnectOverlay) {
      disconnectOverlay = document.getElementById('disconnectedOverlay');
    }
    return disconnectOverlay;
  }

  function showDisconnectOverlay() {
    var overlay = getDisconnectOverlay();
    if (overlay) {
      overlay.style.display = 'flex';
    }
  }

  function hideDisconnectOverlay() {
    var overlay = getDisconnectOverlay();
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = protocol + '//' + window.location.host;
    ws = new WebSocket(url);

    ws.onopen = function () {
      hideDisconnectOverlay();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (Game.localPlayer.name) {
        Game.remotePlayers.clear();
        sendJoin(Game.localPlayer.name);
      }
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
      ws = null;
      showDisconnectOverlay();
      scheduleReconnect();
    };

    ws.onerror = function () {
      if (ws) {
        ws.close();
      }
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) {
      return;
    }
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      connect();
    }, RECONNECT_MS);
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        Game.localPlayer.id = msg.id;
        if (Array.isArray(msg.players)) {
          msg.players.forEach(function (p) {
            Game.addPlayer(p);
          });
        }
        // Initialize ground drinks from server
        if (Array.isArray(msg.groundDrinks)) {
          msg.groundDrinks.forEach(function (drink) {
            Game.addGroundDrink(drink);
          });
        }
        send({ type: 'move', x: Game.localPlayer.x, y: Game.localPlayer.y });
        break;

      case 'player_joined':
        Game.addPlayer(msg.player);
        break;

      case 'player_moved':
        Game.updatePlayerPosition(msg.id, msg.x, msg.y);
        break;

      case 'player_left':
        Game.removePlayer(msg.id);
        break;

      case 'drink_update':
        Game.updateRemotePlayerDrink(msg.id, msg.drinkState, msg.drinkColor);
        break;

      case 'drink_dropped':
        Game.updateRemotePlayerDrink(msg.playerId, 'none', null);
        Game.addGroundDrink(msg.drink);
        break;

      case 'drink_kicked':
        Game.updateGroundDrinkVelocity(msg.drinkId, msg.vx, msg.vy);
        break;

      case 'music_state':
        MusicPlayer.handleMusicState(msg);
        break;

      case 'music_sync':
        MusicPlayer.handleMusicSync(msg);
        break;
    }
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function sendJoin(name) {
    send({
      type: 'join',
      name: name,
      characterId: Game.localPlayer.characterId
    });
  }

  var pendingMoveTimer = null;

  function sendMove(x, y) {
    var now = Date.now();
    if (now - lastSendTime < THROTTLE_MS) {
      clearTimeout(pendingMoveTimer);
      pendingMoveTimer = setTimeout(function () {
        lastSendTime = Date.now();
        send({ type: 'move', x: x, y: y });
      }, THROTTLE_MS);
      return;
    }
    clearTimeout(pendingMoveTimer);
    lastSendTime = now;
    send({ type: 'move', x: x, y: y });
  }

  function sendDrinkOrder(color) {
    send({ type: 'drink_order', drinkColor: color });
  }

  function sendDrinkCarry() {
    send({ type: 'drink_carry' });
  }

  function sendDrinkDrop(x, y, color, id) {
    send({ type: 'drink_drop', x: x, y: y, color: color, id: id });
  }

  function sendDrinkKick(drinkId, vx, vy) {
    send({ type: 'drink_kick', drinkId: drinkId, vx: vx, vy: vy });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var reconnectBtn = document.getElementById('reconnectBtn');
    if (reconnectBtn) {
      reconnectBtn.addEventListener('click', function () {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        connect();
      });
    }
  });

  window.Network = {
    connect: connect,
    sendJoin: sendJoin,
    sendMove: sendMove,
    sendDrinkOrder: sendDrinkOrder,
    sendDrinkCarry: sendDrinkCarry,
    sendDrinkDrop: sendDrinkDrop,
    sendDrinkKick: sendDrinkKick
  };
})();
