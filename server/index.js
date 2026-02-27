const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const VALID_ROOMS = ['main', 'backstage', 'releases', 'vip'];

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── REST endpoints (unchanged) ───────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/playlist', (req, res) => {
  const playlistJson = require(path.join(__dirname, '..', 'public', 'audio', 'playlist.json'));
  res.json(playlistJson);
});

app.post('/api/demo-drop', (req, res) => {
  const { artistName, email, demoLink, message } = req.body;
  if (!artistName || !email || !demoLink) {
    return res.status(400).json({ error: 'Missing required fields: artistName, email, demoLink' });
  }
  console.log('--- DEMO DROP SUBMISSION ---');
  console.log('Artist:', artistName);
  console.log('Email:', email);
  console.log('Demo Link:', demoLink);
  console.log('Message:', message || '(none)');
  console.log('----------------------------');
  res.json({ success: true, message: 'Demo received! We\'ll have a listen.' });
});

app.post('/api/mailing-list', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  console.log('--- MAILING LIST SIGNUP ---');
  console.log('Email:', email);
  console.log('--------------------------');
  res.json({ success: true, message: 'You\'re on the list!' });
});

// ─── Multiplayer state ────────────────────────────────────────────

const players = new Map();       // uuid → { id, name, x, y, characterId, drinkState, drinkColor, room, ws }
const groundDrinks = new Map();  // drinkId → { id, x, y, vx, vy, color, room }
const chatRateLimit = new Map(); // playerId → lastMessageTimestamp

function stripWs(player) {
  const { ws, ...rest } = player;
  return rest;
}

function broadcastToRoom(room, msg, excludeWs) {
  const data = JSON.stringify(msg);
  for (const p of players.values()) {
    if (p.room === room && p.ws !== excludeWs && p.ws.readyState === 1) {
      p.ws.send(data);
    }
  }
}

function broadcastToAll(msg) {
  const data = JSON.stringify(msg);
  for (const p of players.values()) {
    if (p.ws.readyState === 1) {
      p.ws.send(data);
    }
  }
}

function getPlayersInRoom(room, excludeId) {
  const result = [];
  for (const p of players.values()) {
    if (p.room === room && p.id !== excludeId) {
      result.push(stripWs(p));
    }
  }
  return result;
}

function getGroundDrinksInRoom(room) {
  const result = [];
  for (const d of groundDrinks.values()) {
    if (d.room === room) {
      result.push(d);
    }
  }
  return result;
}

// ─── Music sync state ─────────────────────────────────────────────

let musicState = { trackIndex: 0, startedAt: Date.now() };

setInterval(() => {
  broadcastToAll({ type: 'music_state', ...musicState });
}, 5000);

