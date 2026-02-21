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

    if (msg.type === 'drink_order' && playerId) {
      const player = players.get(playerId);
      if (!player) return;

      // Validate player is at bar (x < 300, y > 440)
      if (player.x >= 300 || player.y <= 440) return;

      // Validate player doesn't already have a drink
      if (player.hasDrink) return;

      // Validate drink type
      const drinkType = typeof msg.drinkType === 'string'
        ? msg.drinkType.trim()
        : '';
      if (!drinkType || !['beer', 'wine', 'cocktail'].includes(drinkType)) return;

      // Update player state
      player.hasDrink = true;
      player.drinkType = drinkType;

      // Broadcast to all players
      broadcastToAll({
        type: 'drink_ordered',
        id: playerId,
        drinkType,
      });
    }

    if (msg.type === 'drink_drop' && playerId) {
      const player = players.get(playerId);
      if (!player) return;

      // Validate player has a drink
      if (!player.hasDrink) return;

      // Create ground drink
      const drinkId = crypto.randomUUID();
      const groundDrink = {
        id: drinkId,
        x: player.x,
        y: player.y,
        drinkType: player.drinkType,
      };
      groundDrinks.set(drinkId, groundDrink);

      // Update player state
      player.hasDrink = false;
      player.drinkType = null;

      // Broadcast to all players
      broadcastToAll({
        type: 'drink_dropped',
        playerId: playerId,
        drink: groundDrink,
      });
    }

    if (msg.type === 'drink_kick' && playerId) {
      const player = players.get(playerId);
      if (!player) return;

      // Validate drinkId
      const drinkId = typeof msg.drinkId === 'string' ? msg.drinkId.trim() : '';
      if (!drinkId) return;

      const drink = groundDrinks.get(drinkId);
      if (!drink) return;

      // Validate proximity (within 50 pixels)
      const dx = player.x - drink.x;
      const dy = player.y - drink.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 50) return;

      // Calculate kick direction (away from player)
      const angle = Math.atan2(drink.y - player.y, drink.x - player.x);
      const kickForce = 100; // pixels to move
      const newX = drink.x + Math.cos(angle) * kickForce;
      const newY = drink.y + Math.sin(angle) * kickForce;

      // Update drink position
      drink.x = newX;
      drink.y = newY;

      // Broadcast to all players
      broadcastToAll({
        type: 'drink_kicked',
        drinkId: drinkId,
        x: newX,
        y: newY,
        kickedBy: playerId,
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
