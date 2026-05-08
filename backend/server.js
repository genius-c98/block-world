// Load environment variables from .env (port, DB credentials, etc.)
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

// Score route handlers
const scoresRouter = require('./routes/scores');

const app = express();

// Allow all cross-origin requests (suitable for local development)
app.use(cors({ origin: '*' }));

// Parse JSON request bodies
app.use(express.json());

// Mount score routes under /scores
app.use('/scores', scoresRouter);

// Health-check endpoint — confirms the server is up
app.get('/health', (_req, res) => res.json({ ok: true }));

// Read port from environment, default to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
