const crypto = require('crypto');
const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const SPAWN_X = 400;
const SPAWN_Y = 520;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, '..', 'public')));

const players = new Map();
const groundDrinks = new Map();

function broadcastToOthers(senderWs, message) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== senderWs && client.readyState === 1) {
      client.send(data);
    }
  });
}

function broadcastToAll(message) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

function stripWs(player) {
  const { ws, ...rest } = player;
  return rest;
}

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'join') {
      const name = typeof msg.name === 'string'
        ? msg.name.trim().slice(0, 16)
        : '';
      if (!name) return;

      if (playerId && players.has(playerId)) {
        players.delete(playerId);
        broadcastToOthers(ws, { type: 'player_left', id: playerId });
      }

      playerId = crypto.randomUUID();
      const player = { id: playerId, name, x: SPAWN_X, y: SPAWN_Y, hasDrink: false, drinkType: null, ws };
      players.set(playerId, player);

      const existingPlayers = [];
      players.forEach((p) => {
        if (p.id !== playerId) {
          existingPlayers.push(stripWs(p));
        }
      });

      ws.send(JSON.stringify({
        type: 'welcome',
        id: playerId,
        players: existingPlayers,
      }));

      broadcastToOthers(ws, {
        type: 'player_joined',
        player: stripWs(player),
      });
    }

    if (msg.type === 'move' && playerId) {
      const player = players.get(playerId);
      if (!player) return;

      const x = typeof msg.x === 'number' ? msg.x : player.x;
      const y = typeof msg.y === 'number' ? msg.y : player.y;
      player.x = x;
      player.y = y;

      broadcastToOthers(ws, {
        type: 'player_moved',
        id: playerId,
        x,
        y,
      });
    }
  });

  ws.on('close', () => {
    if (playerId && players.has(playerId)) {
      players.delete(playerId);
      broadcastToAll({ type: 'player_left', id: playerId });
    }
  });

  ws.on('error', () => {
    // handled by close event
  });
});

server.listen(PORT, () => {
  process.stdout.write(`Music Club server listening on port ${PORT}\n`);
});
