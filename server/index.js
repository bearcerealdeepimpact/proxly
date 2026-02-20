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

const playlist = [
  { name: 'Chill Vibes', url: '/music/track1.mp3', duration: 180 },
  { name: 'Sunset Dreams', url: '/music/track2.mp3', duration: 210 },
  { name: 'Night Cruise', url: '/music/track3.mp3', duration: 195 },
  { name: 'Cyber Flow', url: '/music/track4.mp3', duration: 220 },
  { name: 'Neon Pulse', url: '/music/track5.mp3', duration: 200 },
];

const musicState = {
  currentTrackIndex: 0,
  trackStartTime: Date.now(),
  serverStartTime: Date.now(),
};

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
      const player = { id: playerId, name, x: SPAWN_X, y: SPAWN_Y, ws };
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

      ws.send(JSON.stringify({
        type: 'music_state',
        currentTrackIndex: musicState.currentTrackIndex,
        trackStartTime: musicState.trackStartTime,
        serverStartTime: musicState.serverStartTime,
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