// ─── WebSocket server ─────────────────────────────────────────────

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    switch (msg.type) {

      case 'join': {
        playerId = crypto.randomUUID();
        const player = {
          id: playerId,
          name: msg.name || 'Anon',
          x: 400,
          y: 520,
          characterId: msg.characterId || 0,
          appearance: msg.appearance || null,
          drinkState: 'none',
          drinkColor: null,
          room: 'main',
          ws
        };
        players.set(playerId, player);

        // Send welcome to the joining player
        ws.send(JSON.stringify({
          type: 'welcome',
          id: playerId,
          players: getPlayersInRoom('main', playerId),
          groundDrinks: getGroundDrinksInRoom('main'),
          musicState
        }));

        // Broadcast to others in main
        broadcastToRoom('main', {
          type: 'player_joined',
          player: stripWs(player)
        }, ws);

        console.log(`Player joined: ${player.name} (${playerId})`);
        break;
      }

      case 'move': {
        const player = players.get(playerId);
        if (!player) break;
        player.x = msg.x;
        player.y = msg.y;
        broadcastToRoom(player.room, {
          type: 'player_moved',
          id: playerId,
          x: msg.x,
          y: msg.y
        }, ws);
        break;
      }

      case 'room_change': {
        const player = players.get(playerId);
        if (!player) break;
        const targetRoom = msg.targetRoom;
        if (!VALID_ROOMS.includes(targetRoom)) break;

        const oldRoom = player.room;

        // Broadcast leave to old room
        broadcastToRoom(oldRoom, {
          type: 'player_left',
          id: playerId
        }, ws);

        // Update player
        player.room = targetRoom;
        player.x = msg.spawnX || 400;
        player.y = msg.spawnY || 300;

        // Send new room state to transitioning player
        ws.send(JSON.stringify({
          type: 'room_state',
          room: targetRoom,
          players: getPlayersInRoom(targetRoom, playerId),
          groundDrinks: getGroundDrinksInRoom(targetRoom)
        }));

        // Broadcast join to new room
        broadcastToRoom(targetRoom, {
          type: 'player_joined',
          player: stripWs(player)
        }, ws);

        console.log(`Player ${playerId} moved ${oldRoom} → ${targetRoom}`);
        break;
      }

      case 'drink_order': {
        const player = players.get(playerId);
        if (!player) break;
        player.drinkState = 'ordering';
        player.drinkColor = msg.drinkColor || null;
        broadcastToRoom(player.room, {
          type: 'drink_update',
          id: playerId,
          drinkState: 'ordering',
          drinkColor: player.drinkColor
        }, ws);
        break;
      }

      case 'drink_carry': {
        const player = players.get(playerId);
        if (!player) break;
        player.drinkState = 'carrying';
        broadcastToRoom(player.room, {
          type: 'drink_update',
          id: playerId,
          drinkState: 'carrying',
          drinkColor: player.drinkColor
        }, ws);
        break;
      }

      case 'drink_drop': {
        const player = players.get(playerId);
        if (!player) break;
        player.drinkState = 'none';
        player.drinkColor = null;

        const drinkId = msg.id || crypto.randomUUID();
        const drink = {
          id: drinkId,
          x: msg.x,
          y: msg.y,
          vx: 0,
          vy: 0,
          color: msg.color,
          room: player.room
        };
        groundDrinks.set(drinkId, drink);

        broadcastToRoom(player.room, {
          type: 'drink_dropped',
          drink
        }, ws);

        // Auto-remove after 8s
        setTimeout(() => {
          groundDrinks.delete(drinkId);
        }, 8000);
        break;
      }

      case 'drink_kick': {
        const player = players.get(playerId);
        if (!player) break;
        const drink = groundDrinks.get(msg.drinkId);
        if (!drink || drink.room !== player.room) break;
        drink.vx = msg.vx;
        drink.vy = msg.vy;
        broadcastToRoom(player.room, {
          type: 'drink_kicked',
          drinkId: msg.drinkId,
          vx: msg.vx,
          vy: msg.vy
        }, ws);
        break;
      }

      case 'chat': {
        const player = players.get(playerId);
        if (!player) break;

        // Validate message
        let text = msg.text;
        if (typeof text !== 'string') break;
        text = text.trim();
        if (text.length === 0 || text.length > 200) break;

        // Rate limit: 1 message per second per player
        const now = Date.now();
        const lastMsg = chatRateLimit.get(playerId) || 0;
        if (now - lastMsg < 1000) {
          ws.send(JSON.stringify({ type: 'chat_error', error: 'Too fast! Wait a moment.' }));
          break;
        }
        chatRateLimit.set(playerId, now);

        // Broadcast to all players in the same room (including sender)
        const chatMsg = {
          type: 'chat',
          id: playerId,
          name: player.name,
          text: text
        };
        broadcastToRoom(player.room, chatMsg);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (playerId) {
      const player = players.get(playerId);
      if (player) {
        broadcastToRoom(player.room, {
          type: 'player_left',
          id: playerId
        });
        console.log(`Player left: ${player.name} (${playerId})`);
      }
      players.delete(playerId);
    }
  });
});

// ─── Start ────────────────────────────────────────────────────────

server.listen(PORT, () => {
  process.stdout.write(`Revilo & Longfield club server listening on port ${PORT}\n`);
});
