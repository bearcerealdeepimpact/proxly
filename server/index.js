const express = require('express');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve playlist
app.get('/api/playlist', (req, res) => {
  const playlistJson = require(path.join(__dirname, '..', 'public', 'audio', 'playlist.json'));
  res.json(playlistJson);
});

// Demo drop submission
app.post('/api/demo-drop', (req, res) => {
  const { artistName, email, demoLink, message } = req.body;

  if (!artistName || !email || !demoLink) {
    return res.status(400).json({ error: 'Missing required fields: artistName, email, demoLink' });
  }

  // Log the submission (in production, send email via nodemailer)
  console.log('--- DEMO DROP SUBMISSION ---');
  console.log('Artist:', artistName);
  console.log('Email:', email);
  console.log('Demo Link:', demoLink);
  console.log('Message:', message || '(none)');
  console.log('----------------------------');

  res.json({ success: true, message: 'Demo received! We\'ll have a listen.' });
});

// Mailing list signup
app.post('/api/mailing-list', (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Log the signup (in production, store in DB or send to mailing list service)
  console.log('--- MAILING LIST SIGNUP ---');
  console.log('Email:', email);
  console.log('--------------------------');

  res.json({ success: true, message: 'You\'re on the list!' });
});

server.listen(PORT, () => {
  process.stdout.write(`Revilo & Longfield club server listening on port ${PORT}\n`);
});
