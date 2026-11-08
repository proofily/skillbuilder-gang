const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
// Set ALLOWED_ORIGIN on Render to your GitHub Pages origin, e.g. https://yourname.github.io
const io = new Server(server, { cors: { origin: process.env.ALLOWED_ORIGIN || '*' } });

// ---------- database ----------
const db = new Database(path.join(__dirname, 'chat.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    channel_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages (channel_id, id);
`);

const q = {
  channels: db.prepare('SELECT id, name FROM channels ORDER BY id'),
  channelById: db.prepare('SELECT id FROM channels WHERE id = ?'),
  addChannel: db.prepare('INSERT INTO channels (name) VALUES (?)'),
  history: db.prepare(
    `SELECT id, channel_id AS channelId, username, text, created_at AS createdAt
     FROM messages WHERE channel_id = ? ORDER BY id DESC LIMIT 100`
  ),
  addMessage: db.prepare(
    'INSERT INTO messages (channel_id, username, text, created_at) VALUES (?, ?, ?, ?)'
  ),
};

if (q.channels.all().length === 0) {
  ['general', 'random'].forEach((n) => q.addChannel.run(n));
}

// ---------- helpers ----------
const online = new Map(); // socket.id -> username
const onlineNames = () => [...new Set(online.values())].sort();
const cleanName = (s) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, 20);
const cleanChannel = (s) =>
  String(s || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 24);

// ---------- realtime ----------
io.on('connection', (socket) => {
  socket.on('join', (rawName, cb) => {
    const name = cleanName(rawName);
    if (!name) return cb({ error: 'Enter a username.' });
    if (onlineNames().some((n) => n.toLowerCase() === name.toLowerCase())) {
      return cb({ error: 'That username is in use right now. Pick another.' });
    }
    online.set(socket.id, name);
    io.emit('online', onlineNames());
    cb({ ok: true, name, channels: q.channels.all(), online: onlineNames() });
  });

  socket.on('open', (channelId, cb) => {
    if (!online.has(socket.id) || !q.channelById.get(channelId)) return;
    for (const room of socket.rooms) if (room.startsWith('ch:')) socket.leave(room);
    socket.join('ch:' + channelId);
    cb(q.history.all(channelId).reverse());
  });

  socket.on('message', ({ channelId, text } = {}) => {
    const username = online.get(socket.id);
    text = String(text || '').trim().slice(0, 2000);
    if (!username || !text || !q.channelById.get(channelId)) return;
    const createdAt = Date.now();
    const { lastInsertRowid } = q.addMessage.run(channelId, username, text, createdAt);
    io.to('ch:' + channelId).emit('message', {
      id: Number(lastInsertRowid), channelId, username, text, createdAt,
    });
  });

  socket.on('create_channel', (rawName, cb) => {
    if (!online.has(socket.id)) return;
    const name = cleanChannel(rawName);
    if (!name) return cb({ error: 'Use letters, numbers, - or _.' });
    try {
      q.addChannel.run(name);
    } catch {
      return cb({ error: 'That channel already exists.' });
    }
    io.emit('channels', q.channels.all());
    cb({ ok: true });
  });

  socket.on('disconnect', () => {
    if (online.delete(socket.id)) io.emit('online', onlineNames());
  });
});

app.get('/health', (req, res) => res.send('ok'));
app.use(express.static(path.join(__dirname, 'public')));
server.listen(PORT, () => console.log(`Chat running at http://localhost:${PORT}`));
