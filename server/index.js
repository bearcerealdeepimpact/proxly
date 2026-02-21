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
const groundDrinks = new Map(); // id -> { id, x, y, vx, vy, color, fadeTimer }

const playlist = [
  { title: 'Electric Dreams', artist: 'Neon Skyline', filename: 'electric-dreams.mp3', duration: 203 },
  { title: 'Midnight Groove', artist: 'The Funkateers', filename: 'midnight-groove.mp3', duration: 185 },
  { title: 'Cosmic Voyage', artist: 'Stellar Collective', filename: 'cosmic-voyage.mp3', duration: 247 },
  { title: 'Urban Pulse', artist: 'City Rhythms', filename: 'urban-pulse.mp3', duration: 192 },
  { title: 'Sunset Boulevard', artist: 'LA Soundwaves', filename: 'sunset-boulevard.mp3', duration: 218 },
  { title: 'Digital Horizons', artist: 'Synthwave Alliance', filename: 'digital-horizons.mp3', duration: 234 },
];

const musicState = {
  currentTrackIndex: 0,
  trackStartTime: Date.now(),
  serverStartTime: Date.now(),
};

setInterval(() => {
  const currentTrack = playlist[musicState.currentTrackIndex];
  const elapsed = (Date.now() - musicState.trackStartTime) / 1000;

  if (elapsed >= currentTrack.duration) {
    musicState.currentTrackIndex = (musicState.currentTrackIndex + 1) % playlist.length;
    musicState.trackStartTime = Date.now();

    broadcastToAll({
      type: 'track_changed',
      currentTrackIndex: musicState.currentTrackIndex,
      trackStartTime: musicState.trackStartTime,
      playlist,
    });
  }
}, 1000);

setInterval(() => {
  broadcastToAll({
    type: 'music_sync',
    currentTrackIndex: musicState.currentTrackIndex,
    trackStartTime: musicState.trackStartTime,
    serverTime: Date.now(),
    playlist,
  });
}, 5000);

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

      // Validate and store characterId from client
      const characterId = typeof msg.characterId === 'number'
        ? Math.max(0, Math.min(5, Math.floor(msg.characterId)))
        : Math.floor(Math.random() * 6);  // Fallback if not provided

      if (!name) return;

      if (playerId && players.has(playerId)) {
        players.delete(playerId);
        broadcastToOthers(ws, { type: 'player_left', id: playerId });
      }

      playerId = crypto.randomUUID();
      const player = { id: playerId, name, x: SPAWN_X, y: SPAWN_Y, characterId, drinkState: 'none', drinkColor: null, ws };
      players.set(playerId, player);

      const existingPlayers = [];
      players.forEach((p) => {
        if (p.id !== playerId) {
          existingPlayers.push(stripWs(p));
        }
      });

      const groundDrinksArray = [];
      groundDrinks.forEach((d) => { groundDrinksArray.push(d); });

      ws.send(JSON.stringify({
        type: 'welcome',
        id: playerId,
        players: existingPlayers,
        groundDrinks: groundDrinksArray,
      }));

      ws.send(JSON.stringify({
        type: 'music_state',
        currentTrackIndex: musicState.currentTrackIndex,
        trackStartTime: musicState.trackStartTime,
        serverStartTime: musicState.serverStartTime,
        serverTime: Date.now(),
        playlist,
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
      player.drinkState = 'ordering';
      player.drinkColor = typeof msg.drinkColor === 'string' ? msg.drinkColor : null;
      broadcastToOthers(ws, {
        type: 'drink_update',
        id: playerId,
        drinkState: player.drinkState,
        drinkColor: player.drinkColor,
      });
    }

    if (msg.type === 'drink_carry' && playerId) {
      const player = players.get(playerId);
      if (!player) return;
      player.drinkState = 'carrying';
      broadcastToOthers(ws, {
        type: 'drink_update',
        id: playerId,
        drinkState: player.drinkState,
        drinkColor: player.drinkColor,
      });
    }

    if (msg.type === 'drink_drop' && playerId) {
      const player = players.get(playerId);
      if (!player) return;

      const drinkId = typeof msg.id === 'string' ? msg.id : crypto.randomUUID();
      const x = typeof msg.x === 'number' ? msg.x : player.x;
      const y = typeof msg.y === 'number' ? msg.y : player.y;
      const color = typeof msg.color === 'string' ? msg.color : player.drinkColor;

      const drink = { id: drinkId, x, y, vx: 0, vy: 0, color };
      groundDrinks.set(drinkId, drink);

      player.drinkState = 'none';
      player.drinkColor = null;

      broadcastToOthers(ws, {
        type: 'drink_dropped',
        playerId,
        drink,
      });

      // Auto-remove after fade time (8 seconds)
      setTimeout(() => { groundDrinks.delete(drinkId); }, 8000);
    }

    if (msg.type === 'drink_kick' && playerId) {
      const drinkId = typeof msg.drinkId === 'string' ? msg.drinkId : null;
      if (!drinkId) return;
      const drink = groundDrinks.get(drinkId);
      if (!drink) return;

      drink.vx = typeof msg.vx === 'number' ? msg.vx : 0;
      drink.vy = typeof msg.vy === 'number' ? msg.vy : 0;

      broadcastToOthers(ws, {
        type: 'drink_kicked',
        drinkId,
        vx: drink.vx,
        vy: drink.vy,
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
