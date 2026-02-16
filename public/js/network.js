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
    }
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function sendJoin(name) {
    send({ type: 'join', name: name });
  }

  function sendMove(x, y) {
    var now = Date.now();
    if (now - lastSendTime < THROTTLE_MS) {
      return;
    }
    lastSendTime = now;
    send({ type: 'move', x: x, y: y });
  }

  window.Network = {
    connect: connect,
    sendJoin: sendJoin,
    sendMove: sendMove
  };
})();
